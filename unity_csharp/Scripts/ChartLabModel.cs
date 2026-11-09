using System;
using System.Collections.Generic;

namespace ChartLab.Core
{
    public enum InstrumentType
    {
        LeadGuitar,
        GuitarGHL,
        Bass,
        BassGHL,
        Rhythm,
        RhythmGHL,
        GuitarCoop,
        GuitarCoopGHL,
        Drums,
        Drums5Lane,
        Keys,
        KeysReal,
        Dance,
        Vocals,
        VocalsHarm1,
        VocalsHarm2,
        VocalsHarm3
    }

    public enum DifficultyTier
    {
        Easy,
        Medium,
        Hard,
        Expert
    }

    [Serializable]
    public class ChartNote
    {
        public long Tick;
        public int Fret;
        public long SustainTicks;
        public float TimeInSeconds;
        public float DurationInSeconds;
        public bool IsStarPower;
        public bool IsChord;
        public bool IsCymbalMarker;
        public bool IsGHL;
        public bool IsDance;
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
        public string Charter = "Chart-Lab";
        public string Album = "Unknown Album";
        public int AlbumTrack = 1;
        public string Year = "2024";
        public float Offset = 0f;
        public int Resolution = 480;
        public string Genre = "Rock";
        public string SubGenre = "Alternative";
        public string Tags = "";
        public string Location = "";
        public int Rating = 1;
        public string Playlist = "";
        public int PlaylistTrack = 1;

        // Difficulties
        public int DiffBand = 2;
        public int DiffGuitar = 3;
        public int DiffGuitarGhl = 0;
        public int DiffGuitarReal = 0;
        public int DiffGuitarReal22 = 0;
        public int DiffGuitarCoop = 0;
        public int DiffGuitarCoopGhl = 0;
        public int DiffRhythm = 2;
        public int DiffRhythmGhl = 0;
        public int DiffBass = 2;
        public int DiffBassGhl = 0;
        public int DiffBassReal = 0;
        public int DiffBassReal22 = 0;
        public int DiffDrums = 3;
        public int DiffDrumsReal = 3;
        public int DiffEliteDrums = 0;
        public int DiffKeys = 4;
        public int DiffKeysReal = 0;
        public int DiffVocals = 3;
        public int DiffVocalsHarm = 0;
        public int DiffDance = 0;

        // Engine flags
        public bool ProDrums = true;
        public bool FiveLaneDrums = false;
        public int PartsVocalsHarm = 1;
        public int VocalScrollSpeed = 100;
        public int Modchart = 0;
        public int VideoStartTime = 0;
        public int EndEvents = 0;
        public string LoadingPhrase = "Charted with Chart-Lab Suite";
        public string Icon = "chartlab";

        // Credits
        public string CreditArrangedBy = "Ey-Liam";
        public string CreditCourtesyOf = "EFHIII";
        public string CreditOther = "Ey-Liam & EFHIII";
        public string CreditComposedBy = "";
        public string CreditProducedBy = "";
        public string CreditMixedBy = "";
        public string CreditMasteredBy = "";
        public string CreditEngineeredBy = "";
        public string CreditAlbumArtBy = "";
        public string CreditLicense = "";

        // Social links
        public string LinkSpotify = "";
        public string LinkYoutube = "";
        public string LinkBandcamp = "";
        public string LinkSoundcloud = "";
        public string LinkTwitter = "";
        public string LinkInstagram = "";
    }

    [Serializable]
    public class ChartSong
    {
        public SongMetadata Metadata = new SongMetadata();
        public List<SyncEvent> SyncTrack = new List<SyncEvent>();
        public List<LyricEvent> Events = new List<LyricEvent>();
        public Dictionary<string, List<ChartNote>> TrackSections = new Dictionary<string, List<ChartNote>>();
    }
}
