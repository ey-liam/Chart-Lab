using System;
using System.Collections.Generic;
using UnityEngine;

namespace ChartLab.Unity
{
    using ChartLab.Core;

    public class HighwayController : MonoBehaviour
    {
        [Header("Highway Configuration")]
        public float NoteSpeed = 12f;
        public float StrikeLineZ = -4.5f;
        public float SpawnDistanceZ = 30f;
        public Transform StrikeLineTransform;

        [Header("Prefabs & Materials")]
        public GameObject[] NotePrefabs; // Green, Red, Yellow, Blue, Orange, Open
        public Material HighwayMaterial;

        [Header("Live Score (uwuHero Style)")]
        public int Score = 0;
        public int Combo = 0;
        public int MaxCombo = 0;
        public int TotalNotes = 0;
        public int NotesHit = 0;
        public string RankGrade = "S";

        private ChartSong _activeSong;
        private List<ChartNote> _activeNotes = new List<ChartNote>();
        private float _songPositionSeconds = 0f;
        private bool _isPlaying = false;

        public void LoadChart(ChartSong song, string difficultyTrack = "ExpertSingle")
        {
            _activeSong = song;
            if (song.TrackSections.TryGetValue(difficultyTrack, out var list))
            {
                _activeNotes = new List<ChartNote>(list);
                TotalNotes = _activeNotes.Count;
            }
            Score = 0;
            Combo = 0;
            NotesHit = 0;
            RankGrade = "S";
        }

        public void PlaySong()
        {
            _songPositionSeconds = 0f;
            _isPlaying = true;
        }

        public void PauseSong()
        {
            _isPlaying = false;
        }

        private void Update()
        {
            if (!_isPlaying) return;

            _songPositionSeconds += Time.deltaTime;

            // Update highway shader offset for rhythmic pulse
            if (HighwayMaterial != null)
            {
                HighwayMaterial.SetFloat("_SongTime", _songPositionSeconds);
            }

            // Check note hit window (Hit window +/- 75ms)
            CheckInputAndHits();
            UpdateRankGrade();
        }

        private void CheckInputAndHits()
        {
            // Example fret keys: A, S, J, K, L (or 1, 2, 3, 4, 5)
            KeyCode[] fretKeys = new KeyCode[] { KeyCode.A, KeyCode.S, KeyCode.J, KeyCode.K, KeyCode.L };

            for (int f = 0; f < fretKeys.Length; f++)
            {
                if (Input.GetKeyDown(fretKeys[f]))
                {
                    RegisterHit(f);
                }
            }
        }

        private void RegisterHit(int fret)
        {
            float hitWindow = 0.085f; // 85 ms
            ChartNote target = null;

            foreach (var note in _activeNotes)
            {
                if (note.Fret == fret && Mathf.Abs(note.TimeInSeconds - _songPositionSeconds) <= hitWindow)
                {
                    target = note;
                    break;
                }
            }

            if (target != null)
            {
                // Hit!
                _activeNotes.Remove(target);
                NotesHit++;
                Combo++;
                if (Combo > MaxCombo) MaxCombo = Combo;
                int multiplier = Mathf.Min(4, 1 + Combo / 10);
                Score += 50 * multiplier;
            }
            else
            {
                // Strum miss
                Combo = 0;
            }
        }

        private void UpdateRankGrade()
        {
            if (TotalNotes == 0) return;
            float accuracy = (float)NotesHit / TotalNotes;

            if (accuracy >= 0.98f && Combo == TotalNotes) RankGrade = "FC (Full Combo)";
            else if (accuracy >= 0.95f) RankGrade = "S";
            else if (accuracy >= 0.90f) RankGrade = "A+";
            else if (accuracy >= 0.80f) RankGrade = "A";
            else if (accuracy >= 0.70f) RankGrade = "B";
            else if (accuracy >= 0.60f) RankGrade = "C";
            else RankGrade = "D";
        }
    }
}
