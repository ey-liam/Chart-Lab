using System;
using System.Collections.Generic;

namespace ChartLab.Core
{
    public enum InstrumentType
    {
        LeadGuitar,
        Bass,
        RhythmGuitar,
        Keyboard,
        Drums,
        Vocals
    }

    public enum DifficultyLevel
    {
        Easy,
        Medium,
        Hard,
        Expert
    }

    public enum NoteFret
    {
        Green = 0,
        Red = 1,
        Yellow = 2,
        Blue = 3,
        Orange = 4,
        OpenNote = 7,
        // Drum Markers
        Kick = 0,
        Snare = 1,
        YellowCymbal = 64,
        BlueCymbal = 65,
        GreenCymbal = 66
    }

    [Serializable]
    public class ChartNote
    {
        public long Tick;
        public int Fret;
        public long SustainTicks;
        public float TimeInSeconds;
        public float DurationInSeconds;
        public bool IsChord;
        public bool IsStarPower;

        public ChartNote(long tick, int fret, long sustain = 0)
        {
            Tick = tick;
            Fret = fret;
            SustainTicks = sustain;
        }
    }

    [Serializable]
    public class SyncEvent
    {
        public long Tick;
        public float Bpm;
        public int TimeSignatureNumerator;
        public float TimeInSeconds;
    }

    [Serializable]
    public class LyricEvent
    {
        public long Tick;
        public string Text;
        public float TimeInSeconds;
        public bool IsPhraseStart;
        public bool IsPhraseEnd;
    }

    [Serializable]
    public class SongMetadata
    {
        public string Name = "Untitled";
        public string Artist = "Unknown Artist";
        public string Charter = "Chart-Lab Team & EFHIII";
        public string Album = "Unknown Album";
        public string Year = "2024";
        public float Offset = 0f;
        public int Resolution = 480;
        public string Genre = "Rock";
        public int DiffGuitar = 3;
        public int DiffBass = 2;
        public int DiffDrums = 3;
        public int DiffKeys = 4;
        public int DiffVocals = 3;
    }

    [Serializable]
    public class ChartSong
    {
        public SongMetadata Metadata = new SongMetadata();
        public List<SyncEvent> SyncTrack = new List<SyncEvent>();
        public List<LyricEvent> Events = new List<LyricEvent>();
        public Dictionary<string, List<ChartNote>> TrackSections = new Dictionary<string, List<ChartNote>>();

        public float TotalDurationSeconds;
    }
}
