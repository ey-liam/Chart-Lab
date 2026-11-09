/**
 * Chart-Lab - Motor de Generacion Multi-Instrumento y Calculo de Dificultades
 * Autor: Ey-Liam
 */
class CharterEngine {
    static INSTRUMENTS = {
        guitar: { id: 'guitar', chartSuffix: 'Single', label: 'Guitarra Lider (5 Trastes)', lanes: 5, isGhl: false },
        bass: { id: 'bass', chartSuffix: 'DoubleBass', label: 'Bajo (5 Trastes)', lanes: 5, isGhl: false },
        rhythm: { id: 'rhythm', chartSuffix: 'DoubleRhythm', label: 'Guitarra Ritmica (5 Trastes)', lanes: 5, isGhl: false },
        coop: { id: 'coop', chartSuffix: 'DoubleGuitar', label: 'Guitarra Cooperativa', lanes: 5, isGhl: false },
        ghl_guitar: { id: 'ghl_guitar', chartSuffix: 'GHLGuitar', label: 'Guitarra GHL (6 Trastes)', lanes: 6, isGhl: true },
        ghl_bass: { id: 'ghl_bass', chartSuffix: 'GHLBass', label: 'Bajo GHL (6 Trastes)', lanes: 6, isGhl: true },
        drums: { id: 'drums', chartSuffix: 'Drums', label: 'Bateria / Pro Drums', lanes: 5, isGhl: false },
        keys: { id: 'keys', chartSuffix: 'Keyboard', label: 'Teclados (5 Carriles)', lanes: 5, isGhl: false },
        vocals: { id: 'vocals', chartSuffix: 'Vocals', label: 'Voz Principal (Melodia)', lanes: 5, isGhl: false },
        harm1: { id: 'harm1', chartSuffix: 'Harmony1', label: 'Armonia Vocal 1', lanes: 5, isGhl: false },
        harm2: { id: 'harm2', chartSuffix: 'Harmony2', label: 'Armonia Vocal 2', lanes: 5, isGhl: false },
        harm3: { id: 'harm3', chartSuffix: 'Harmony3', label: 'Armonia Vocal 3', lanes: 5, isGhl: false },
        dance: { id: 'dance', chartSuffix: 'Dance', label: 'Pista de Baile (4 Paneles)', lanes: 4, isGhl: false }
    };

    static autoDetectInstrument(track, assignedSet) {
        const name = (track.name || '').toLowerCase();
        if (track.isPercussion || name.includes('drum') || name.includes('perc') || name.includes('bateria')) {
            if (!assignedSet.has('drums')) return 'drums';
        }
        if (name.includes('bass') || name.includes('bajo') || (track.maxPitch <= 55 && !track.isPercussion)) {
            if (!assignedSet.has('bass')) return 'bass';
        }
        if (name.includes('vox') || name.includes('vocal') || name.includes('voz') || name.includes('melod')) {
            if (!assignedSet.has('vocals')) return 'vocals';
            if (!assignedSet.has('harm1')) return 'harm1';
        }
        if (name.includes('key') || name.includes('piano') || name.includes('synth') || name.includes('organ')) {
            if (!assignedSet.has('keys')) return 'keys';
        }
        if (name.includes('rhythm') || name.includes('ritm')) {
            if (!assignedSet.has('rhythm')) return 'rhythm';
        }
        if (!assignedSet.has('guitar')) return 'guitar';
        if (!assignedSet.has('rhythm')) return 'rhythm';
        if (!assignedSet.has('keys')) return 'keys';
        return 'none';
    }

    static generateAllDifficulties(parsedMidi, trackAssignments, tuning) {
        const generated = {};
        const diffs = ['Expert', 'Hard', 'Medium', 'Easy'];

        Object.entries(trackAssignments).forEach(([trackIdStr, instKey]) => {
            if (!instKey || instKey === 'none' || !this.INSTRUMENTS[instKey]) return;
            const track = parsedMidi.tracks[parseInt(trackIdStr, 10)];
            if (!track || !track.notes.length) return;

            generated[instKey] = {};
            diffs.forEach(diff => {
                if (instKey === 'drums') {
                    generated[instKey][diff] = this.buildDrumsTrack(parsedMidi, track.notes, diff, tuning);
                } else if (instKey === 'dance') {
                    generated[instKey][diff] = this.buildFrettedTrack(parsedMidi, track.notes, diff, { ...tuning, frets: 4, maxChords: 2 }, instKey);
                } else {
                    generated[instKey][diff] = this.buildFrettedTrack(parsedMidi, track.notes, diff, tuning, instKey);
                }
            });
        });

        return generated;
    }

    static buildFrettedTrack(parsedMidi, rawNotes, difficulty, tuning, instKey) {
        const res = parsedMidi.resolution;
        const isGhl = instKey === 'ghl_guitar' || instKey === 'ghl_bass';

        // Reglas por dificultad basadas en estándares de la comunidad (CSC)
        const diffRules = {
            Expert: { maxFrets: isGhl ? 6 : parseInt(tuning.frets || 5, 10), maxChord: parseInt(tuning.maxChords || 3, 10), quantDiv: 16, densityMult: 1.0 },
            Hard:   { maxFrets: isGhl ? 6 : Math.min(5, parseInt(tuning.frets || 5, 10)), maxChord: Math.min(2, parseInt(tuning.maxChords || 2, 10)), quantDiv: 8, densityMult: 0.85 },
            Medium: { maxFrets: isGhl ? 4 : 4, maxChord: Math.min(2, parseInt(tuning.maxChords || 2, 10)), quantDiv: 4, densityMult: 0.65 },
            Easy:   { maxFrets: isGhl ? 3 : 3, maxChord: 1, quantDiv: 2, densityMult: 0.45 }
        }[difficulty];

        const gridTicks = Math.max(1, Math.round(res / diffRules.quantDiv));
        const userDensity = (parseInt(tuning.density || 100, 10) / 100) * diffRules.densityMult;

        // Agrupar notas por tick cuantizado
        const chordMap = new Map();
        rawNotes.forEach(n => {
            const qTick = Math.round(n.tick / gridTicks) * gridTicks;
            if (!chordMap.has(qTick)) chordMap.set(qTick, []);
            chordMap.get(qTick).push(n);
        });

        const sortedTicks = Array.from(chordMap.keys()).sort((a, b) => a - b);
        const hopoThreshold = Math.round(((parseInt(tuning.hopoThreshold || 65, 10)) / 192) * res);
        const minSustainTicks = Math.round(parseFloat(tuning.minSustain || 0.5) * res);
        const spEveryMeasures = parseInt(tuning.starPower || 16, 10);
        const allowOpen = (tuning.openNotesMode === 'all_fretted') ||
                          (tuning.openNotesMode === 'bass_only' && (instKey === 'bass' || instKey === 'ghl_bass'));

        const chartNotes = [];
        const starPowerPhrases = [];
        let prevLeadPitch = -1;
        let prevLeadFret = 0;
        let prevTick = -999999;

        for (let i = 0; i < sortedTicks.length; i++) {
            const tick = sortedTicks[i];

            // Filtrado determinista por densidad
            if (userDensity < 0.99 && (tick % (res * 4) !== 0)) {
                const hash = ((i * 2654435761) >>> 0) % 100;
                if (hash > userDensity * 100) continue;
            }

            const nextTick = (i + 1 < sortedTicks.length) ? sortedTicks[i + 1] : tick + res * 4;
            const chordNotes = chordMap.get(tick).sort((a, b) => a.pitch - b.pitch);

            // Ventana deslizante de contorno melódico (+-8 eventos)
            let winMin = 127, winMax = 0;
            for (let w = Math.max(0, i - 8); w <= Math.min(sortedTicks.length - 1, i + 8); w++) {
                chordMap.get(sortedTicks[w]).forEach(wn => {
                    if (wn.pitch < winMin) winMin = wn.pitch;
                    if (wn.pitch > winMax) winMax = wn.pitch;
                });
            }
            const span = Math.max(4, winMax - winMin);

            const count = Math.min(diffRules.maxChord, diffRules.maxFrets, chordNotes.length);
            const usedFrets = new Set();

            // Recorte de 70ms antes de la siguiente nota
            const tickTimeSec = parsedMidi.tickToSeconds(tick);
            const nextTimeSec = parsedMidi.tickToSeconds(nextTick);
            const maxEndSec = Math.max(tickTimeSec, nextTimeSec - 0.07);
            const maxSustainTicks = Math.max(0, parsedMidi.secondsToTick(maxEndSec) - tick);

            for (let c = 0; c < count; c++) {
                const raw = chordNotes[c];
                let fret;

                if (allowOpen && difficulty === 'Expert' && count === 1 && raw.pitch === winMin && (i % 5 === 0)) {
                    fret = 7; // Nota abierta
                } else {
                    let norm = (raw.pitch - winMin) / span;
                    if (tuning.style === 'rhythmic') norm = Math.pow(norm, 1.15);
                    fret = Math.round(norm * (diffRules.maxFrets - 1));

                    // Conservar dirección de movimiento melódico
                    if (c === 0 && prevLeadPitch !== -1 && prevLeadFret !== 7) {
                        if (raw.pitch > prevLeadPitch && fret <= prevLeadFret) {
                            fret = Math.min(diffRules.maxFrets - 1, prevLeadFret + 1);
                        } else if (raw.pitch < prevLeadPitch && fret >= prevLeadFret) {
                            fret = Math.max(0, prevLeadFret - 1);
                        }
                    }

                    fret = Math.max(0, Math.min(diffRules.maxFrets - 1, fret));
                    while (usedFrets.has(fret)) {
                        fret = (fret + 1) % diffRules.maxFrets;
                    }
                }

                // Evitar acorde Verde(0) + Naranja(4) en Medium y Hard
                if ((difficulty === 'Medium' || difficulty === 'Hard') && fret === 4 && usedFrets.has(0)) {
                    fret = 3;
                }

                usedFrets.add(fret);

                let sustainTicks = raw.durationTicks >= minSustainTicks ? Math.min(raw.durationTicks, maxSustainTicks) : 0;
                const sustainSec = Math.max(0, parsedMidi.tickToSeconds(tick + sustainTicks) - tickTimeSec);

                const deltaFromPrev = tick - prevTick;
                const isHopo = (count === 1 && deltaFromPrev <= hopoThreshold && fret !== prevLeadFret);
                const isTap = (tuning.style === 'taps' && difficulty === 'Expert' && count === 1 && deltaFromPrev <= hopoThreshold / 2);

                chartNotes.push({
                    tick,
                    fret,
                    sustainTicks,
                    timeSec: tickTimeSec,
                    sustainSec,
                    isHopo,
                    isTap,
                    cymbalFlag: null
                });

                if (c === 0) {
                    prevLeadPitch = raw.pitch;
                    prevLeadFret = fret;
                }
            }

            // Frases de Star Power periódicas
            if (spEveryMeasures > 0) {
                const measureIdx = Math.floor(tick / (res * 4));
                if (measureIdx > 0 && measureIdx % spEveryMeasures === 0) {
                    const spStartTick = measureIdx * res * 4;
                    if (!starPowerPhrases.some(sp => Math.abs(sp.tick - spStartTick) < res * 2)) {
                        starPowerPhrases.push({ tick: spStartTick, lengthTicks: res * 4 });
                    }
                }
            }

            prevTick = tick;
        }

        return { notes: chartNotes, starPower: starPowerPhrases };
    }

    static buildDrumsTrack(parsedMidi, rawNotes, difficulty, tuning) {
        const res = parsedMidi.resolution;
        const mode = tuning.drumPedal || 'pro_single'; // pro_single | pro_double | four_lane | five_lane
        const isPro = mode === 'pro_single' || mode === 'pro_double';
        const allowDoubleKick = (mode === 'pro_double' && difficulty === 'Expert');

        const quantDiv = { Expert: 16, Hard: 8, Medium: 4, Easy: 2 }[difficulty];
        const gridTicks = Math.max(1, Math.round(res / quantDiv));
        const seen = new Set();
        const chartNotes = [];
        const starPowerPhrases = [];

        rawNotes.forEach(n => {
            const tick = Math.round(n.tick / gridTicks) * gridTicks;
            if (difficulty === 'Easy' && (tick % res !== 0)) return;

            let lane = 1;
            let cymbalFlag = null;

            if (n.pitch === 35 || n.pitch === 36) {
                if (difficulty === 'Easy') return; // Reducir pedal en Easy
                lane = (allowDoubleKick && n.pitch === 35) ? 32 : 0;
            } else if (n.pitch === 38 || n.pitch === 40 || n.pitch === 37) {
                lane = 1; // Snare
            } else if (n.pitch === 42 || n.pitch === 44 || n.pitch === 46) {
                lane = 2; // Hi-Hat
                if (isPro) cymbalFlag = 66;
            } else if (n.pitch === 48 || n.pitch === 50) {
                lane = 2; // High Tom
            } else if (n.pitch === 51 || n.pitch === 53 || n.pitch === 59) {
                lane = 3; // Ride
                if (isPro) cymbalFlag = 67;
            } else if (n.pitch === 45 || n.pitch === 47) {
                lane = 3; // Mid Tom
            } else if (n.pitch === 49 || n.pitch === 52 || n.pitch === 55 || n.pitch === 57) {
                lane = mode === 'five_lane' ? 5 : 4; // Crash
                if (isPro && mode !== 'five_lane') cymbalFlag = 68;
            } else {
                lane = 4; // Floor Tom
            }

            const key = `${tick}:${lane}`;
            if (!seen.has(key)) {
                seen.add(key);
                chartNotes.push({
                    tick,
                    fret: lane === 32 ? 0 : lane,
                    rawChartFret: lane,
                    sustainTicks: 0,
                    timeSec: parsedMidi.tickToSeconds(tick),
                    sustainSec: 0,
                    isHopo: false,
                    isTap: false,
                    cymbalFlag
                });
            }
        });

        const spEveryMeasures = parseInt(tuning.starPower || 16, 10);
        if (spEveryMeasures > 0 && chartNotes.length > 0) {
            const maxTick = chartNotes[chartNotes.length - 1].tick;
            for (let m = spEveryMeasures; m * res * 4 < maxTick; m += spEveryMeasures) {
                starPowerPhrases.push({ tick: m * res * 4, lengthTicks: res * 4 });
            }
        }

        return { notes: chartNotes, starPower: starPowerPhrases };
    }

    static computeTrackStats(trackData) {
        if (!trackData || !trackData.notes || trackData.notes.length === 0) {
            return { totalNotes: 0, avgNps: 0, peakNps: 0, chordsCount: 0, spCount: 0, suggestedTier: 0 };
        }

        const notes = trackData.notes;
        const byTick = new Map();
        notes.forEach(n => {
            byTick.set(n.tick, (byTick.get(n.tick) || 0) + 1);
        });

        let chordsCount = 0;
        byTick.forEach(cnt => { if (cnt > 1) chordsCount++; });

        const firstSec = notes[0].timeSec;
        const lastSec = notes[notes.length - 1].timeSec;
        const activeSpan = Math.max(1, lastSec - firstSec);
        const avgNps = notes.length / activeSpan;

        // Ventana deslizante de 1 segundo para Pico de NPS
        let peakNps = 0;
        let left = 0;
        for (let right = 0; right < notes.length; right++) {
            while (notes[right].timeSec - notes[left].timeSec > 1.0) {
                left++;
            }
            const countInSec = right - left + 1;
            if (countInSec > peakNps) peakNps = countInSec;
        }

        const score = avgNps * 0.65 + peakNps * 0.35;
        let suggestedTier = 1;
        if (score >= 11) suggestedTier = 6;
        else if (score >= 8.5) suggestedTier = 5;
        else if (score >= 6.0) suggestedTier = 4;
        else if (score >= 4.0) suggestedTier = 3;
        else if (score >= 2.2) suggestedTier = 2;

        return {
            totalNotes: notes.length,
            avgNps: Math.round(avgNps * 10) / 10,
            peakNps,
            chordsCount,
            spCount: (trackData.starPower || []).length,
            suggestedTier
        };
    }
}

window.CharterEngine = CharterEngine;