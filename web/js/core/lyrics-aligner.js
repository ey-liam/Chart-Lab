/**
 * Chart-Lab - Lyrics & Vocal Syllable Aligner
 * Handles:
 * 1. Automatic extraction of embedded MIDI lyrics / text events.
 * 2. Syllable splitting and sequential auto-alignment to vocal melody notes.
 * 3. Clone Hero [Events] formatting with phrase_start, lyric, phrase_end, and sections.
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.LyricsEngine = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    /**
     * Syllabifies a single word using vowel cluster heuristics
     */
    function syllabifyWord(word) {
        if (!word) return [];
        if (word.length <= 3) return [word];

        // Check if word already has hyphens
        if (word.includes('-')) {
            return word.split('-').filter(p => p.length > 0);
        }

        const vowels = /[aeiouyáéíóúü]/gi;
        const matches = [...word.matchAll(vowels)];
        if (matches.length <= 1) return [word];

        const syllables = [];
        let lastIdx = 0;

        for (let i = 0; i < matches.length - 1; i++) {
            const vCurr = matches[i].index;
            const vNext = matches[i + 1].index;
            const numConsonants = vNext - vCurr - 1;

            let splitAt;
            if (numConsonants <= 1) {
                // Single consonant or hiatus: split after vowel
                splitAt = vCurr + 1;
            } else {
                // Two or more consonants: split between them
                splitAt = vCurr + 1 + Math.floor(numConsonants / 2);
            }

            syllables.push(word.slice(lastIdx, splitAt));
            lastIdx = splitAt;
        }

        syllables.push(word.slice(lastIdx));
        return syllables;
    }

    /**
     * Splits full text into words or syllables formatted for Clone Hero lyrics
     */
    function parseLyricsText(text, mode = 'syllables') {
        if (!text || !text.trim()) return [];

        // Split lines to keep stanza structure
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const result = [];

        lines.forEach((line, lineIndex) => {
            const words = line.split(/\s+/).filter(w => w.length > 0);

            words.forEach((w, wordIndex) => {
                const isEndOfLine = (wordIndex === words.length - 1);

                if (mode === 'words') {
                    // Whole word mode
                    result.push({
                        text: w + ' ',
                        isEndOfWord: true,
                        isEndOfLine: isEndOfLine,
                        lineIndex: lineIndex
                    });
                } else {
                    // Syllables mode
                    const syllables = syllabifyWord(w);
                    syllables.forEach((syl, sIdx) => {
                        const isLastSyl = (sIdx === syllables.length - 1);
                        result.push({
                            text: isLastSyl ? syl + ' ' : syl + '-',
                            isEndOfWord: isLastSyl,
                            isEndOfLine: isLastSyl && isEndOfLine,
                            lineIndex: lineIndex
                        });
                    });
                }
            });
        });

        return result;
    }

    /**
     * Extracts existing lyrics or text events from MIDI tracks
     */
    function extractMidiLyrics(midiData) {
        const events = [];

        midiData.tracks.forEach(track => {
            if (track.textEvents && track.textEvents.length > 0) {
                track.textEvents.forEach(ev => {
                    const txt = ev.text.replace(/[\r\n\0]/g, '').trim();
                    if (txt.length > 0 && !txt.startsWith('[') && !txt.startsWith('@')) {
                        events.push({
                            tick: ev.tick,
                            type: ev.type,
                            text: txt,
                            trackId: track.id,
                            timeSec: midiData.tickToSeconds(ev.tick)
                        });
                    }
                });
            }
        });

        events.sort((a, b) => a.tick - b.tick);
        return events;
    }

    /**
     * Automatically aligns syllables to a vocal track's notes
     */
    function alignLyricsToNotes(syllables, vocalNotes, ppq, options = {}) {
        if (!syllables || syllables.length === 0 || !vocalNotes || vocalNotes.length === 0) {
            return [];
        }

        const sortedNotes = [...vocalNotes].sort((a, b) => a.tick - b.tick);
        const pauseThresholdTicks = Math.round(ppq * (options.phrasePauseBeats || 1.75));

        const alignedEvents = [];
        let sylIdx = 0;
        let inPhrase = false;

        for (let i = 0; i < sortedNotes.length && sylIdx < syllables.length; i++) {
            const note = sortedNotes[i];
            const prevNote = i > 0 ? sortedNotes[i - 1] : null;
            const nextNote = i < sortedNotes.length - 1 ? sortedNotes[i + 1] : null;

            // Check if we need to start a new phrase
            const isLongRest = prevNote && (note.tick - (prevNote.tick + prevNote.durationTicks)) >= pauseThresholdTicks;
            const isNewStanza = syllables[sylIdx].lineIndex > (sylIdx > 0 ? syllables[sylIdx - 1].lineIndex : 0);

            if (!inPhrase || isLongRest || isNewStanza) {
                if (inPhrase && prevNote) {
                    // Close previous phrase
                    alignedEvents.push({
                        tick: prevNote.tick + prevNote.durationTicks,
                        type: 'phrase_end',
                        eventText: 'phrase_end'
                    });
                }
                // Open new phrase
                alignedEvents.push({
                    tick: note.tick,
                    type: 'phrase_start',
                    eventText: 'phrase_start'
                });
                inPhrase = true;
            }

            // Add lyric event
            const syl = syllables[sylIdx];
            alignedEvents.push({
                tick: note.tick,
                type: 'lyric',
                syllable: syl.text,
                eventText: `lyric ${syl.text}`,
                noteMidi: note.midi,
                noteName: note.name
            });

            // Check if last note in phrase or song
            const isLastNoteOfPhrase = nextNote && (nextNote.tick - (note.tick + note.durationTicks)) >= pauseThresholdTicks;
            const isEndOfLine = syl.isEndOfLine;

            if (isLastNoteOfPhrase || isEndOfLine || i === sortedNotes.length - 1 || sylIdx === syllables.length - 1) {
                alignedEvents.push({
                    tick: note.tick + note.durationTicks,
                    type: 'phrase_end',
                    eventText: 'phrase_end'
                });
                inPhrase = false;
            }

            sylIdx++;
        }

        alignedEvents.sort((a, b) => {
            if (a.tick !== b.tick) return a.tick - b.tick;
            // Order at same tick: phrase_end -> phrase_start -> lyric
            const order = { 'phrase_end': 0, 'phrase_start': 1, 'lyric': 2, 'section': 3 };
            return (order[a.type] || 0) - (order[b.type] || 0);
        });

        return alignedEvents;
    }

    /**
     * Converts raw MIDI text events into formatted Clone Hero lyric phrases
     */
    function formatMidiLyricsToEvents(midiEvents, ppq, pauseThresholdBeats = 2.0) {
        if (!midiEvents || midiEvents.length === 0) return [];
        const pauseTicks = Math.round(ppq * pauseThresholdBeats);
        const formatted = [];
        let inPhrase = false;

        for (let i = 0; i < midiEvents.length; i++) {
            const ev = midiEvents[i];
            const prev = i > 0 ? midiEvents[i - 1] : null;

            if (!inPhrase || (prev && (ev.tick - prev.tick) >= pauseTicks)) {
                if (inPhrase && prev) {
                    formatted.push({
                        tick: prev.tick + Math.round(ppq * 0.5),
                        type: 'phrase_end',
                        eventText: 'phrase_end'
                    });
                }
                formatted.push({
                    tick: ev.tick,
                    type: 'phrase_start',
                    eventText: 'phrase_start'
                });
                inPhrase = true;
            }

            let lyricText = ev.text;
            if (lyricText.startsWith('/') || lyricText.startsWith('\\')) {
                lyricText = lyricText.substring(1);
            }

            formatted.push({
                tick: ev.tick,
                type: 'lyric',
                syllable: lyricText,
                eventText: `lyric ${lyricText}`
            });

            const next = i < midiEvents.length - 1 ? midiEvents[i + 1] : null;
            if (!next || (next.tick - ev.tick) >= pauseTicks) {
                formatted.push({
                    tick: ev.tick + Math.round(ppq * 0.5),
                    type: 'phrase_end',
                    eventText: 'phrase_end'
                });
                inPhrase = false;
            }
        }

        formatted.sort((a, b) => a.tick - b.tick);
        return formatted;
    }

    /**
     * Generates automatic section markers throughout the song
     */
    function generateSections(maxTick, ppq, customSections = null) {
        if (customSections && customSections.length > 0) {
            return customSections.map(s => ({
                tick: s.tick,
                type: 'section',
                eventText: `section ${s.name}`
            }));
        }

        // Standard auto-sections based on song progress
        const sections = [];
        sections.push({ tick: 0, type: 'section', eventText: 'section Intro' });

        const totalBeats = maxTick / ppq;
        const totalMeasures = totalBeats / 4;

        if (totalMeasures >= 16) {
            const verse1Tick = Math.round(ppq * 4 * 8); // ~Measure 9
            const chorus1Tick = Math.round(maxTick * 0.28);
            const verse2Tick = Math.round(maxTick * 0.44);
            const chorus2Tick = Math.round(maxTick * 0.60);
            const bridgeTick = Math.round(maxTick * 0.76);
            const outroTick = Math.round(maxTick * 0.90);

            sections.push({ tick: verse1Tick, type: 'section', eventText: 'section Verse 1' });
            sections.push({ tick: chorus1Tick, type: 'section', eventText: 'section Chorus 1' });
            sections.push({ tick: verse2Tick, type: 'section', eventText: 'section Verse 2' });
            sections.push({ tick: chorus2Tick, type: 'section', eventText: 'section Chorus 2' });
            sections.push({ tick: bridgeTick, type: 'section', eventText: 'section Bridge' });
            sections.push({ tick: outroTick, type: 'section', eventText: 'section Outro' });
        }

        sections.sort((a, b) => a.tick - b.tick);
        return sections;
    }

    return {
        syllabifyWord,
        parseLyricsText,
        extractMidiLyrics,
        alignLyricsToNotes,
        formatMidiLyricsToEvents,
        generateSections
    };
}));
