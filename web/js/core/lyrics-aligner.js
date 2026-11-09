/**
 * Chart-Lab - Motor de Silabificacion Fonetica y Secciones de Practica
 * Autor: Ey-Liam
 */
class LyricsAligner {
    static syllabifyWord(word) {
        if (!word) return [];
        if (word.includes('-')) {
            return word.split('-').filter(Boolean).map((part, idx, arr) =>
                idx < arr.length - 1 ? `${part}-` : part
            );
        }

        // Conservar modificadores RBN al final (# para talkie, + para ligadura)
        let suffix = '';
        let clean = word;
        if (clean.endsWith('#') || clean.endsWith('+')) {
            suffix = clean.slice(-1);
            clean = clean.slice(0, -1);
        }

        if (clean.length <= 3) return [clean + suffix];

        // División silábica heurística bilingüe (Español / Inglés)
        const parts = clean.match(/[^aeiouáéíóúü]*[aeiouáéíóúü]+(?:[^aeiouáéíóúü]*(?=[aeiouáéíóúü]|$)|[^aeiouáéíóúü]+$)/gi);
        if (!parts || parts.length <= 1) return [clean + suffix];

        return parts.map((p, i) => {
            const isLast = (i === parts.length - 1);
            return isLast ? (p + suffix) : `${p}-`;
        });
    }

    static tokenizeTextToLines(rawText, mode = 'syllables') {
        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        return lines.map(line => {
            const words = line.split(/\s+/).filter(Boolean);
            if (mode === 'words') return words;
            if (mode === 'manual') {
                const tokens = [];
                words.forEach(w => {
                    if (w.includes('-')) {
                        const sp = w.split('-').filter(Boolean);
                        sp.forEach((s, idx) => tokens.push(idx < sp.length - 1 ? `${s}-` : s));
                    } else {
                        tokens.push(w);
                    }
                });
                return tokens;
            }
            const syllables = [];
            words.forEach(w => {
                this.syllabifyWord(w).forEach(s => syllables.push(s));
            });
            return syllables;
        });
    }

    static previewSyllableBreakdown(rawText, mode = 'syllables') {
        const lines = this.tokenizeTextToLines(rawText, mode);
        return lines.map(tokens => tokens.join(' ')).join('\n');
    }

    static alignLyricsToTrack(parsedMidi, vocalTrackNotes, rawText, mode = 'syllables') {
        const events = [];
        const syllableByNoteIdx = [];
        if (!parsedMidi || !vocalTrackNotes || vocalTrackNotes.length === 0) {
            return { events, syllableByNoteIdx };
        }

        const tokenizedLines = this.tokenizeTextToLines(rawText, mode);
        if (tokenizedLines.length === 0) return { events, syllableByNoteIdx };

        let noteCursor = 0;
        const res = parsedMidi.resolution;

        for (let l = 0; l < tokenizedLines.length && noteCursor < vocalTrackNotes.length; l++) {
            const lineTokens = tokenizedLines[l];
            if (lineTokens.length === 0) continue;

            const startNote = vocalTrackNotes[noteCursor];
            events.push({
                tick: startNote.tick,
                timeSec: parsedMidi.tickToSeconds(startNote.tick),
                type: 'phrase_start',
                text: 'phrase_start'
            });

            let lastNoteInPhrase = startNote;
            for (let s = 0; s < lineTokens.length && noteCursor < vocalTrackNotes.length; s++) {
                const note = vocalTrackNotes[noteCursor];
                const sylText = lineTokens[s];

                events.push({
                    tick: note.tick,
                    timeSec: parsedMidi.tickToSeconds(note.tick),
                    type: 'lyric',
                    text: sylText
                });

                syllableByNoteIdx[noteCursor] = {
                    tick: note.tick,
                    timeSec: parsedMidi.tickToSeconds(note.tick),
                    text: sylText
                };

                lastNoteInPhrase = note;
                noteCursor++;
            }

            const endTick = lastNoteInPhrase.tick + Math.max(res / 4, lastNoteInPhrase.durationTicks);
            events.push({
                tick: endTick,
                timeSec: parsedMidi.tickToSeconds(endTick),
                type: 'phrase_end',
                text: 'phrase_end'
            });
        }

        events.sort((a, b) => a.tick - b.tick);
        return { events, syllableByNoteIdx };
    }

    static autoGenerateSections(parsedMidi) {
        if (!parsedMidi) return [];
        const res = parsedMidi.resolution;
        const measureTicks = res * 4;
        const totalMeasures = Math.max(1, Math.ceil((parsedMidi.maxTick || measureTicks) / measureTicks));

        const sections = [{ tick: 0, name: 'Intro' }];
        const standardNames = [
            'Verse 1', 'Pre-Chorus 1', 'Chorus 1',
            'Verse 2', 'Pre-Chorus 2', 'Chorus 2',
            'Bridge', 'Guitar Solo', 'Chorus 3', 'Outro'
        ];

        const stepMeasures = Math.max(4, Math.floor(totalMeasures / (standardNames.length + 1)));
        let nameIdx = 0;

        for (let m = stepMeasures; m < totalMeasures - 2 && nameIdx < standardNames.length; m += stepMeasures) {
            sections.push({
                tick: m * measureTicks,
                name: standardNames[nameIdx++]
            });
        }

        return sections;
    }
}

window.LyricsAligner = LyricsAligner;