"""
Chart-Lab - Multi-Instrument Charter Engine
Generates Expert, Hard, Medium, Easy charts for:
- 5-Fret: Lead Guitar, Bass, Rhythm, Guitar Coop, Keys
- 6-Fret Guitar Hero Live: Lead GHL, Bass GHL, Rhythm GHL, Coop GHL
- Drums: 4-Lane / Pro Drums (with Cymbal Markers 64, 65, 66) & 5-Lane Drums
- Dance: 4-Panel (Left, Down, Up, Right)
"""

from typing import List, Dict, Any, Tuple
from .midi_processor import MidiData, MidiNote

def auto_assign_tracks(midi_data: MidiData) -> Dict[str, List[int]]:
    mapping = {
        'guitar': [],
        'guitarghl': [],
        'bass': [],
        'bassghl': [],
        'drums': [],
        'drums_5lane': [],
        'keys': [],
        'keys_real': [],
        'rhythm': [],
        'rhythmghl': [],
        'guitar_coop': [],
        'vocals': [],
        'vocals_harm1': [],
        'dance': []
    }

    vocal_tracks = []
    guitar_tracks = []

    for trk in midi_data.tracks:
        if not trk.notes:
            continue
        name = trk.name.lower()
        inst = trk.instrument_name.lower()

        if trk.is_percussion or trk.channel == 9 or 'drum' in name or 'perc' in name:
            if '5lane' in name or 'gh drum' in name:
                mapping['drums_5lane'].append(trk.id)
            else:
                mapping['drums'].append(trk.id)
        elif 'bass' in name or 'bass' in inst:
            if 'ghl' in name or '6-fret' in name:
                mapping['bassghl'].append(trk.id)
            else:
                mapping['bass'].append(trk.id)
        elif 'voice' in name or 'vocal' in name or 'choir' in name or 'sing' in name:
            vocal_tracks.append(trk.id)
        elif 'dance' in name or 'step' in name:
            mapping['dance'].append(trk.id)
        elif 'piano' in name or 'key' in name or 'organ' in name or 'synth' in name:
            mapping['keys'].append(trk.id)
        elif 'guitar' in name or 'guitar' in inst or 'lead' in name or 'solo' in name:
            guitar_tracks.append((trk.id, name))
        elif 'string' in name or 'pad' in name:
            mapping['rhythm'].append(trk.id)

    # Distribute vocals
    if vocal_tracks:
        mapping['vocals'].append(vocal_tracks[0])
        if len(vocal_tracks) > 1:
            mapping['vocals_harm1'].append(vocal_tracks[1])

    # Distribute guitars
    for trk_id, name in guitar_tracks:
        if 'ghl' in name or '6-fret' in name:
            mapping['guitarghl'].append(trk_id)
        elif 'rhythm' in name or 'ritm' in name:
            mapping['rhythm'].append(trk_id)
        elif 'coop' in name:
            mapping['guitar_coop'].append(trk_id)
        elif not mapping['guitar']:
            mapping['guitar'].append(trk_id)
        elif not mapping['rhythm']:
            mapping['rhythm'].append(trk_id)
        else:
            mapping['guitar_coop'].append(trk_id)

    if not mapping['guitar'] and not mapping['guitarghl']:
        sorted_trks = sorted(
            [t for t in midi_data.tracks if t.id not in mapping['drums'] and t.id not in mapping['bass'] and t.notes],
            key=lambda t: len(t.notes),
            reverse=True
        )
        if sorted_trks:
            mapping['guitar'].append(sorted_trks[0].id)

    return mapping


def cluster_notes(notes: List[MidiNote], tolerance_ticks: int = 15) -> List[Dict[str, Any]]:
    if not notes:
        return []
    sorted_notes = sorted(notes, key=lambda n: n.tick)
    clusters = []
    current = {'tick': sorted_notes[0].tick, 'notes': [sorted_notes[0]]}

    for n in sorted_notes[1:]:
        if (n.tick - current['tick']) <= tolerance_ticks:
            current['notes'].append(n)
        else:
            clusters.append(current)
            current = {'tick': n.tick, 'notes': [n]}
    clusters.append(current)
    return clusters


def chart_fretted(notes: List[MidiNote], ppq: int, difficulty: str = "Expert", max_chords: int = 2, allow_open: bool = False) -> List[Tuple[int, int, int]]:
    if not notes:
        return []

    filtered = notes
    if difficulty == "Hard":
        filtered = notes[::1]
    elif difficulty == "Medium":
        filtered = [n for i, n in enumerate(notes) if i % 2 == 0 or n.duration_ticks >= ppq // 2]
    elif difficulty == "Easy":
        filtered = [n for i, n in enumerate(notes) if i % 3 == 0 or n.duration_ticks >= ppq]

    clusters = cluster_notes(filtered, tolerance_ticks=15)
    pitches = [n.pitch for n in notes]
    min_p, max_p = min(pitches), max(pitches)
    p_range = max(1, max_p - min_p)

    max_frets = 3 if difficulty == "Easy" else (4 if difficulty == "Medium" else 5)
    max_chord_size = 1 if difficulty in ("Easy", "Medium") else max_chords

    charted = []
    for i, cl in enumerate(clusters):
        t = cl['tick']
        next_t = clusters[i+1]['tick'] if i + 1 < len(clusters) else t + ppq * 4
        c_pitches = sorted(list(set(n.pitch for n in cl['notes'])))
        avg_dur = sum(n.duration_ticks for n in cl['notes']) // len(cl['notes'])

        sustain = 0
        if avg_dur >= ppq * 0.4:
            sustain = max(0, min(avg_dur - ppq // 8, (next_t - t) - ppq // 8))

        if allow_open and c_pitches[0] <= 36:
            charted.append((t, 7, sustain))
            continue

        selected = c_pitches[:max_chord_size]
        frets = []
        for p in selected:
            f = round(((p - min_p) / p_range) * (max_frets - 1))
            frets.append(max(0, min(max_frets - 1, f)))
        frets = sorted(list(set(frets)))

        if len(frets) == 1 and len(selected) > 1 and max_chord_size > 1:
            if frets[0] < max_frets - 1:
                frets.append(frets[0] + 1)
            else:
                frets.insert(0, frets[0] - 1)

        for f in frets:
            charted.append((t, f, sustain))

    return charted


def chart_ghl(notes: List[MidiNote], ppq: int, difficulty: str = "Expert") -> List[Tuple[int, int, int]]:
    """
    Charts for 6-fret Guitar Hero Live:
    0 = Open, 1 = White 1, 2 = White 2, 3 = White 3, 4 = Black 1, 7 = Black 2, 8 = Black 3
    """
    if not notes:
        return []

    filtered = notes
    if difficulty == "Medium":
        filtered = [n for i, n in enumerate(notes) if i % 2 == 0 or n.duration_ticks >= ppq // 2]
    elif difficulty == "Easy":
        filtered = [n for i, n in enumerate(notes) if i % 3 == 0 or n.duration_ticks >= ppq]

    clusters = cluster_notes(filtered, tolerance_ticks=15)
    pitches = [n.pitch for n in notes]
    min_p, max_p = min(pitches), max(pitches)
    p_range = max(1, max_p - min_p)

    ghl_pool = [1, 2, 3, 4, 7, 8]
    if difficulty == "Easy":
        ghl_pool = [1, 2]
    elif difficulty == "Medium":
        ghl_pool = [1, 2, 3, 4]

    charted = []
    for i, cl in enumerate(clusters):
        t = cl['tick']
        next_t = clusters[i+1]['tick'] if i + 1 < len(clusters) else t + ppq * 4
        c_pitches = sorted(list(set(n.pitch for n in cl['notes'])))
        avg_dur = sum(n.duration_ticks for n in cl['notes']) // len(cl['notes'])

        sustain = 0
        if avg_dur >= ppq * 0.4:
            sustain = max(0, min(avg_dur - ppq // 8, (next_t - t) - ppq // 8))

        if c_pitches[0] <= 36:
            charted.append((t, 0, sustain))
            continue

        p = c_pitches[-1]
        idx = min(len(ghl_pool) - 1, int(((p - min_p) / p_range) * len(ghl_pool)))
        charted.append((t, ghl_pool[idx], sustain))

    return charted


def chart_drums(notes: List[MidiNote], ppq: int, difficulty: str = "Expert") -> List[Tuple[int, int, int]]:
    hits = cluster_notes(notes, tolerance_ticks=12)
    events = []

    for h in hits:
        t = h['tick']
        pads = set()
        cymbals = set()

        for n in h['notes']:
            p = n.pitch
            if p in (35, 36):
                pads.add(0) # Kick
            elif p in (38, 40, 37, 39):
                pads.add(1) # Snare
            elif p in (42, 44, 46):
                pads.add(2) # Hihat
                cymbals.add(64) # Pro Cymbal Yellow
            elif p in (48, 50):
                pads.add(2) # Tom
            elif p in (45, 47):
                pads.add(3) # Blue tom
            elif p in (51, 59, 53):
                pads.add(3) # Ride
                cymbals.add(65) # Pro Cymbal Blue
            elif p in (41, 43):
                pads.add(4) # Floor tom
            elif p in (49, 52, 55, 57):
                pads.add(4) # Crash
                cymbals.add(66) # Pro Cymbal Green
            else:
                pads.add(2)

        if difficulty == "Easy" and 0 in pads and 1 in pads:
            pads.remove(0)

        for pad in pads:
            events.append((t, pad, 0))
        for cym in cymbals:
            events.append((t, cym, 0))

    return sorted(events, key=lambda e: e[0])


def chart_dance(notes: List[MidiNote], ppq: int, difficulty: str = "Expert") -> List[Tuple[int, int, int]]:
    """
    Charts for 4-panel Dance (Left=0, Down=1, Up=2, Right=3).
    """
    hits = cluster_notes(notes, tolerance_ticks=15)
    events = []
    for i, h in enumerate(hits):
        t = h['tick']
        avg_p = sum(n.pitch for n in h['notes']) / len(h['notes'])
        panel = (int(avg_p) + i) % 4
        events.append((t, panel, 0))
    return events
