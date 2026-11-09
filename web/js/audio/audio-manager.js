/**
 * Chart-Lab - Dual Audio & Polyphonic MIDI Synthesizer Engine
 * Combina decodificación de Stems con síntesis WebAudio para pistas MIDI.
 */
class AudioManager {
    constructor() {
        this.ctx = null;
        this.stems = {}; // { key: { buffer, file, mute, solo, gainNode } }
        this.sourceNodes = [];
        this.midiNotes = []; // [{ timeSec, durationSec, pitch, channel, trackIndex }]
        this.beatTimesSec = [];
        this.waveformPeaks = new Float32Array(0);

        this.isPlaying = false;
        this.startTimeCtx = 0;
        this.pauseOffsetSec = 0;
        this.playbackRate = 1.0;
        this.offsetMs = 0;
        this.durationSec = 180;

        this.sourceMode = 'both'; // 'both' | 'stems_only' | 'midi_only'
        this.midiVolume = 0.7;
        this.stemMasterVolume = 0.9;
        this.metronomeEnabled = false;
        this.previewTrackIndex = null; // null = todas las pistas asignadas

        this.schedulerTimer = null;
        this.lastScheduledSec = -1;
    }

    initContext() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMidiPlaybackData(parsedMidi) {
        this.midiNotes = [];
        this.beatTimesSec = [];
        if (!parsedMidi) return;

        let maxTime = 10;
        parsedMidi.tracks.forEach((trk, idx) => {
            trk.notes.forEach(n => {
                const startSec = parsedMidi.tickToSeconds(n.tick);
                const endSec = parsedMidi.tickToSeconds(n.tick + n.durationTicks);
                if (endSec > maxTime) maxTime = endSec;
                this.midiNotes.push({
                    timeSec: startSec,
                    durationSec: Math.max(0.05, endSec - startSec),
                    pitch: n.pitch,
                    velocity: n.velocity || 90,
                    channel: n.channel || 0,
                    trackIndex: idx
                });
            });
        });

        this.midiNotes.sort((a, b) => a.timeSec - b.timeSec);
        const totalBeats = Math.ceil((parsedMidi.maxTick || 0) / parsedMidi.resolution);
        for (let b = 0; b <= totalBeats; b++) {
            this.beatTimesSec.push(parsedMidi.tickToSeconds(b * parsedMidi.resolution));
        }

        if (Object.keys(this.stems).length === 0) {
            this.durationSec = maxTime + 2;
        }
    }

    async loadStemFile(slotKey, file) {
        this.initContext();
        const arrayBuf = await file.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuf);

        this.stems[slotKey] = {
            buffer: audioBuffer,
            file: file,
            mute: false,
            solo: false
        };

        if (audioBuffer.duration > this.durationSec || Object.keys(this.stems).length === 1) {
            this.durationSec = audioBuffer.duration;
        }

        // Calcular picos de forma de onda sobre la pista principal o el primer stem cargado
        if (slotKey === 'song' || this.waveformPeaks.length === 0) {
            this.computeWaveformPeaks(audioBuffer, 2400);
        }
        return audioBuffer.duration;
    }

    computeWaveformPeaks(audioBuffer, numBuckets = 2400) {
        const raw = audioBuffer.getChannelData(0);
        const blockSize = Math.max(1, Math.floor(raw.length / numBuckets));
        this.waveformPeaks = new Float32Array(numBuckets);

        for (let i = 0; i < numBuckets; i++) {
            let max = 0;
            const start = i * blockSize;
            for (let j = 0; j < blockSize && (start + j) < raw.length; j++) {
                const v = Math.abs(raw[start + j]);
                if (v > max) max = v;
            }
            this.waveformPeaks[i] = max;
        }
    }

    getCurrentTimeSec() {
        if (!this.isPlaying || !this.ctx) return this.pauseOffsetSec;
        const elapsed = (this.ctx.currentTime - this.startTimeCtx) * this.playbackRate;
        const current = this.pauseOffsetSec + elapsed;
        if (current >= this.durationSec) {
            this.pause();
            this.pauseOffsetSec = 0;
            return 0;
        }
        return current;
    }

    play(onlyTrackIndex = null) {
        this.initContext();
        if (this.isPlaying) this.stopSourcesOnly();

        this.previewTrackIndex = onlyTrackIndex;
        this.startTimeCtx = this.ctx.currentTime;
        this.lastScheduledSec = this.pauseOffsetSec - 0.01;
        this.isPlaying = true;

        if (this.sourceMode !== 'midi_only' && this.previewTrackIndex === null) {
            this.startStemNodes(this.pauseOffsetSec);
        }

        this.schedulerTimer = setInterval(() => this.scheduleLookahead(), 25);
    }

    pause() {
        if (!this.isPlaying) return;
        this.pauseOffsetSec = this.getCurrentTimeSec();
        this.stopSourcesOnly();
        this.isPlaying = false;
        this.previewTrackIndex = null;
    }

    seek(timeSec) {
        const wasPlaying = this.isPlaying;
        const prevTrack = this.previewTrackIndex;
        if (wasPlaying) this.pause();
        this.pauseOffsetSec = Math.max(0, Math.min(this.durationSec, timeSec));
        if (wasPlaying) this.play(prevTrack);
    }

    stopSourcesOnly() {
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }
        this.sourceNodes.forEach(node => {
            try { node.stop(); node.disconnect(); } catch (e) {}
        });
        this.sourceNodes = [];
    }

    startStemNodes(offsetSec) {
        const anySolo = Object.values(this.stems).some(s => s.solo);
        Object.entries(this.stems).forEach(([key, stem]) => {
            if (!stem.buffer) return;
            const audible = anySolo ? stem.solo : !stem.mute;
            if (!audible) return;

            const source = this.ctx.createBufferSource();
            const gain = this.ctx.createGain();
            source.buffer = stem.buffer;
            source.playbackRate.value = this.playbackRate;
            gain.gain.value = this.stemMasterVolume;

            source.connect(gain);
            gain.connect(this.ctx.destination);

            const startInBuffer = Math.max(0, offsetSec);
            if (startInBuffer < stem.buffer.duration) {
                source.start(0, startInBuffer);
                this.sourceNodes.push(source);
            }
        });
    }

    scheduleLookahead() {
        if (!this.isPlaying || !this.ctx) return;
        const nowSec = this.getCurrentTimeSec();
        const lookaheadSec = nowSec + 0.12 * this.playbackRate;
        const offsetSec = (this.offsetMs || 0) / 1000;

        // 1. Sintetizar notas MIDI dentro de la ventana de lookahead
        if (this.sourceMode !== 'stems_only' && this.midiVolume > 0.01) {
            for (let i = 0; i < this.midiNotes.length; i++) {
                const n = this.midiNotes[i];
                const noteAudioTime = n.timeSec + offsetSec;
                if (noteAudioTime <= this.lastScheduledSec) continue;
                if (noteAudioTime > lookaheadSec) break;

                if (this.previewTrackIndex !== null && n.trackIndex !== this.previewTrackIndex) {
                    continue;
                }

                const delayCtx = Math.max(0, (noteAudioTime - nowSec) / this.playbackRate);
                this.triggerSynthNote(n.pitch, n.durationSec / this.playbackRate, n.channel === 9, delayCtx);
            }
        }

        // 2. Metrónomo de alta precisión
        if (this.metronomeEnabled) {
            for (let b = 0; b < this.beatTimesSec.length; b++) {
                const beatAudioTime = this.beatTimesSec[b] + offsetSec;
                if (beatAudioTime <= this.lastScheduledSec) continue;
                if (beatAudioTime > lookaheadSec) break;

                const delayCtx = Math.max(0, (beatAudioTime - nowSec) / this.playbackRate);
                this.triggerMetronomeClick(b % 4 === 0, delayCtx);
            }
        }

        this.lastScheduledSec = lookaheadSec;
    }

    triggerSynthNote(pitch, duration, isDrum, delayCtx) {
        const start = this.ctx.currentTime + delayCtx;
        const gain = this.ctx.createGain();
        const peakGain = (0.14 * this.midiVolume);

        if (isDrum) {
            const osc = this.ctx.createOscillator();
            osc.type = pitch < 40 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(pitch < 40 ? 110 : 280, start);
            osc.frequency.exponentialRampToValueAtTime(35, start + 0.09);

            gain.gain.setValueAtTime(peakGain * 1.4, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + 0.11);
            return;
        }

        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        const freq = 440 * Math.pow(2, (pitch - 69) / 12);
        osc.frequency.setValueAtTime(freq, start);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(4200, freq * 3.5), start);

        const dur = Math.min(1.5, Math.max(0.06, duration));
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(peakGain, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + dur + 0.02);
    }

    triggerMetronomeClick(isDownbeat, delayCtx) {
        const start = this.ctx.currentTime + delayCtx;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(isDownbeat ? 1200 : 800, start);

        gain.gain.setValueAtTime(0.18, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.045);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.05);
    }
}

window.AudioManager = AudioManager;