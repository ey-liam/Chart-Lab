"""
Chart-Lab - Binary MIDI Processor & Pitch Classifier
Parses standard Type 0 & 1 MIDI files with running status and meta-events.
"""

import struct
from typing import List, Dict, Any, Tuple

class MidiNote:
    def __init__(self, pitch: int, velocity: int, tick: int, duration_ticks: int, channel: int = 0):
        self.pitch = pitch
        self.velocity = velocity
        self.tick = tick
        self.duration_ticks = duration_ticks
        self.channel = channel
        self.start_time = 0.0
        self.end_time = 0.0

    def __repr__(self):
        return f"MidiNote(pitch={self.pitch}, tick={self.tick}, dur={self.duration_ticks})"

class MidiTrack:
    def __init__(self, track_id: int, name: str = ""):
        self.id = track_id
        self.name = name or f"Track {track_id + 1}"
        self.instrument_name = ""
        self.channel = 0
        self.is_percussion = False
        self.notes: List[MidiNote] = []
        self.text_events: List[Tuple[int, str, str]] = [] # (tick, type, text)

class MidiData:
    def __init__(self, ppq: int = 480):
        self.ppq = ppq
        self.tracks: List[MidiTrack] = []
        self.tempos: List[Dict[str, Any]] = [] # [{'tick': t, 'tempo_us': us, 'bpm': bpm}]
        self.time_signatures: List[Dict[str, Any]] = []
        self.max_tick = 0
        self.total_duration_sec = 0.0

    def tick_to_seconds(self, tick: int) -> float:
        if tick <= 0 or not self.tempos:
            return 0.0
        prev = self.tempos[0]
        for tm in self.tempos[1:]:
            if tm['tick'] > tick:
                break
            prev = tm
        delta_ticks = tick - prev['tick']
        return prev['time_sec'] + (delta_ticks / self.ppq) * (prev['tempo_us'] / 1_000_000.0)

    def seconds_to_tick(self, sec: float) -> int:
        if sec <= 0.0 or not self.tempos:
            return 0
        prev = self.tempos[0]
        for tm in self.tempos[1:]:
            if tm['time_sec'] > sec:
                break
            prev = tm
        delta_sec = sec - prev['time_sec']
        delta_ticks = (delta_sec * 1_000_000.0 / prev['tempo_us']) * self.ppq
        return round(prev['tick'] + delta_ticks)


def parse_midi_file(filepath: str) -> MidiData:
    with open(filepath, "rb") as f:
        data = f.read()

    offset = 0

    def read_str(n: int) -> str:
        nonlocal offset
        s = data[offset:offset+n].decode('latin1', errors='ignore')
        offset += n
        return s

    def read_u32() -> int:
        nonlocal offset
        v = struct.unpack(">I", data[offset:offset+4])[0]
        offset += 4
        return v

    def read_u16() -> int:
        nonlocal offset
        v = struct.unpack(">H", data[offset:offset+2])[0]
        offset += 2
        return v

    def read_u8() -> int:
        nonlocal offset
        v = data[offset]
        offset += 1
        return v

    def read_var_len() -> int:
        nonlocal offset
        val = 0
        while True:
            b = data[offset]
            offset += 1
            val = (val << 7) | (b & 0x7F)
            if not (b & 0x80):
                break
        return val

    header_id = read_str(4)
    if header_id != "MThd":
        raise ValueError(f"Invalid MIDI header: {header_id}")

    header_len = read_u32()
    fmt = read_u16()
    num_tracks = read_u16()
    division = read_u16()
    ppq = division if not (division & 0x8000) else 480

    if header_len > 6:
        offset += (header_len - 6)

    midi_obj = MidiData(ppq)

    for t_idx in range(num_tracks):
        if offset >= len(data):
            break
        track_id = read_str(4)
        if track_id != "MTrk":
            break

        track_len = read_u32()
        track_end = offset + track_len

        track = MidiTrack(t_idx)
        cur_tick = 0
        running_status = 0
        open_notes: Dict[int, List[Tuple[int, int, int]]] = {} # pitch -> [(tick, vel, chan)]

        while offset < track_end and offset < len(data):
            delta = read_var_len()
            cur_tick += delta
            if cur_tick > midi_obj.max_tick:
                midi_obj.max_tick = cur_tick

            status = data[offset]
            if status & 0x80:
                offset += 1
                running_status = status
            else:
                status = running_status

            msg_type = status & 0xF0
            chan = status & 0x0F

            if chan == 9:
                track.is_percussion = True
            track.channel = chan

            if status == 0xFF:
                # Meta event
                meta_type = read_u8()
                meta_len = read_var_len()
                meta_data = data[offset:offset+meta_len]
                offset += meta_len

                if meta_type == 0x03:
                    track.name = meta_data.decode('latin1', errors='ignore').strip() or track.name
                elif meta_type == 0x04:
                    track.instrument_name = meta_data.decode('latin1', errors='ignore').strip()
                elif meta_type == 0x51 and meta_len == 3:
                    us = (meta_data[0] << 16) | (meta_data[1] << 8) | meta_data[2]
                    bpm = 60_000_000.0 / us
                    midi_obj.tempos.append({'tick': cur_tick, 'tempo_us': us, 'bpm': bpm})
                elif meta_type == 0x58 and meta_len >= 2:
                    num = meta_data[0]
                    den = 2 ** meta_data[1]
                    midi_obj.time_signatures.append({'tick': cur_tick, 'num': num, 'den': den})
                elif meta_type in (0x01, 0x05):
                    txt = meta_data.decode('latin1', errors='ignore').strip()
                    ev_type = 'lyric' if meta_type == 0x05 else 'text'
                    track.text_events.append((cur_tick, ev_type, txt))

            elif status in (0xF0, 0xF7):
                sys_len = read_var_len()
                offset += sys_len
            elif msg_type in (0x90, 0x80):
                note_num = read_u8()
                vel = read_u8()
                if msg_type == 0x90 and vel > 0:
                    open_notes.setdefault(note_num, []).append((cur_tick, vel, chan))
                else:
                    if note_num in open_notes and open_notes[note_num]:
                        s_tick, s_vel, s_chan = open_notes[note_num].pop(0)
                        dur = max(1, cur_tick - s_tick)
                        track.notes.append(MidiNote(note_num, s_vel, s_tick, dur, s_chan))
            elif msg_type in (0xC0, 0xD0):
                read_u8()
            elif msg_type in (0xA0, 0xB0, 0xE0):
                offset += 2

        offset = track_end

        # Close unclosed notes
        for note_num, starts in open_notes.items():
            for s_tick, s_vel, s_chan in starts:
                dur = max(1, midi_obj.max_tick - s_tick)
                track.notes.append(MidiNote(note_num, s_vel, s_tick, dur, s_chan))

        track.notes.sort(key=lambda n: n.tick)
        midi_obj.tracks.append(track)

    # Process tempos
    if not midi_obj.tempos:
        midi_obj.tempos.append({'tick': 0, 'tempo_us': 500_000, 'bpm': 120.0})
    midi_obj.tempos.sort(key=lambda t: t['tick'])

    # Compute cumulative seconds for tempos
    cur_sec = 0.0
    last_tick = 0
    last_us = midi_obj.tempos[0]['tempo_us']
    for tm in midi_obj.tempos:
        delta = tm['tick'] - last_tick
        cur_sec += (delta / midi_obj.ppq) * (last_us / 1_000_000.0)
        tm['time_sec'] = cur_sec
        last_tick = tm['tick']
        last_us = tm['tempo_us']

    # Set real times for all notes
    for trk in midi_obj.tracks:
        for n in trk.notes:
            n.start_time = midi_obj.tick_to_seconds(n.tick)
            n.end_time = midi_obj.tick_to_seconds(n.tick + n.duration_ticks)

    midi_obj.total_duration_sec = midi_obj.tick_to_seconds(midi_obj.max_tick)
    return midi_obj
