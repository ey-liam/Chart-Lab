/**
 * Chart-Lab - Decodificador Binario de Archivos MIDI (Formatos 0 y 1)
 * Autor: Ey-Liam
 */
class MidiParser {
    static parseArrayBuffer(buffer) {
        const view = new DataView(buffer);
        let pos = 0;

        const readString = (len) => {
            let s = '';
            for (let i = 0; i < len && pos < view.byteLength; i++) {
                s += String.fromCharCode(view.getUint8(pos++));
            }
            return s;
        };

        const readVarLen = () => {
            let value = 0;
            while (pos < view.byteLength) {
                const b = view.getUint8(pos++);
                value = (value << 7) | (b & 0x7f);
                if ((b & 0x80) === 0) break;
            }
            return value;
        };

        const magic = readString(4);
        if (magic !== 'MThd') {
            throw new Error('Encabezado MIDI invalido: no se encontro MThd.');
        }

        const hdrLen = view.getUint32(pos);
        pos += 4;
        const formatType = view.getUint16(pos);
        const numTracks = view.getUint16(pos + 2);
        const timeDivision = view.getUint16(pos + 4);
        pos += hdrLen;

        const resolution = (timeDivision & 0x8000) ? 480 : timeDivision;
        const tempoEvents = [{ tick: 0, usPerQuarter: 500000, bpm: 120 }];
        const timeSignatures = [{ tick: 0, numerator: 4, denominator: 4 }];
        const embeddedLyrics = [];
        const rawTracks = [];
        let maxTick = 0;

        for (let t = 0; t < numTracks && pos < view.byteLength; t++) {
            const trkMagic = readString(4);
            if (trkMagic !== 'MTrk') break;

            const trkLength = view.getUint32(pos);
            pos += 4;
            const trkEnd = Math.min(view.byteLength, pos + trkLength);

            let tick = 0;
            let runningStatus = 0;
            let trackName = `Pista ${t + 1}`;
            const activeNotes = new Map();
            const notes = [];
            const channelCounts = new Array(16).fill(0);

            while (pos < trkEnd) {
                const delta = readVarLen();
                tick += delta;
                if (tick > maxTick) maxTick = tick;

                let status = view.getUint8(pos);
                if (status < 0x80) {
                    status = runningStatus;
                } else {
                    pos++;
                    if (status < 0xf0) runningStatus = status;
                }

                const eventType = status & 0xf0;
                const channel = status & 0x0f;

                if (eventType === 0x90 || eventType === 0x80) {
                    const pitch = view.getUint8(pos++);
                    const velocity = view.getUint8(pos++);
                    const key = `${channel}:${pitch}`;

                    if (eventType === 0x90 && velocity > 0) {
                        activeNotes.set(key, { tick, pitch, velocity, channel });
                        channelCounts[channel]++;
                    } else if (activeNotes.has(key)) {
                        const startObj = activeNotes.get(key);
                        activeNotes.delete(key);
                        notes.push({
                            tick: startObj.tick,
                            durationTicks: Math.max(1, tick - startObj.tick),
                            pitch: startObj.pitch,
                            velocity: startObj.velocity,
                            channel: startObj.channel
                        });
                    }
                } else if (eventType === 0xa0 || eventType === 0xb0 || eventType === 0xe0) {
                    pos += 2;
                } else if (eventType === 0xc0 || eventType === 0xd0) {
                    pos += 1;
                } else if (status === 0xff) {
                    const metaType = view.getUint8(pos++);
                    const metaLen = readVarLen();
                    const metaEnd = pos + metaLen;

                    if (metaType === 0x03) {
                        const txt = readString(metaLen).trim();
                        if (txt) trackName = txt;
                    } else if (metaType === 0x05 || metaType === 0x01) {
                        const txt = readString(metaLen).trim();
                        if (txt && !txt.startsWith('[') && !txt.startsWith('@')) {
                            embeddedLyrics.push({ tick, text: txt });
                        }
                    } else if (metaType === 0x51 && metaLen === 3) {
                        const usPerQuarter =
                            (view.getUint8(pos) << 16) |
                            (view.getUint8(pos + 1) << 8) |
                            view.getUint8(pos + 2);
                        const bpm = Math.round((60000000 / usPerQuarter) * 1000) / 1000;
                        tempoEvents.push({ tick, usPerQuarter, bpm });
                    } else if (metaType === 0x58 && metaLen >= 2) {
                        const num = view.getUint8(pos);
                        const den = Math.pow(2, view.getUint8(pos + 1));
                        timeSignatures.push({ tick, numerator: num, denominator: den });
                    }
                    pos = metaEnd;
                } else if (status === 0xf0 || status === 0xf7) {
                    const sysexLen = readVarLen();
                    pos += sysexLen;
                } else {
                    break;
                }
            }

            pos = trkEnd;

            if (notes.length > 0) {
                notes.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch);
                let minPitch = 127, maxPitch = 0;
                notes.forEach(n => {
                    if (n.pitch < minPitch) minPitch = n.pitch;
                    if (n.pitch > maxPitch) maxPitch = n.pitch;
                });
                const dominantChannel = channelCounts.indexOf(Math.max(...channelCounts));

                rawTracks.push({
                    id: rawTracks.length,
                    name: trackName,
                    channel: dominantChannel,
                    isPercussion: dominantChannel === 9,
                    notes,
                    minPitch,
                    maxPitch
                });
            }
        }

        // Si es Formato 0 (una sola pista con varios canales), separar por canal
        let finalTracks = rawTracks;
        if (rawTracks.length === 1 && formatType === 0) {
            const byChan = new Map();
            rawTracks[0].notes.forEach(n => {
                if (!byChan.has(n.channel)) byChan.set(n.channel, []);
                byChan.get(n.channel).push(n);
            });
            if (byChan.size > 1) {
                finalTracks = [];
                byChan.forEach((chNotes, ch) => {
                    let minP = 127, maxP = 0;
                    chNotes.forEach(n => {
                        if (n.pitch < minP) minP = n.pitch;
                        if (n.pitch > maxP) maxP = n.pitch;
                    });
                    finalTracks.push({
                        id: finalTracks.length,
                        name: ch === 9 ? 'Percusion Canal 10' : `Canal MIDI ${ch + 1}`,
                        channel: ch,
                        isPercussion: ch === 9,
                        notes: chNotes,
                        minPitch: minP,
                        maxPitch: maxP
                    });
                });
            }
        }

        // Consolidar mapa de tempos con tiempo acumulado en segundos
        tempoEvents.sort((a, b) => a.tick - b.tick);
        const dedupTempos = [];
        tempoEvents.forEach(te => {
            if (dedupTempos.length > 0 && dedupTempos[dedupTempos.length - 1].tick === te.tick) {
                dedupTempos[dedupTempos.length - 1] = te;
            } else {
                dedupTempos.push({ ...te, timeSec: 0 });
            }
        });

        for (let i = 1; i < dedupTempos.length; i++) {
            const prev = dedupTempos[i - 1];
            const deltaTicks = dedupTempos[i].tick - prev.tick;
            dedupTempos[i].timeSec = prev.timeSec + (deltaTicks / resolution) * (prev.usPerQuarter / 1000000);
        }

        const tickToSeconds = (targetTick) => {
            let active = dedupTempos[0];
            for (let i = 1; i < dedupTempos.length; i++) {
                if (dedupTempos[i].tick <= targetTick) active = dedupTempos[i];
                else break;
            }
            const remTicks = Math.max(0, targetTick - active.tick);
            return active.timeSec + (remTicks / resolution) * (active.usPerQuarter / 1000000);
        };

        const secondsToTick = (targetSec) => {
            let active = dedupTempos[0];
            for (let i = 1; i < dedupTempos.length; i++) {
                if (dedupTempos[i].timeSec <= targetSec) active = dedupTempos[i];
                else break;
            }
            const remSec = Math.max(0, targetSec - active.timeSec);
            const beats = remSec / (active.usPerQuarter / 1000000);
            return Math.round(active.tick + beats * resolution);
        };

        return {
            formatType,
            resolution,
            maxTick,
            tempos: dedupTempos,
            timeSignatures,
            embeddedLyrics,
            tracks: finalTracks,
            tickToSeconds,
            secondsToTick
        };
    }

    static pitchToNoteName(pitch) {
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const oct = Math.floor(pitch / 12) - 1;
        return `${names[pitch % 12]}${oct}`;
    }
}

window.MidiParser = MidiParser;