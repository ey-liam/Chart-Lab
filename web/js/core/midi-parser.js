/**
 * MIDI-CH Studio Pro - High Performance Binary MIDI Parser
 * Supports Format 0 & 1, running status, meta events, tempos, time signatures & lyrics.
 * Dual environment: works in Browser and Node.js.
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MidiParser = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // General MIDI Instrument Names
    const GM_INSTRUMENTS = [
        "Acoustic Grand Piano", "Bright Acoustic Piano", "Electric Grand Piano", "Honky-tonk Piano",
        "Electric Piano 1", "Electric Piano 2", "Harpsichord", "Clavi",
        "Celesta", "Glockenspiel", "Music Box", "Vibraphone", "Marimba", "Xylophone", "Tubular Bells", "Dulcimer",
        "Drawbar Organ", "Percussive Organ", "Rock Organ", "Church Organ", "Reed Organ", "Accordion", "Harmonica", "Tango Accordion",
        "Acoustic Guitar (nylon)", "Acoustic Guitar (steel)", "Electric Guitar (jazz)", "Electric Guitar (clean)",
        "Electric Guitar (muted)", "Overdriven Guitar", "Distortion Guitar", "Guitar Harmonics",
        "Acoustic Bass", "Electric Bass (finger)", "Electric Bass (pick)", "Fretless Bass",
        "Slap Bass 1", "Slap Bass 2", "Synth Bass 1", "Synth Bass 2",
        "Violin", "Viola", "Cello", "Contrabass", "Tremolo Strings", "Pizzicato Strings", "Orchestral Harp", "Timpani",
        "String Ensemble 1", "String Ensemble 2", "Synth Strings 1", "Synth Strings 2",
        "Choir Aahs", "Voice Oohs", "Synth Voice", "Orchestra Hit",
        "Trumpet", "Trombone", "Tuba", "Muted Trumpet", "French Horn", "Brass Section", "Synth Brass 1", "Synth Brass 2",
        "Soprano Sax", "Alto Sax", "Tenor Sax", "Baritone Sax", "Oboe", "English Horn", "Bassoon", "Clarinet",
        "Piccolo", "Flute", "Recorder", "Pan Flute", "Blown Bottle", "Shakuhachi", "Whistle", "Ocarina",
        "Lead 1 (square)", "Lead 2 (sawtooth)", "Lead 3 (calliope)", "Lead 4 (chiff)", "Lead 5 (charang)", "Lead 6 (voice)", "Lead 7 (fifths)", "Lead 8 (bass + lead)",
        "Pad 1 (new age)", "Pad 2 (warm)", "Pad 3 (polysynth)", "Pad 4 (choir)", "Pad 5 (bowed)", "Pad 6 (metallic)", "Pad 7 (halo)", "Pad 8 (sweep)",
        "FX 1 (rain)", "FX 2 (soundtrack)", "FX 3 (crystal)", "FX 4 (atmosphere)", "FX 5 (brightness)", "FX 6 (goblins)", "FX 7 (echoes)", "FX 8 (sci-fi)",
        "Sitar", "Banjo", "Shamisen", "Koto", "Kalimba", "Bagpipe", "Fiddle", "Shanai",
        "Tinkle Bell", "Agogo", "Steel Drums", "Woodblock", "Taiko Drum", "Melodic Tom", "Synth Drum", "Reverse Cymbal",
        "Guitar Fret Noise", "Breath Noise", "Seashore", "Bird Tweet", "Telephone Ring", "Helicopter", "Applause", "Gunshot"
    ];

    const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    function pitchToName(pitch) {
        const octave = Math.floor(pitch / 12) - 1;
        const name = NOTE_NAMES[pitch % 12];
        return `${name}${octave}`;
    }

    function parse(bufferOrArrayBuffer) {
        let uint8;
        if (bufferOrArrayBuffer instanceof Uint8Array) {
            uint8 = bufferOrArrayBuffer;
        } else if (bufferOrArrayBuffer instanceof ArrayBuffer) {
            uint8 = new Uint8Array(bufferOrArrayBuffer);
        } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(bufferOrArrayBuffer)) {
            uint8 = new Uint8Array(bufferOrArrayBuffer.buffer, bufferOrArrayBuffer.byteOffset, bufferOrArrayBuffer.byteLength);
        } else {
            throw new Error('Unsupported buffer type for MIDI parsing');
        }

        let offset = 0;
        const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);

        function readStr(len) {
            let str = '';
            for (let i = 0; i < len; i++) {
                if (offset < uint8.length) {
                    str += String.fromCharCode(uint8[offset++]);
                }
            }
            return str;
        }

        function readU32() {
            if (offset + 4 > uint8.length) return 0;
            const val = view.getUint32(offset);
            offset += 4;
            return val;
        }

        function readU16() {
            if (offset + 2 > uint8.length) return 0;
            const val = view.getUint16(offset);
            offset += 2;
            return val;
        }

        function readU8() {
            return offset < uint8.length ? uint8[offset++] : 0;
        }

        function readVarLen() {
            let val = 0;
            let b = 0;
            let count = 0;
            do {
                if (offset >= uint8.length) break;
                b = uint8[offset++];
                val = (val << 7) | (b & 0x7F);
                count++;
            } while ((b & 0x80) && count < 4);
            return val;
        }

        // Header Chunk
        const headerId = readStr(4);
        if (headerId !== 'MThd') {
            throw new Error('Invalid MIDI header: expected "MThd", got "' + headerId + '"');
        }

        const headerLen = readU32();
        const format = readU16();
        const numTracks = readU16();
        const division = readU16();

        // If SMPTE format, standard fallback
        const ppq = (division & 0x8000) === 0 ? division : 480;

        if (headerLen > 6) {
            offset += (headerLen - 6);
        }

        const rawTracks = [];
        const globalTempos = [];
        const globalTimeSignatures = [];
        let maxTick = 0;

        for (let t = 0; t < numTracks; t++) {
            if (offset >= uint8.length) break;
            const trackId = readStr(4);
            if (trackId !== 'MTrk') {
                // Seek to next MTrk if padding exists
                let found = false;
                while (offset <= uint8.length - 4) {
                    if (uint8[offset] === 0x4D && uint8[offset+1] === 0x54 && uint8[offset+2] === 0x72 && uint8[offset+3] === 0x6B) {
                        readStr(4);
                        found = true;
                        break;
                    }
                    offset++;
                }
                if (!found) break;
            }

            const trackLen = readU32();
            const trackEnd = offset + trackLen;

            let curTick = 0;
            let runningStatus = 0;
            let trackName = `Pista ${t + 1}`;
            let instrumentName = '';
            let programNumber = null;
            let channelUsed = null;
            let isPercussion = false;

            const openNotes = {}; // note -> [{ tick, vel, chan }]
            const notes = [];
            const textEvents = [];

            while (offset < trackEnd && offset < uint8.length) {
                const delta = readVarLen();
                curTick += delta;
                if (curTick > maxTick) maxTick = curTick;

                let status = uint8[offset];
                if (status & 0x80) {
                    offset++;
                    runningStatus = status;
                } else {
                    status = runningStatus;
                }

                const type = status & 0xF0;
                const chan = status & 0x0F;

                if (chan !== undefined && channelUsed === null && (type === 0x90 || type === 0x80 || type === 0xC0)) {
                    channelUsed = chan;
                    if (chan === 9) isPercussion = true;
                }

                if (status === 0xFF) {
                    // Meta Event
                    const metaType = readU8();
                    const metaLen = readVarLen();
                    const metaStart = offset;

                    if (metaType === 0x03) {
                        let str = '';
                        for (let i = 0; i < metaLen; i++) str += String.fromCharCode(uint8[metaStart + i]);
                        trackName = str.trim() || trackName;
                    } else if (metaType === 0x04) {
                        let str = '';
                        for (let i = 0; i < metaLen; i++) str += String.fromCharCode(uint8[metaStart + i]);
                        instrumentName = str.trim();
                    } else if (metaType === 0x51 && metaLen === 3) {
                        const us = (uint8[metaStart] << 16) | (uint8[metaStart + 1] << 8) | uint8[metaStart + 2];
                        const bpm = 60000000 / us;
                        globalTempos.push({ tick: curTick, tempo: us, bpm });
                    } else if (metaType === 0x58 && metaLen >= 2) {
                        const num = uint8[metaStart];
                        const den = Math.pow(2, uint8[metaStart + 1]);
                        globalTimeSignatures.push({ tick: curTick, num, den });
                    } else if (metaType === 0x01 || metaType === 0x05) {
                        let str = '';
                        for (let i = 0; i < metaLen; i++) str += String.fromCharCode(uint8[metaStart + i]);
                        textEvents.push({
                            tick: curTick,
                            type: metaType === 0x05 ? 'lyric' : 'text',
                            text: str
                        });
                    }
                    offset = metaStart + metaLen;
                } else if (status === 0xF0 || status === 0xF7) {
                    // Sysex
                    const sysLen = readVarLen();
                    offset += sysLen;
                } else if (type === 0x90 || type === 0x80) {
                    const note = readU8();
                    const vel = readU8();
                    if (type === 0x90 && vel > 0) {
                        if (!openNotes[note]) openNotes[note] = [];
                        openNotes[note].push({ tick: curTick, vel, chan });
                    } else {
                        if (openNotes[note] && openNotes[note].length > 0) {
                            const start = openNotes[note].shift();
                            notes.push({
                                midi: note,
                                name: pitchToName(note),
                                velocity: start.vel,
                                tick: start.tick,
                                durationTicks: Math.max(1, curTick - start.tick),
                                channel: start.chan
                            });
                        }
                    }
                } else if (type === 0xC0) {
                    // Program Change
                    programNumber = readU8();
                    if (!instrumentName && GM_INSTRUMENTS[programNumber]) {
                        instrumentName = GM_INSTRUMENTS[programNumber];
                    }
                } else if (type === 0xD0) {
                    readU8();
                } else if (type === 0xA0 || type === 0xB0 || type === 0xE0) {
                    offset += 2;
                } else {
                    // Unknown status, advance safely
                    break;
                }
            }
            offset = trackEnd;

            // Close any unclosed notes at maxTick
            for (let noteKey in openNotes) {
                while (openNotes[noteKey] && openNotes[noteKey].length > 0) {
                    const start = openNotes[noteKey].shift();
                    notes.push({
                        midi: parseInt(noteKey),
                        name: pitchToName(parseInt(noteKey)),
                        velocity: start.vel,
                        tick: start.tick,
                        durationTicks: Math.max(1, (maxTick || start.tick + ppq) - start.tick),
                        channel: start.chan
                    });
                }
            }

            notes.sort((a, b) => a.tick - b.tick || a.midi - b.midi);

            const pitches = notes.map(n => n.midi);
            const minPitch = pitches.length > 0 ? Math.min(...pitches) : 0;
            const maxPitch = pitches.length > 0 ? Math.max(...pitches) : 0;

            rawTracks.push({
                id: t,
                name: trackName,
                instrumentName: instrumentName || (isPercussion ? 'Standard Drum Kit' : 'General Instrument'),
                programNumber: programNumber !== null ? programNumber : (isPercussion ? 0 : 0),
                channel: channelUsed !== null ? channelUsed : 0,
                isPercussion: isPercussion || (channelUsed === 9),
                notes,
                textEvents,
                minPitch,
                maxPitch,
                noteCount: notes.length
            });
        }

        // Process Tempos & Build Timing Map
        if (globalTempos.length === 0) {
            globalTempos.push({ tick: 0, tempo: 500000, bpm: 120 });
        }
        globalTempos.sort((a, b) => a.tick - b.tick);

        // Deduplicate duplicate ticks (keep last tempo)
        const dedupedTempos = [];
        for (let tm of globalTempos) {
            if (dedupedTempos.length > 0 && dedupedTempos[dedupedTempos.length - 1].tick === tm.tick) {
                dedupedTempos[dedupedTempos.length - 1] = tm;
            } else {
                dedupedTempos.push(tm);
            }
        }

        // Compute cumulative time in seconds for each tempo event
        let curSec = 0;
        let lastTick = 0;
        let lastUsPerBeat = dedupedTempos[0].tempo;

        for (let i = 0; i < dedupedTempos.length; i++) {
            const tm = dedupedTempos[i];
            const deltaTicks = tm.tick - lastTick;
            curSec += (deltaTicks / ppq) * (lastUsPerBeat / 1000000);
            tm.timeSec = curSec;
            lastTick = tm.tick;
            lastUsPerBeat = tm.tempo;
        }

        // Process Time Signatures
        if (globalTimeSignatures.length === 0) {
            globalTimeSignatures.push({ tick: 0, num: 4, den: 4 });
        }
        globalTimeSignatures.sort((a, b) => a.tick - b.tick);

        // Timing conversion functions
        function tickToSeconds(tick) {
            if (tick <= 0) return 0;
            let prev = dedupedTempos[0];
            for (let i = 1; i < dedupedTempos.length; i++) {
                if (dedupedTempos[i].tick > tick) break;
                prev = dedupedTempos[i];
            }
            const deltaTicks = tick - prev.tick;
            return prev.timeSec + (deltaTicks / ppq) * (prev.tempo / 1000000);
        }

        function secondsToTick(sec) {
            if (sec <= 0) return 0;
            let prev = dedupedTempos[0];
            for (let i = 1; i < dedupedTempos.length; i++) {
                if (dedupedTempos[i].timeSec > sec) break;
                prev = dedupedTempos[i];
            }
            const deltaSec = sec - prev.timeSec;
            const deltaTicks = (deltaSec * 1000000 / prev.tempo) * ppq;
            return Math.round(prev.tick + deltaTicks);
        }

        // Annotate all notes with real-time seconds
        for (let trk of rawTracks) {
            for (let n of trk.notes) {
                n.startTime = tickToSeconds(n.tick);
                n.endTime = tickToSeconds(n.tick + n.durationTicks);
                n.durationSec = n.endTime - n.startTime;
            }
        }

        const totalDurationSec = tickToSeconds(maxTick);

        return {
            ppq,
            format,
            tracks: rawTracks,
            tempos: dedupedTempos,
            timeSignatures: globalTimeSignatures,
            maxTick,
            totalDurationSec,
            tickToSeconds,
            secondsToTick
        };
    }

    return {
        parse,
        GM_INSTRUMENTS,
        NOTE_NAMES,
        pitchToName
    };
}));
