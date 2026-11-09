using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;

namespace ChartLab.Core
{
    public static class ChartParser
    {
        private static readonly Regex SectionRegex = new Regex(@"^\[(.*)\]$", RegexOptions.Compiled);
        private static readonly Regex NoteRegex = new Regex(@"^\s*(\d+)\s*=\s*N\s*(\d+)\s*(\d+)", RegexOptions.Compiled);
        private static readonly Regex StarPowerRegex = new Regex(@"^\s*(\d+)\s*=\s*S\s*2\s*(\d+)", RegexOptions.Compiled);
        private static readonly Regex TempoRegex = new Regex(@"^\s*(\d+)\s*=\s*B\s*(\d+)", RegexOptions.Compiled);
        private static readonly Regex TsRegex = new Regex(@"^\s*(\d+)\s*=\s*TS\s*(\d+)", RegexOptions.Compiled);
        private static readonly Regex EventRegex = new Regex(@"^\s*(\d+)\s*=\s*E\s*""(.*)""", RegexOptions.Compiled);

        public static ChartSong ParseChartFile(string filePath)
        {
            if (!File.Exists(filePath))
                throw new FileNotFoundException("Chart file not found: " + filePath);

            string[] lines = File.ReadAllLines(filePath);
            var song = new ChartSong();

            string currentSection = "";

            foreach (var rawLine in lines)
            {
                string line = rawLine.Trim();
                if (string.IsNullOrEmpty(line) || line.StartsWith("{") || line.StartsWith("}"))
                    continue;

                var sectionMatch = SectionRegex.Match(line);
                if (sectionMatch.Success)
                {
                    currentSection = sectionMatch.Groups[1].Value;
                    if (!song.TrackSections.ContainsKey(currentSection))
                        song.TrackSections[currentSection] = new List<ChartNote>();
                    continue;
                }

                if (currentSection == "Song")
                {
                    ParseSongMetadataLine(line, song.Metadata);
                }
                else if (currentSection == "SyncTrack")
                {
                    ParseSyncTrackLine(line, song.SyncTrack);
                }
                else if (currentSection == "Events")
                {
                    ParseEventsLine(line, song.Events);
                }
                else if (!string.IsNullOrEmpty(currentSection))
                {
                    ParseTrackLine(line, song.TrackSections[currentSection]);
                }
            }

            ComputeRealTimeTimestamps(song);
            return song;
        }

        private static void ParseSongMetadataLine(string line, SongMetadata meta)
        {
            int eqIdx = line.IndexOf('=');
            if (eqIdx == -1) return;

            string key = line.Substring(0, eqIdx).Trim();
            string val = line.Substring(eqIdx + 1).Trim().Trim('"').Trim('\'');

            switch (key.ToLower())
            {
                case "name": meta.Name = val; break;
                case "artist": meta.Artist = val; break;
                case "charter": meta.Charter = val; break;
                case "album": meta.Album = val; break;
                case "year": meta.Year = val.Replace(",", "").Trim(); break;
                case "resolution": int.TryParse(val, out meta.Resolution); break;
                case "offset": float.TryParse(val, NumberStyles.Any, CultureInfo.InvariantCulture, out meta.Offset); break;
                case "genre": meta.Genre = val; break;
            }
        }

        private static void ParseSyncTrackLine(string line, List<SyncEvent> syncTrack)
        {
            var bMatch = TempoRegex.Match(line);
            if (bMatch.Success)
            {
                long tick = long.Parse(bMatch.Groups[1].Value);
                float bpm = float.Parse(bMatch.Groups[2].Value) / 1000f;
                syncTrack.Add(new SyncEvent { Tick = tick, Bpm = bpm });
                return;
            }

            var tsMatch = TsRegex.Match(line);
            if (tsMatch.Success)
            {
                long tick = long.Parse(tsMatch.Groups[1].Value);
                int num = int.Parse(tsMatch.Groups[2].Value);
                syncTrack.Add(new SyncEvent { Tick = tick, TimeSignatureNumerator = num });
            }
        }

        private static void ParseEventsLine(string line, List<LyricEvent> events)
        {
            var match = EventRegex.Match(line);
            if (match.Success)
            {
                long tick = long.Parse(match.Groups[1].Value);
                string text = match.Groups[2].Value;
                events.Add(new LyricEvent
                {
                    Tick = tick,
                    Text = text,
                    IsPhraseStart = text == "phrase_start",
                    IsPhraseEnd = text == "phrase_end"
                });
            }
        }

        private static void ParseTrackLine(string line, List<ChartNote> noteList)
        {
            var match = NoteRegex.Match(line);
            if (match.Success)
            {
                long tick = long.Parse(match.Groups[1].Value);
                int fret = int.Parse(match.Groups[2].Value);
                long sustain = long.Parse(match.Groups[3].Value);

                noteList.Add(new ChartNote(tick, fret, sustain));
                return;
            }

            var spMatch = StarPowerRegex.Match(line);
            if (spMatch.Success)
            {
                long tick = long.Parse(spMatch.Groups[1].Value);
                long duration = long.Parse(spMatch.Groups[2].Value);
                noteList.Add(new ChartNote(tick, -1, duration) { IsStarPower = true });
            }
        }

        public static void ComputeRealTimeTimestamps(ChartSong song)
        {
            int ppq = song.Metadata.Resolution > 0 ? song.Metadata.Resolution : 480;
            song.SyncTrack.Sort((a, b) => a.Tick.CompareTo(b.Tick));

            // Default initial tempo
            float curBpm = 120f;
            float curSec = 0f;
            long lastTick = 0;

            foreach (var sync in song.SyncTrack)
            {
                if (sync.Bpm > 0)
                {
                    long deltaTicks = sync.Tick - lastTick;
                    curSec += (deltaTicks / (float)ppq) * (60f / curBpm);
                    sync.TimeInSeconds = curSec;
                    lastTick = sync.Tick;
                    curBpm = sync.Bpm;
                }
            }

            // Converter delegate
            float TickToSec(long tick)
            {
                float bpm = 120f;
                float sec = 0f;
                long lTick = 0;

                foreach (var s in song.SyncTrack)
                {
                    if (s.Tick > tick) break;
                    if (s.Bpm > 0)
                    {
                        long dTicks = s.Tick - lTick;
                        sec += (dTicks / (float)ppq) * (60f / bpm);
                        lTick = s.Tick;
                        bpm = s.Bpm;
                    }
                }
                long remTicks = tick - lTick;
                sec += (remTicks / (float)ppq) * (60f / bpm);
                return sec;
            }

            foreach (var kv in song.TrackSections)
            {
                foreach (var note in kv.Value)
                {
                    note.TimeInSeconds = TickToSec(note.Tick);
                    note.DurationInSeconds = TickToSec(note.Tick + note.SustainTicks) - note.TimeInSeconds;
                    if (note.TimeInSeconds > song.TotalDurationSeconds)
                        song.TotalDurationSeconds = note.TimeInSeconds;
                }
            }

            foreach (var ev in song.Events)
            {
                ev.TimeInSeconds = TickToSec(ev.Tick);
            }
        }
    }
}
