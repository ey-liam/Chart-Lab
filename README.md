# Chart-Lab

Cross-platform multi-instrument charting, alignment, and validation suite for rhythm games (Clone Hero, YARG, Moonscraper, Phase Shift).

---

## Overview

Chart-Lab is a modular ecosystem for generating, synchronizing, and validating rhythm game charts from MIDI data. It supports multi-track conversion, automated multi-difficulty generation, syllable alignment for vocals, audio stem routing, and real-time validation against timing and sustain collision defects.

---

## Architecture

The project consists of decoupled components implemented across modern software stacks:

- **Web Studio (`web/`)**: Single-page application built with HTML5, CSS3, and modern JavaScript. Includes Web Audio API stem mixing, Canvas 3D highway perspective rendering, and in-browser ZIP packaging.
- **Unity & C# (`unity_csharp/`)**: Core chart data models, high-performance `.chart` parser, gameplay controller with combo scoring, and custom ShaderLab/HLSL shaders for curved perspective highways and faceted notes.
- **Python Toolkit (`python/`)**: Command-line interface and library for automated batch processing, binary MIDI parsing, and mathematical validation.
- **Java Core (`java/`)**: Standard Java library using `javax.sound.midi` with Maven build configuration for server-side or cross-platform desktop integration.

---

## Features

- **Multi-Instrument Processing**: Simultaneous conversion of Lead Guitar, Bass, Rhythm Guitar, Keyboards/Piano, Drums, and Vocals from a single MIDI source.
- **Automated Difficulties**: Generates four standard difficulty tiers (`Expert`, `Hard`, `Medium`, `Easy`) with rhythm decimation and chord-size constraints.
- **General MIDI Drum Mapping**: Maps GM percussion tracks to 4-lane layout with kick pedal detection and Pro Cymbal assignments (Yellow, Blue, Green).
- **Phonetic Syllable Aligner**: Parses plain text lyrics, computes syllable splits, and anchors them sequentially to vocal track note events with phrase markers.
- **Stem Management and Latency Adjustment**: Supports individual audio stems (`Guitar.wav`, `Bass.wav`, `Drums.wav`, `Keys.wav`, `Vocals.wav`, `song.ogg`) with millisecond-level offset configuration.
- **Chart Validation Engine**: Verifies tick monotonicity, clips overlapping sustains on identical frets, and enforces boundary constraints.
- **YARG & Clone Hero Package Export**: Produces verified `notes.chart`, standardized `song.ini` with integer difficulty ratings, and optional album artwork packaged into a compressed archive.

---

## Installation and Execution

### Web Studio

Launch the local server:

```bash
# Windows
start.bat

# Manual
node server.js
```

Navigate to `http://localhost:3000` in a modern browser.

### Python CLI

```bash
python python/cli.py <path-to-midi> [options]

# Example
python python/cli.py demo/Olivia_Rodrigo_-_teenage_dream.mid \
  --name "teenage dream" \
  --artist "Olivia Rodrigo" \
  --album "GUTS" \
  --year "2023" \
  --lyrics demo/lyrics_sample.txt \
  --out ./output
```

### Java CLI

```bash
cd java
mvn clean package
java -jar target/chart-lab-core-1.0.0.jar <path-to-midi> [output-dir]
```

### Unity Integration

Import the `unity_csharp/` directory into your Unity project assets. Attach `HighwayController.cs` to a GameObject and apply `RhythmHighway.shader` and `NoteGemGlow.shader` to target materials.

---

## License

Distributed under the MIT License. See `LICENSE` for details.

<br>
<sub>Inspiration: Conceptual idea inspired by EFHIII.</sub>
