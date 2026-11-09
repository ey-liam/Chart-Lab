/**
 * Chart-Lab - Multi-Instrument & Multi-Difficulty Charter Engine
 * Comprehensive support for all standard rhythm game instrument layouts:
 * - 5-Fret Standard: Lead Guitar, Bass, Rhythm Guitar, Guitar Coop, Keys
 * - 6-Fret Guitar Hero Live (GHL): Lead GHL, Bass GHL, Rhythm GHL, Coop GHL
 * - 4-Lane / Pro Drums: Kick, Snare, Hi-Hat/Tom, Ride/Tom, Crash/Floor + Cymbal Markers (64, 65, 66)
 * - 5-Lane Guitar Hero Drums: Kick, Snare, Hi-Hat, Mid Tom, Ride, Floor Tom
 * - 4-Panel Dance: Left, Down, Up, Right (DDR / Phase Shift style)
 * - Pro Keys: Full range pitch mapping
 * - Vocal Harmonies: Lead Vocals, Harmony 1, Harmony 2, Harmony 3
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CharterEngine = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // Instrument metadata catalog
    const INSTRUMENTS = {
        guitar: { name: 'Lead Guitar (5 Frets)', group: 'fretted', standard: 'diff_guitar', header: 'Single' },
        guitarghl: { name: 'Lead Guitar GHL (6 Frets)', group: 'ghl', standard: 'diff_guitarghl', header: 'GHLGuitar' },
        bass: { name: 'Bass Guitar (5 Frets)', group: 'fretted', standard: 'diff_bass', header: 'DoubleBass' },
        bassghl: { name: 'Bass GHL (6 Frets)', group: 'ghl', standard: 'diff_bassghl', header: 'GHLBass' },
        rhythm: { name: 'Rhythm Guitar (5 Frets)', group: 'fretted', standard: 'diff_rhythm', header: 'Rhythm' },
        rhythmghl: { name: 'Rhythm GHL (6 Frets)', group: 'ghl', standard: 'diff_rhythmghl', header: 'GHLRhythm' },
        guitar_coop: { name: 'Guitar Coop (5 Frets)', group: 'fretted', standard: 'diff_guitar_coop', header: 'GuitarCoop' },
        guitar_coop_ghl: { name: 'Guitar Coop GHL (6 Frets)', group: 'ghl', standard: 'diff_guitar_coop_ghl', header: 'GHLCoop' },
        drums: { name: 'Drums / Pro Drums (4-Lane)', group: 'drums', standard: 'diff_drums', header: 'Drums' },
        drums_5lane: { name: 'Drums (5-Lane GH)', group: 'drums_5lane', standard: 'diff_drums', header: 'DoubleDrums' },
        keys: { name: 'Keys (5 Frets)', group: 'fretted', standard: 'diff_keys', header: 'Keyboard' },
        keys_real: { name: 'Pro Keys (Full Keyboard)', group: 'fretted', standard: 'diff_keys_real', header: 'Keyboard' },
        dance: { name: 'Dance Pad (4 Panels)', group: 'dance', standard: 'diff_dance', header: 'Dance' },
        vocals: { name: 'Lead Vocals', group: 'vocals', standard: 'diff_vocals', header: 'Vocals' },
        vocals_harm1: { name: 'Vocal Harmony 1', group: 'vocals', standard: 'diff_vocals_harm', header: 'Harm1' },
        vocals_harm2: { name: 'Vocal Harmony 2', group: 'vocals', standard: 'diff_vocals_harm', header: 'Harm2' },
        vocals_harm3: { name: 'Vocal Harmony 3', group: 'vocals', standard: 'diff_vocals_harm', header: 'Harm3' }
    };

    // Auto-detect recommended instrument mapping from MIDI tracks
    function autoAssignTracks(tracks) {
        const assignments = {
            guitar: [],
            guitarghl: [],
            bass: [],
            bassghl: [],
            drums: [],
            drums_5lane: [],
            keys: [],
            keys_real: [],
            rhythm: [],
            rhythmghl: [],
            guitar_coop: [],
            guitar_coop_ghl: [],
            vocals: [],
            vocals_harm1: [],
            vocals_harm2: [],
            vocals_harm3: [],
            dance: []
        };

        const vocalTracksFound = [];
        const guitarTracksFound = [];

        tracks.forEach(track => {
            const name = (track.name || '').toLowerCase();
            const inst = (track.instrumentName || '').toLowerCase();
            const chan = track.channel;

            if (track.notes.length === 0) return;

            // Drums / Percussion
            if (track.isPercussion || chan === 9 || name.includes('drum') || name.includes('perc') || inst.includes('drum')) {
                if (name.includes('5lane') || name.includes('gh drum')) {
                    assignments.drums_5lane.push(track.id);
                } else {
                    assignments.drums.push(track.id);
                }
            }
            // Bass
            else if (name.includes('bass') || inst.includes('bass')) {
                if (name.includes('ghl') || name.includes('6-fret')) {
                    assignments.bassghl.push(track.id);
                } else {
                    assignments.bass.push(track.id);
                }
            }
            // Vocal / Voice / Choir
            else if (name.includes('voice') || name.includes('vocal') || name.includes('sing') || name.includes('choir') || inst.includes('choir') || inst.includes('voice')) {
                vocalTracksFound.push(track.id);
            }
            // Dance / Step
            else if (name.includes('dance') || name.includes('step')) {
                assignments.dance.push(track.id);
            }
            // Keys / Piano / Organ / Synth
            else if (name.includes('piano') || name.includes('key') || name.includes('organ') || name.includes('synth') || inst.includes('piano') || inst.includes('organ')) {
                if (name.includes('pro key')) {
                    assignments.keys_real.push(track.id);
                } else {
                    assignments.keys.push(track.id);
                }
            }
            // Guitar
            else if (name.includes('guitar') || inst.includes('guitar')) {
                guitarTracksFound.push({ id: track.id, name, notesCount: track.notes.length });
            }
            // Melody / Lead instruments
            else if (name.includes('lead') || name.includes('solo') || name.includes('oboe') || name.includes('flute') || name.includes('sax') || name.includes('trumpet')) {
                guitarTracksFound.push({ id: track.id, name, notesCount: track.notes.length });
            }
            // Strings / Pad / Backing
            else if (name.includes('string') || inst.includes('string') || name.includes('pad')) {
                assignments.rhythm.push(track.id);
            }
        });

        // Distribute Vocal tracks between Lead and Harmonies
        if (vocalTracksFound.length > 0) {
            assignments.vocals.push(vocalTracksFound[0]);
            if (vocalTracksFound.length > 1) assignments.vocals_harm1.push(vocalTracksFound[1]);
            if (vocalTracksFound.length > 2) assignments.vocals_harm2.push(vocalTracksFound[2]);
            if (vocalTracksFound.length > 3) assignments.vocals_harm3.push(vocalTracksFound[3]);
        }

        // Distribute Guitars (Lead, Rhythm, Coop, GHL)
        if (guitarTracksFound.length > 0) {
            guitarTracksFound.forEach((g, index) => {
                if (g.name.includes('ghl') || g.name.includes('6-fret')) {
                    assignments.guitarghl.push(g.id);
                } else if (g.name.includes('rhythm') || g.name.includes('ritm')) {
                    assignments.rhythm.push(g.id);
                } else if (g.name.includes('coop')) {
                    assignments.guitar_coop.push(g.id);
                } else if (index === 0 && assignments.guitar.length === 0) {
                    assignments.guitar.push(g.id);
                } else if (assignments.rhythm.length === 0) {
                    assignments.rhythm.push(g.id);
                } else {
                    assignments.guitar_coop.push(g.id);
                }
            });
        }

        // Fallbacks if nothing assigned to guitar
        if (assignments.guitar.length === 0) {
            const sorted = [...tracks]
                .filter(t => !assignments.drums.includes(t.id) && !assignments.bass.includes(t.id) && t.notes.length > 0)
                .sort((a, b) => b.notes.length - a.notes.length);
            if (sorted.length > 0) assignments.guitar.push(sorted[0].id);
        }

        return assignments;
    }

    // Default algorithm parameters
    const DEFAULT_CONFIGS = {
        guitar: {
            frets: 5,
            maxChordSize: 2,
            allowOpenNotes: false,
            openNoteThreshold: 40,
            chordToleranceTicks: 15,
            minSustainQuarterBeats: 0.5,
            sustainGapQuarterBeats: 0.125,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        guitarghl: {
            frets: 6,
            maxChordSize: 2,
            allowOpenNotes: true,
            openNoteThreshold: 40,
            chordToleranceTicks: 15,
            minSustainQuarterBeats: 0.5,
            sustainGapQuarterBeats: 0.125,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        bass: {
            frets: 5,
            maxChordSize: 1,
            allowOpenNotes: true,
            openNoteThreshold: 35,
            chordToleranceTicks: 15,
            minSustainQuarterBeats: 0.5,
            sustainGapQuarterBeats: 0.125,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        bassghl: {
            frets: 6,
            maxChordSize: 1,
            allowOpenNotes: true,
            openNoteThreshold: 35,
            chordToleranceTicks: 15,
            minSustainQuarterBeats: 0.5,
            sustainGapQuarterBeats: 0.125,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        rhythm: {
            frets: 5,
            maxChordSize: 3,
            allowOpenNotes: false,
            openNoteThreshold: 40,
            chordToleranceTicks: 20,
            minSustainQuarterBeats: 0.75,
            sustainGapQuarterBeats: 0.125,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        rhythmghl: {
            frets: 6,
            maxChordSize: 3,
            allowOpenNotes: true,
            openNoteThreshold: 40,
            chordToleranceTicks: 20,
            minSustainQuarterBeats: 0.75,
            sustainGapQuarterBeats: 0.125,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        guitar_coop: {
            frets: 5,
            maxChordSize: 2,
            allowOpenNotes: false,
            openNoteThreshold: 40,
            chordToleranceTicks: 15,
            minSustainQuarterBeats: 0.5,
            sustainGapQuarterBeats: 0.125,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        guitar_coop_ghl: {
            frets: 6,
            maxChordSize: 2,
            allowOpenNotes: true,
            openNoteThreshold: 40,
            chordToleranceTicks: 15,
            minSustainQuarterBeats: 0.5,
            sustainGapQuarterBeats: 0.125,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        keys: {
            frets: 5,
            maxChordSize: 3,
            allowOpenNotes: false,
            openNoteThreshold: 40,
            chordToleranceTicks: 15,
            minSustainQuarterBeats: 0.5,
            sustainGapQuarterBeats: 0.125,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        keys_real: {
            frets: 25,
            maxChordSize: 4,
            allowOpenNotes: false,
            openNoteThreshold: 40,
            chordToleranceTicks: 15,
            minSustainQuarterBeats: 0.5,
            sustainGapQuarterBeats: 0.125,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        drums: {
            enableCymbals: true,
            enableDoubleBass: false,
            chordToleranceTicks: 12,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        drums_5lane: {
            chordToleranceTicks: 12,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        },
        dance: {
            panels: 4,
            chordToleranceTicks: 15,
            generateDifficulties: ['Expert', 'Hard', 'Medium', 'Easy']
        }
    };

    /**
     * Clusters notes into chord groups based on tick proximity
     */
    function clusterNotes(notes, toleranceTicks = 15) {
        if (!notes || notes.length === 0) return [];
        const sorted = [...notes].sort((a, b) => a.tick - b.tick || a.midi - b.midi);
        const clusters = [];
        let current = null;

        for (let n of sorted) {
            if (!current || (n.tick - current.tick) > toleranceTicks) {
                current = { tick: n.tick, notes: [n] };
                clusters.push(current);
            } else {
                current.notes.push(n);
            }
        }
        return clusters;
    }

    /**
     * Decimates notes based on minimum beat intervals for lower difficulties
     */
    function decimateNotes(notes, ppq, minBeatFraction) {
        if (!notes || notes.length === 0) return [];
        const minTickInterval = Math.round(ppq * minBeatFraction * 4);
        const sorted = [...notes].sort((a, b) => a.tick - b.tick);
        const result = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const last = result[result.length - 1];
            if (sorted[i].tick - last.tick >= minTickInterval) {
                result.push(sorted[i]);
            }
        }
        return result;
    }

    /**
     * Charts fretted 5-lane instruments (Lead, Bass, Rhythm, Coop, Keys)
     */
    function chartFrettedTrack(rawNotes, ppq, difficulty = 'Expert', userConfig = {}) {
        const config = Object.assign({}, DEFAULT_CONFIGS.guitar, userConfig);
        const maxFrets = difficulty === 'Easy' ? 3 : (difficulty === 'Medium' ? 4 : config.frets);
        const maxChords = difficulty === 'Easy' ? 1 : (difficulty === 'Medium' ? 1 : config.maxChordSize);
        const style = userConfig.style || 'balanced';
        let effMaxChords = maxChords;
        if (style === 'melodic') effMaxChords = Math.min(1, maxChords);
        else if (style === 'rhythmic' && difficulty !== 'Easy') effMaxChords = Math.max(2, maxChords);

        const density = userConfig.density !== undefined ? userConfig.density : 1.0;
        const minSustainTicks = Math.round(ppq * config.minSustainQuarterBeats);
        // Enforce 70ms sustain gap rule from official CSC & Wagsii guidelines
        const sustainGapTicks = Math.max(Math.round(ppq * 0.14), Math.round(ppq * (config.sustainGapQuarterBeats || 0.125)));

        let filteredNotes = [...rawNotes];
        if (density < 0.9) {
            filteredNotes = filteredNotes.filter((_, idx) => (idx % Math.round(1 / density)) === 0);
        }
        if (difficulty === 'Hard') filteredNotes = decimateNotes(filteredNotes, ppq, 1 / 16);
        else if (difficulty === 'Medium') filteredNotes = decimateNotes(filteredNotes, ppq, 1 / 8);
        else if (difficulty === 'Easy') filteredNotes = decimateNotes(filteredNotes, ppq, 1 / 4);

        const clusters = clusterNotes(filteredNotes, config.chordToleranceTicks);
        if (clusters.length === 0) return [];

        const pitches = filteredNotes.map(n => n.midi);
        const minPitch = Math.min(...pitches);
        const maxPitch = Math.max(...pitches);
        const pitchRange = Math.max(1, maxPitch - minPitch);

        const chartedEvents = [];
        let prevFret = 0;
        let prevPitch = minPitch;

        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];
            const nextCluster = clusters[i + 1];

            const distinctPitches = [...new Set(cluster.notes.map(n => n.midi))].sort((a, b) => a - b);
            const avgDurationTicks = Math.round(cluster.notes.reduce((sum, n) => sum + n.durationTicks, 0) / cluster.notes.length);

            let sustainLength = 0;
            if (avgDurationTicks >= minSustainTicks) {
                sustainLength = Math.max(0, avgDurationTicks - sustainGapTicks);
                if (nextCluster && (cluster.tick + sustainLength) >= nextCluster.tick) {
                    sustainLength = Math.max(0, nextCluster.tick - cluster.tick - sustainGapTicks);
                }
            }

            const lowestPitch = distinctPitches[0];
            // Open notes are only allowed on Expert (CSC Rule)
            const isOpenNote = (difficulty === 'Expert') && config.allowOpenNotes && lowestPitch <= config.openNoteThreshold;

            if (isOpenNote) {
                chartedEvents.push({ tick: cluster.tick, fret: 7, sustain: sustainLength, isChord: false });
                prevFret = 0;
                prevPitch = lowestPitch;
                continue;
            }

            if (distinctPitches.length === 1 || effMaxChords === 1) {
                const pitch = distinctPitches[distinctPitches.length - 1];
                let fret = Math.round(((pitch - minPitch) / pitchRange) * (maxFrets - 1));
                fret = Math.max(0, Math.min(maxFrets - 1, fret));

                if (pitch > prevPitch && fret < prevFret) fret = Math.min(maxFrets - 1, prevFret + 1);
                else if (pitch < prevPitch && fret > prevFret) fret = Math.max(0, prevFret - 1);

                chartedEvents.push({ tick: cluster.tick, fret: fret, sustain: sustainLength, isChord: false });
                prevFret = fret;
                prevPitch = pitch;
            } else {
                const selectedPitches = distinctPitches.slice(0, effMaxChords);
                let frets = [];
                for (let p of selectedPitches) {
                    let f = Math.round(((p - minPitch) / pitchRange) * (maxFrets - 1));
                    frets.push(Math.max(0, Math.min(maxFrets - 1, f)));
                }
                frets = [...new Set(frets)].sort((a, b) => a - b);
                if (frets.length === 1 && selectedPitches.length > 1) {
                    if (frets[0] < maxFrets - 1) frets.push(frets[0] + 1);
                    else frets.unshift(frets[0] - 1);
                }

                for (let f of frets) {
                    chartedEvents.push({ tick: cluster.tick, fret: f, sustain: sustainLength, isChord: true });
                }
                prevFret = frets[frets.length - 1];
                prevPitch = selectedPitches[selectedPitches.length - 1];
            }
        }

        // Star Power intervals
        const starPowerInterval = ppq * 32;
        let lastSpTick = -starPowerInterval;
        for (let ev of chartedEvents) {
            if (ev.tick - lastSpTick >= starPowerInterval) {
                ev.starPower = { tick: ev.tick, duration: ppq * 4 };
                lastSpTick = ev.tick;
            }
        }

        return chartedEvents;
    }

    /**
     * Charts 6-fret Guitar Hero Live (GHL) instruments
     * Standard Moonscraper GHL notes:
     * 0 = Open strum
     * 1 = White 1 (fret 1 bottom)
     * 2 = White 2 (fret 2 bottom)
     * 3 = White 3 (fret 3 bottom)
     * 4 = Black 1 (fret 1 top)
     * 7 = Black 2 (fret 2 top)
     * 8 = Black 3 (fret 3 top)
     */
    function chartGHLTrack(rawNotes, ppq, difficulty = 'Expert', userConfig = {}) {
        const config = Object.assign({}, DEFAULT_CONFIGS.guitarghl, userConfig);
        const minSustainTicks = Math.round(ppq * config.minSustainQuarterBeats);
        const sustainGapTicks = Math.round(ppq * config.sustainGapQuarterBeats);

        let filteredNotes = [...rawNotes];
        if (difficulty === 'Hard') filteredNotes = decimateNotes(rawNotes, ppq, 1 / 16);
        else if (difficulty === 'Medium') filteredNotes = decimateNotes(rawNotes, ppq, 1 / 8);
        else if (difficulty === 'Easy') filteredNotes = decimateNotes(rawNotes, ppq, 1 / 4);

        const clusters = clusterNotes(filteredNotes, config.chordToleranceTicks);
        if (clusters.length === 0) return [];

        const pitches = filteredNotes.map(n => n.midi);
        const minPitch = Math.min(...pitches);
        const maxPitch = Math.max(...pitches);
        const pitchRange = Math.max(1, maxPitch - minPitch);

        // Moonscraper standard GHL fret codes
        const GHL_FRETS_ALL = [1, 2, 3, 4, 7, 8];
        const GHL_EASY_FRETS = [1, 2]; // White 1 & White 2
        const GHL_MED_FRETS = [1, 2, 3, 4]; // White 1-3 & Black 1

        const chartedEvents = [];

        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];
            const nextCluster = clusters[i + 1];

            const distinctPitches = [...new Set(cluster.notes.map(n => n.midi))].sort((a, b) => a - b);
            const avgDurationTicks = Math.round(cluster.notes.reduce((sum, n) => sum + n.durationTicks, 0) / cluster.notes.length);

            let sustainLength = 0;
            if (avgDurationTicks >= minSustainTicks) {
                sustainLength = Math.max(0, avgDurationTicks - sustainGapTicks);
                if (nextCluster && (cluster.tick + sustainLength) >= nextCluster.tick) {
                    sustainLength = Math.max(0, nextCluster.tick - cluster.tick - sustainGapTicks);
                }
            }

            const lowestPitch = distinctPitches[0];
            const isOpenNote = config.allowOpenNotes && lowestPitch <= config.openNoteThreshold;

            if (isOpenNote) {
                chartedEvents.push({ tick: cluster.tick, fret: 0, sustain: sustainLength, isChord: false, isGHL: true });
                continue;
            }

            let pool = GHL_FRETS_ALL;
            if (difficulty === 'Easy') pool = GHL_EASY_FRETS;
            else if (difficulty === 'Medium') pool = GHL_MED_FRETS;

            if (distinctPitches.length === 1 || difficulty === 'Easy' || difficulty === 'Medium') {
                const pitch = distinctPitches[distinctPitches.length - 1];
                const normalized = (pitch - minPitch) / pitchRange;
                const idx = Math.min(pool.length - 1, Math.floor(normalized * pool.length));
                const fret = pool[idx];

                chartedEvents.push({ tick: cluster.tick, fret: fret, sustain: sustainLength, isChord: false, isGHL: true });
            } else {
                // Chord: e.g. Barre chord (White 1 + Black 1) or Two adjacent
                const p1 = distinctPitches[0];
                const p2 = distinctPitches[distinctPitches.length - 1];
                const norm1 = (p1 - minPitch) / pitchRange;
                const norm2 = (p2 - minPitch) / pitchRange;

                let f1 = pool[Math.min(pool.length - 1, Math.floor(norm1 * pool.length))];
                let f2 = pool[Math.min(pool.length - 1, Math.floor(norm2 * pool.length))];
                if (f1 === f2) {
                    // Turn into barre chord (White + Black pair)
                    if (f1 === 1) f2 = 4;
                    else if (f1 === 2) f2 = 7;
                    else if (f1 === 3) f2 = 8;
                    else f2 = 1;
                }

                chartedEvents.push({ tick: cluster.tick, fret: f1, sustain: sustainLength, isChord: true, isGHL: true });
                chartedEvents.push({ tick: cluster.tick, fret: f2, sustain: sustainLength, isChord: true, isGHL: true });
            }
        }

        // Star Power intervals
        const starPowerInterval = ppq * 32;
        let lastSpTick = -starPowerInterval;
        for (let ev of chartedEvents) {
            if (ev.tick - lastSpTick >= starPowerInterval) {
                ev.starPower = { tick: ev.tick, duration: ppq * 4 };
                lastSpTick = ev.tick;
            }
        }

        return chartedEvents;
    }

    /**
     * Charts 4-lane / Pro Drums with automated cymbal detection (64, 65, 66)
     */
    function chartDrumTrack(rawNotes, ppq, difficulty = 'Expert', userConfig = {}) {
        const config = Object.assign({}, DEFAULT_CONFIGS.drums, userConfig);
        let filtered = [...rawNotes];

        if (difficulty === 'Hard') filtered = decimateNotes(rawNotes, ppq, 1 / 16);
        else if (difficulty === 'Medium') filtered = decimateNotes(rawNotes, ppq, 1 / 8);
        else if (difficulty === 'Easy') filtered = decimateNotes(rawNotes, ppq, 1 / 4);

        const hits = clusterNotes(filtered, config.chordToleranceTicks);
        const drumEvents = [];

        for (let h of hits) {
            const pads = new Set();
            const cymbals = new Set();

            for (let n of h.notes) {
                const p = n.midi;
                // Kick drum
                if (p === 35 || p === 36) {
                    pads.add(0);
                }
                // Snare
                else if (p === 38 || p === 40 || p === 37 || p === 39) {
                    pads.add(1);
                }
                // Hi-Hat
                else if (p === 42 || p === 44 || p === 46) {
                    pads.add(2);
                    if (config.enableCymbals) cymbals.add(64);
                }
                // High Toms
                else if (p === 48 || p === 50) {
                    pads.add(2);
                }
                // Mid Toms
                else if (p === 45 || p === 47) {
                    pads.add(3);
                }
                // Ride Cymbal
                else if (p === 51 || p === 59 || p === 53) {
                    pads.add(3);
                    if (config.enableCymbals) cymbals.add(65);
                }
                // Low / Floor Toms
                else if (p === 41 || p === 43) {
                    pads.add(4);
                }
                // Crash Cymbals
                else if (p === 49 || p === 52 || p === 55 || p === 57) {
                    pads.add(4);
                    if (config.enableCymbals) cymbals.add(66);
                } else {
                    pads.add(2);
                }
            }

            if (difficulty === 'Easy' && pads.has(0) && pads.has(1)) {
                pads.delete(0);
            }

            for (let pad of pads) {
                drumEvents.push({ tick: h.tick, fret: pad, sustain: 0, isDrum: true });
            }
            for (let cym of cymbals) {
                drumEvents.push({ tick: h.tick, fret: cym, sustain: 0, isCymbalMarker: true });
            }
        }

        const starPowerInterval = ppq * 32;
        let lastSpTick = -starPowerInterval;
        for (let ev of drumEvents) {
            if (ev.tick - lastSpTick >= starPowerInterval && !ev.isCymbalMarker) {
                ev.starPower = { tick: ev.tick, duration: ppq * 4 };
                lastSpTick = ev.tick;
            }
        }

        return drumEvents;
    }

    /**
     * Charts 5-lane Guitar Hero Drums
     * 0 = Kick (orange line / foot pedal)
     * 1 = Red (Snare)
     * 2 = Yellow (Hi-Hat cymbal)
     * 3 = Blue (Tom)
     * 4 = Orange (Ride cymbal)
     * 5 = Green (Floor tom / Crash)
     */
    function chart5LaneDrumTrack(rawNotes, ppq, difficulty = 'Expert', userConfig = {}) {
        const config = Object.assign({}, DEFAULT_CONFIGS.drums_5lane, userConfig);
        let filtered = [...rawNotes];

        if (difficulty === 'Hard') filtered = decimateNotes(rawNotes, ppq, 1 / 16);
        else if (difficulty === 'Medium') filtered = decimateNotes(rawNotes, ppq, 1 / 8);
        else if (difficulty === 'Easy') filtered = decimateNotes(rawNotes, ppq, 1 / 4);

        const hits = clusterNotes(filtered, config.chordToleranceTicks);
        const drumEvents = [];

        for (let h of hits) {
            const pads = new Set();
            for (let n of h.notes) {
                const p = n.midi;
                if (p === 35 || p === 36) pads.add(0); // Kick
                else if (p === 38 || p === 40 || p === 37) pads.add(1); // Red snare
                else if (p === 42 || p === 44 || p === 46) pads.add(2); // Yellow hihat
                else if (p === 48 || p === 50 || p === 45) pads.add(3); // Blue tom
                else if (p === 51 || p === 59 || p === 53) pads.add(4); // Orange cymbal
                else if (p === 49 || p === 52 || p === 41 || p === 43) pads.add(5); // Green crash/floor
                else pads.add(2);
            }

            if (difficulty === 'Easy' && pads.has(0) && pads.has(1)) pads.delete(0);

            for (let pad of pads) {
                drumEvents.push({ tick: h.tick, fret: pad, sustain: 0, isDrum: true, is5Lane: true });
            }
        }

        return drumEvents;
    }

    /**
     * Charts 4-panel Dance (Left, Down, Up, Right)
     * 0 = Left, 1 = Down, 2 = Up, 3 = Right
     */
    function chartDanceTrack(rawNotes, ppq, difficulty = 'Expert', userConfig = {}) {
        const config = Object.assign({}, DEFAULT_CONFIGS.dance, userConfig);
        let filtered = [...rawNotes];

        if (difficulty === 'Hard') filtered = decimateNotes(rawNotes, ppq, 1 / 16);
        else if (difficulty === 'Medium') filtered = decimateNotes(rawNotes, ppq, 1 / 8);
        else if (difficulty === 'Easy') filtered = decimateNotes(rawNotes, ppq, 1 / 4);

        const hits = clusterNotes(filtered, config.chordToleranceTicks);
        const danceEvents = [];

        for (let i = 0; i < hits.length; i++) {
            const h = hits[i];
            const avgPitch = h.notes.reduce((sum, n) => sum + n.midi, 0) / h.notes.length;
            // Map alternating steps and pitch direction
            let panel = (Math.floor(avgPitch) + i) % 4;
            danceEvents.push({ tick: h.tick, fret: panel, sustain: 0, isDance: true });
        }

        return danceEvents;
    }

    /**
     * Builds the complete set of charted tracks for all assigned instruments
     */
    function buildAllCharts(midiData, trackAssignments, configs = {}) {
        const result = {};
        const ppq = midiData.ppq || 480;

        for (let inst in trackAssignments) {
            const trackIds = trackAssignments[inst] || [];
            if (trackIds.length === 0) continue;

            // Merge notes from all assigned tracks
            let combinedNotes = [];
            trackIds.forEach(id => {
                const trk = midiData.tracks.find(t => t.id === id);
                if (trk && trk.notes) {
                    combinedNotes = combinedNotes.concat(trk.notes);
                }
            });

            if (combinedNotes.length === 0) continue;
            combinedNotes.sort((a, b) => a.tick - b.tick);

            const instConfig = Object.assign({}, DEFAULT_CONFIGS[inst] || DEFAULT_CONFIGS.guitar, configs[inst]);
            const difficulties = instConfig.generateDifficulties || ['Expert', 'Hard', 'Medium', 'Easy'];

            result[inst] = {};

            for (let diff of difficulties) {
                if (inst === 'drums') {
                    result[inst][diff] = chartDrumTrack(combinedNotes, ppq, diff, instConfig);
                } else if (inst === 'drums_5lane') {
                    result[inst][diff] = chart5LaneDrumTrack(combinedNotes, ppq, diff, instConfig);
                } else if (inst === 'guitarghl' || inst === 'bassghl' || inst === 'rhythmghl' || inst === 'guitar_coop_ghl') {
                    result[inst][diff] = chartGHLTrack(combinedNotes, ppq, diff, instConfig);
                } else if (inst === 'dance') {
                    result[inst][diff] = chartDanceTrack(combinedNotes, ppq, diff, instConfig);
                } else if (!inst.startsWith('vocals')) {
                    result[inst][diff] = chartFrettedTrack(combinedNotes, ppq, diff, instConfig);
                }
            }
        }

        return result;
    }

    return {
        INSTRUMENTS,
        autoAssignTracks,
        chartFrettedTrack,
        chartGHLTrack,
        chartDrumTrack,
        chart5LaneDrumTrack,
        chartDanceTrack,
        buildAllCharts,
        clusterNotes,
        DEFAULT_CONFIGS
    };
}));
