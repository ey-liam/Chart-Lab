/**
 * MIDI-CH Studio Pro - Advanced Multi-Instrument & Multi-Difficulty Charter Engine
 * Maps MIDI note data into playable Clone Hero / YARG charts for:
 * Lead Guitar, Bass Guitar, Rhythm Guitar, Keys, and 4-Lane / Pro Drums.
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

    // Auto-detect recommended instrument mapping from MIDI tracks
    function autoAssignTracks(tracks) {
        const assignments = {
            guitar: [],
            bass: [],
            drums: [],
            keys: [],
            rhythm: [],
            vocals: []
        };

        tracks.forEach(track => {
            const name = (track.name || '').toLowerCase();
            const inst = (track.instrumentName || '').toLowerCase();
            const chan = track.channel;

            if (track.notes.length === 0) return;

            // Drums
            if (track.isPercussion || chan === 9 || name.includes('drum') || name.includes('perc') || inst.includes('drum')) {
                assignments.drums.push(track.id);
            }
            // Bass
            else if (name.includes('bass') || inst.includes('bass')) {
                assignments.bass.push(track.id);
            }
            // Vocal / Voice
            else if (name.includes('voice') || name.includes('vocal') || name.includes('sing') || name.includes('choir') || inst.includes('choir') || inst.includes('voice')) {
                assignments.vocals.push(track.id);
            }
            // Guitar
            else if (name.includes('guitar') || inst.includes('guitar')) {
                if (name.includes('rhythm') || name.includes('ritm')) {
                    assignments.rhythm.push(track.id);
                } else {
                    assignments.guitar.push(track.id);
                }
            }
            // Keys / Piano / Organ / Synth
            else if (name.includes('piano') || name.includes('key') || name.includes('organ') || name.includes('synth') || inst.includes('piano') || inst.includes('organ')) {
                assignments.keys.push(track.id);
            }
            // Melody / Lead
            else if (name.includes('lead') || name.includes('solo') || name.includes('oboe') || name.includes('flute') || name.includes('sax') || name.includes('trumpet')) {
                if (assignments.guitar.length === 0) {
                    assignments.guitar.push(track.id);
                } else {
                    assignments.rhythm.push(track.id);
                }
            }
            // Strings / Pad / Backing
            else if (name.includes('string') || inst.includes('string')) {
                assignments.rhythm.push(track.id);
            }
        });

        // Fallbacks if nothing assigned to guitar
        if (assignments.guitar.length === 0) {
            // Find track with highest note count that isn't drums or bass
            const sorted = [...tracks]
                .filter(t => !assignments.drums.includes(t.id) && !assignments.bass.includes(t.id) && t.notes.length > 0)
                .sort((a, b) => b.notes.length - a.notes.length);
            if (sorted.length > 0) assignments.guitar.push(sorted[0].id);
        }

        return assignments;
    }

    // Default configuration for each instrument type
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
        drums: {
            enableCymbals: true,
            enableDoubleBass: false,
            chordToleranceTicks: 12,
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
     * Charts fretted instrument (Guitar, Bass, Keys, Rhythm) for a specific difficulty
     */
    function chartFrettedTrack(rawNotes, ppq, difficulty = 'Expert', userConfig = {}) {
        const config = Object.assign({}, DEFAULT_CONFIGS.guitar, userConfig);
        const maxFrets = difficulty === 'Easy' ? 3 : (difficulty === 'Medium' ? 4 : config.frets);
        const maxChords = difficulty === 'Easy' ? 1 : (difficulty === 'Medium' ? 1 : config.maxChordSize);
        const minSustainTicks = Math.round(ppq * config.minSustainQuarterBeats);
        const sustainGapTicks = Math.round(ppq * config.sustainGapQuarterBeats);

        // Filter / decimate for lower difficulties
        let filteredNotes = [...rawNotes];
        if (difficulty === 'Hard') {
            // Keep roughly 80% notes, thinning out very fast bursts
            filteredNotes = decimateNotes(rawNotes, ppq, 1 / 16);
        } else if (difficulty === 'Medium') {
            // Keep mostly 8th and quarter notes
            filteredNotes = decimateNotes(rawNotes, ppq, 1 / 8);
        } else if (difficulty === 'Easy') {
            // Keep mostly quarter and half notes
            filteredNotes = decimateNotes(rawNotes, ppq, 1 / 4);
        }

        const clusters = clusterNotes(filteredNotes, config.chordToleranceTicks);
        if (clusters.length === 0) return [];

        // Global pitch range
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

            // Unique pitches in chord
            const distinctPitches = [...new Set(cluster.notes.map(n => n.midi))].sort((a, b) => a - b);
            const avgDurationTicks = Math.round(cluster.notes.reduce((sum, n) => sum + n.durationTicks, 0) / cluster.notes.length);

            // Compute sustain length
            let sustainLength = 0;
            if (avgDurationTicks >= minSustainTicks) {
                sustainLength = Math.max(0, avgDurationTicks - sustainGapTicks);
                // Ensure sustain doesn't overrun the next note
                if (nextCluster && (cluster.tick + sustainLength) >= nextCluster.tick) {
                    sustainLength = Math.max(0, nextCluster.tick - cluster.tick - sustainGapTicks);
                }
            }

            // Check for Open Note (7)
            const lowestPitch = distinctPitches[0];
            const isOpenNote = config.allowOpenNotes && lowestPitch <= config.openNoteThreshold;

            if (isOpenNote) {
                chartedEvents.push({
                    tick: cluster.tick,
                    fret: 7, // Open note
                    sustain: sustainLength,
                    isChord: false
                });
                prevFret = 0;
                prevPitch = lowestPitch;
                continue;
            }

            if (distinctPitches.length === 1 || maxChords === 1) {
                // Single Note
                const pitch = distinctPitches[distinctPitches.length - 1]; // take highest if single
                let fret = Math.round(((pitch - minPitch) / pitchRange) * (maxFrets - 1));
                fret = Math.max(0, Math.min(maxFrets - 1, fret));

                // Melodic direction smoothing
                if (pitch > prevPitch && fret < prevFret) {
                    fret = Math.min(maxFrets - 1, prevFret + 1);
                } else if (pitch < prevPitch && fret > prevFret) {
                    fret = Math.max(0, prevFret - 1);
                }

                chartedEvents.push({
                    tick: cluster.tick,
                    fret: fret,
                    sustain: sustainLength,
                    isChord: false
                });

                prevFret = fret;
                prevPitch = pitch;
            } else {
                // Chord: Select up to maxChords pitches
                const selectedPitches = distinctPitches.slice(0, maxChords);
                let frets = [];

                for (let p of selectedPitches) {
                    let f = Math.round(((p - minPitch) / pitchRange) * (maxFrets - 1));
                    f = Math.max(0, Math.min(maxFrets - 1, f));
                    frets.push(f);
                }
                frets = [...new Set(frets)].sort((a, b) => a - b);

                // If pitches were different but frets collapsed to the same fret, spread them
                if (frets.length === 1 && selectedPitches.length > 1) {
                    if (frets[0] < maxFrets - 1) frets.push(frets[0] + 1);
                    else frets.unshift(frets[0] - 1);
                }

                for (let f of frets) {
                    chartedEvents.push({
                        tick: cluster.tick,
                        fret: f,
                        sustain: sustainLength,
                        isChord: true
                    });
                }

                prevFret = frets[frets.length - 1];
                prevPitch = selectedPitches[selectedPitches.length - 1];
            }
        }

        // Add Star Power phrases every ~32 beats
        const starPowerInterval = ppq * 32;
        const starPowerDuration = ppq * 4;
        let lastSpTick = -starPowerInterval;

        for (let ev of chartedEvents) {
            if (ev.tick - lastSpTick >= starPowerInterval) {
                ev.starPower = {
                    tick: ev.tick,
                    duration: starPowerDuration
                };
                lastSpTick = ev.tick;
            }
        }

        return chartedEvents;
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
     * Charts 4-lane / Pro Drums for a specific difficulty
     */
    function chartDrumTrack(rawNotes, ppq, difficulty = 'Expert', userConfig = {}) {
        const config = Object.assign({}, DEFAULT_CONFIGS.drums, userConfig);
        let filtered = [...rawNotes];

        if (difficulty === 'Hard') {
            filtered = decimateNotes(rawNotes, ppq, 1 / 16);
        } else if (difficulty === 'Medium') {
            filtered = decimateNotes(rawNotes, ppq, 1 / 8);
        } else if (difficulty === 'Easy') {
            filtered = decimateNotes(rawNotes, ppq, 1 / 4);
        }

        const hits = clusterNotes(filtered, config.chordToleranceTicks);
        const drumEvents = [];

        for (let h of hits) {
            const pads = new Set();
            const cymbals = new Set();

            for (let n of h.notes) {
                const p = n.midi;
                // Kick drum
                if (p === 35 || p === 36) {
                    pads.add(0); // Kick
                }
                // Snare
                else if (p === 38 || p === 40 || p === 37 || p === 39) {
                    pads.add(1); // Red
                }
                // Hi-Hat
                else if (p === 42 || p === 44 || p === 46) {
                    pads.add(2); // Yellow
                    if (config.enableCymbals) cymbals.add(64); // Yellow cymbal marker
                }
                // High Toms
                else if (p === 48 || p === 50) {
                    pads.add(2); // Yellow tom pad
                }
                // Mid Toms
                else if (p === 45 || p === 47) {
                    pads.add(3); // Blue tom pad
                }
                // Ride Cymbal
                else if (p === 51 || p === 59 || p === 53) {
                    pads.add(3); // Blue
                    if (config.enableCymbals) cymbals.add(65); // Blue cymbal marker
                }
                // Low / Floor Toms
                else if (p === 41 || p === 43) {
                    pads.add(4); // Green tom pad
                }
                // Crash Cymbals
                else if (p === 49 || p === 52 || p === 55 || p === 57) {
                    pads.add(4); // Green
                    if (config.enableCymbals) cymbals.add(66); // Green cymbal marker
                }
                // Other percussion
                else {
                    pads.add(2);
                }
            }

            // Easy drum simplification: don't have kick and snare on the exact same hit
            if (difficulty === 'Easy' && pads.has(0) && pads.has(1)) {
                pads.delete(0);
            }

            for (let pad of pads) {
                drumEvents.push({
                    tick: h.tick,
                    fret: pad,
                    sustain: 0,
                    isDrum: true
                });
            }
            for (let cym of cymbals) {
                drumEvents.push({
                    tick: h.tick,
                    fret: cym,
                    sustain: 0,
                    isCymbalMarker: true
                });
            }
        }

        // Add Star Power
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
     * Builds the complete set of charted tracks for all assigned instruments
     */
    function buildAllCharts(midiData, trackAssignments, configs = {}) {
        const result = {};
        const ppq = midiData.ppq || 480;

        const instrumentTypes = ['guitar', 'bass', 'rhythm', 'keys', 'drums'];

        for (let inst of instrumentTypes) {
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

            const instConfig = Object.assign({}, DEFAULT_CONFIGS[inst], configs[inst]);
            const difficulties = instConfig.generateDifficulties || ['Expert', 'Hard', 'Medium', 'Easy'];

            result[inst] = {};

            for (let diff of difficulties) {
                if (inst === 'drums') {
                    result[inst][diff] = chartDrumTrack(combinedNotes, ppq, diff, instConfig);
                } else {
                    result[inst][diff] = chartFrettedTrack(combinedNotes, ppq, diff, instConfig);
                }
            }
        }

        return result;
    }

    return {
        autoAssignTracks,
        chartFrettedTrack,
        chartDrumTrack,
        buildAllCharts,
        clusterNotes,
        DEFAULT_CONFIGS
    };
}));
