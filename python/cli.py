#!/usr/bin/env python3
"""
Chart-Lab - CLI Automation Tool
Converts any MIDI file to a complete, validated Clone Hero / YARG package.
"""

import os
import sys
import argparse
from chart_lab.midi_processor import parse_midi_file
from chart_lab.charter import auto_assign_tracks, chart_fretted, chart_drums
from chart_lab.lyrics_sync import parse_text_lyrics, align_lyrics
from chart_lab.validator import validate_and_repair_chart

def main():
    parser = argparse.ArgumentParser(description="Chart-Lab: Professional Multi-Instrument Charter")
    parser.add_argument("midi_file", help="Path to input .mid / .midi file")
    parser.add_argument("--name", default="", help="Song Title")
    parser.add_argument("--artist", default="", help="Song Artist")
    parser.add_argument("--album", default="Album", help="Album Name")
    parser.add_argument("--year", default="2024", help="Release Year")
    parser.add_argument("--lyrics", default="", help="Path to lyrics text file")
    parser.add_argument("--out", default="./output", help="Output directory")

    args = parser.parse_args()

    if not os.path.exists(args.midi_file):
        print(f"Error: MIDI file not found: {args.midi_file}", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Parsing MIDI: {args.midi_file}")
    midi_data = parse_midi_file(args.midi_file)
    print(f"    PPQ: {midi_data.ppq}, Tracks: {len(midi_data.tracks)}, Duration: {midi_data.total_duration_sec:.1f}s")

    # Name and Artist derivation
    base = os.path.splitext(os.path.basename(args.midi_file))[0].replace("_", " ")
    song_name = args.name or (base.split(" - ")[1] if " - " in base else base)
    artist_name = args.artist or (base.split(" - ")[0] if " - " in base else "Unknown Artist")

    assignments = auto_assign_tracks(midi_data)
    print("[*] Auto-assigned tracks:")
    for inst, trk_ids in assignments.items():
        if trk_ids:
            print(f"    - {inst.upper()}: {[id + 1 for id in trk_ids]}")

    # Build charts
    all_charts = {}
    diffs = ["Expert", "Hard", "Medium", "Easy"]

    for inst in ["guitar", "bass", "rhythm", "keys", "drums"]:
        trk_ids = assignments.get(inst, [])
        if not trk_ids:
            continue
        notes = []
        for tid in trk_ids:
            t = next((tr for tr in midi_data.tracks if tr.id == tid), None)
            if t:
                notes.extend(t.notes)
        if not notes:
            continue

        for diff in diffs:
            header = f"{diff}{'Single' if inst == 'guitar' else ('DoubleBass' if inst == 'bass' else ('Rhythm' if inst == 'rhythm' else ('Keyboard' if inst == 'keys' else 'Drums')))}"
            if inst == "drums":
                all_charts[header] = chart_drums(notes, midi_data.ppq, diff)
            else:
                allow_open = (inst == "bass")
                all_charts[header] = chart_fretted(notes, midi_data.ppq, diff, allow_open=allow_open)

    # Validate & Repair
    print("[*] Auditing chart data with ChartValidator...")
    report = validate_and_repair_chart(all_charts, midi_data.ppq)
    print(f"    Audit complete: {len(report.warnings)} warnings resolved, {report.fixes_applied} auto-fixes applied.")

    # Lyrics
    lyric_events = []
    if args.lyrics and os.path.exists(args.lyrics):
        with open(args.lyrics, "r", encoding="utf-8") as f:
            lyrics_text = f.read()
        vocal_ids = assignments.get("vocals", [])
        vocal_notes = []
        if vocal_ids:
            vt = next((tr for tr in midi_data.tracks if tr.id == vocal_ids[0]), None)
            if vt:
                vocal_notes = vt.notes
        if vocal_notes:
            sylls = parse_text_lyrics(lyrics_text)
            lyric_events = align_lyrics(sylls, vocal_notes, midi_data.ppq)
            print(f"    Syllables aligned: {len(sylls)} to vocal track.")

    # Generate Chart output string
    out_dir = os.path.join(args.out, f"{artist_name} - {song_name}")
    os.makedirs(out_dir, exist_ok=True)

    chart_file = os.path.join(out_dir, "notes.chart")
    ini_file = os.path.join(out_dir, "song.ini")

    with open(chart_file, "w", encoding="utf-8") as f:
        f.write("[Song]\n{\n")
        f.write(f'  Name = "{song_name}"\n')
        f.write(f'  Artist = "{artist_name}"\n')
        f.write(f'  Charter = "Chart-Lab"\n')
        f.write(f'  Album = "{args.album}"\n')
        f.write(f'  Year = ", {args.year}"\n')
        f.write(f'  Offset = 0.000\n')
        f.write(f'  Resolution = {midi_data.ppq}\n')
        f.write(f'  Player2 = bass\n')
        f.write(f'  Difficulty = 2\n')
        f.write(f'  PreviewStart = 30\n')
        f.write(f'  PreviewEnd = 60\n')
        f.write(f'  Genre = "Rock"\n')
        f.write(f'  MediaType = "cd"\n')
        f.write(f'  GuitarStream = "Guitar.wav"\n')
        f.write(f'  BassStream = "Bass.wav"\n')
        f.write(f'  DrumStream = "Drums.wav"\n')
        f.write(f'  KeysStream = "Keys.wav"\n')
        f.write(f'  VocalStream = "Vocals.wav"\n')
        f.write(f'  MusicStream = "song.ogg"\n')
        f.write("}\n")

        f.write("[SyncTrack]\n{\n")
        f.write("  0 = TS 4\n")
        for tm in midi_data.tempos:
            f.write(f"  {tm['tick']} = B {round(tm['bpm'] * 1000)}\n")
        f.write("}\n")

        f.write("[Events]\n{\n")
        f.write('  0 = E "section Intro"\n')
        for tick, ev_text in lyric_events:
            f.write(f'  {tick} = E "{ev_text}"\n')
        f.write("}\n")

        for track_name, notes in all_charts.items():
            f.write(f"[{track_name}]\n{{\n")
            for tick, fret, dur in notes:
                f.write(f"  {tick} = N {fret} {dur}\n")
            f.write("}\n")

    with open(ini_file, "w", encoding="utf-8") as f:
        f.write(f"""[song]
name = {song_name}
artist = {artist_name}
album = {args.album}
genre = Rock
year = {args.year}
charter = Chart-Lab
version = 1.0
song_length = {round(midi_data.total_duration_sec * 1000)}
preview_start_time = 30000
preview_end_time = 60000
diff_band = 2
diff_guitar = 3
diff_rhythm = 2
diff_bass = 2
diff_drums = 3
diff_keys = 4
diff_guitarghl = 0
diff_bassghl = 0
diff_vocals = 3
parts_vocals_harm = 1
modchart = 0
icon = chartlab
loading_phrase = Charted with Chart-Lab Suite

; --- Metadata & Credits ---
credit_arranged_by = Ey-Liam
credit_courtesy_of = EFHIII
credit_other = Ey-Liam & EFHIII
""")

    print(f"\n[+] Success! Ready-to-play song exported to:\n    {out_dir}")

if __name__ == "__main__":
    main()
