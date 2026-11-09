/**
 * Chart-Lab - Advanced Web Audio Engine & Polyphonic MIDI Synthesizer
 * Supports:
 * 1. Multi-stem audio playback (song, guitar, bass, drums, vocals, keys).
 * 2. Lookahead sample-accurate MIDI Synthesizer (real guitar, bass, drums, keys, vocals).
 * 3. Playback mode: MIDI Only, Audio Only, or Both simultaneously.
 * 4. MIDI track audition filter (All tracks, or isolated instrument).
 * 5. High-precision waveform extraction & beat-grid synchronizer.
 * 6. Slow-motion playback (0.5x, 0.75x, 1.0x, 1.25x) and Metronome.
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AudioEngine = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    class AudioEngine {
        constructor() {
            this.ctx = null;
            this.masterGain = null;
            this.audioStemsGain = null;
            this.midiSynthGain = null;

            this.stems = {
                song: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Canción Completa (song.ogg)' },
                guitar: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Guitarra (Guitar.wav)' },
                bass: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Bajo (Bass.wav)' },
                drums: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Batería (Drums.wav)' },
                vocals: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Voz (Vocals.wav)' },
                keys: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Teclado (Keys.wav)' }
            };

            this.isPlaying = false;
            this.playbackRate = 1.0;
            this.audioOffsetMs = 0;
            this.startTime = 0;
            this.pauseTime = 0;
            this.duration = 0;

            // Audio Mode: 'both' | 'midi' | 'audio'
            this.audioMode = 'both';

            // MIDI Track Filter: 'all' | 'guitar' | 'bass' | 'drums' | 'vocals' | 'keys'
            this.midiAudition = 'all';

            // MIDI Data & Scheduling
            this.midiData = null;
            this.schedulerInterval = null;
            this.lastScheduledTime = 0;
            this.scheduledNoteKeys = new Set();

            // Pre-generated white noise buffer for snare and cymbals
            this.noiseBuffer = null;
        }

        initContext() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx();

                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
                this.masterGain.connect(this.ctx.destination);

                this.audioStemsGain = this.ctx.createGain();
                this.audioStemsGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
                this.audioStemsGain.connect(this.masterGain);

                this.midiSynthGain = this.ctx.createGain();
                this.midiSynthGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
                this.midiSynthGain.connect(this.masterGain);

                for (let key in this.stems) {
                    const g = this.ctx.createGain();
                    g.gain.setValueAtTime(1.0, this.ctx.currentTime);
                    g.connect(this.audioStemsGain);
                    this.stems[key].gain = g;
                }

                this.createNoiseBuffer();
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }

        createNoiseBuffer() {
            if (!this.ctx) return;
            const bufferSize = this.ctx.sampleRate * 2;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            this.noiseBuffer = buffer;
        }

        setMidiData(midiData) {
            this.midiData = midiData;
            if (midiData && midiData.totalDurationSec && (!this.duration || this.duration < midiData.totalDurationSec)) {
                this.duration = midiData.totalDurationSec;
            }
        }

        setAudioMode(mode) {
            this.audioMode = mode; // 'both' | 'midi' | 'audio'
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            if (mode === 'midi') {
                this.audioStemsGain.gain.setValueAtTime(0, now);
                this.midiSynthGain.gain.setValueAtTime(0.8, now);
            } else if (mode === 'audio') {
                this.audioStemsGain.gain.setValueAtTime(1.0, now);
                this.midiSynthGain.gain.setValueAtTime(0, now);
            } else {
                this.audioStemsGain.gain.setValueAtTime(1.0, now);
                this.midiSynthGain.gain.setValueAtTime(0.55, now);
            }
        }

        setMidiAudition(trackType) {
            this.midiAudition = trackType; // 'all' | 'guitar' | 'bass' | 'drums' | 'vocals' | 'keys'
        }

        setGlobalOffset(offsetMs) {
            this.audioOffsetMs = offsetMs;
            if (this.isPlaying) {
                const cur = this.getCurrentTime();
                this.pause();
                this.play(cur);
            }
        }

        async loadAudioFile(stemKey, fileOrBlob) {
            this.initContext();
            const arrayBuf = await fileOrBlob.arrayBuffer();
            const decoded = await this.ctx.decodeAudioData(arrayBuf);
            if (this.stems[stemKey]) {
                this.stems[stemKey].buffer = decoded;
                this.stems[stemKey].file = fileOrBlob;
                if (decoded.duration > this.duration) {
                    this.duration = decoded.duration;
                }
            }
            return decoded;
        }

        hasLoadedAudio() {
            for (let key in this.stems) {
                if (this.stems[key].buffer) return true;
            }
            return false;
        }

        play(startFromSec = null) {
            this.initContext();
            if (this.isPlaying) return;

            let resumeSec = startFromSec !== null ? startFromSec : this.pauseTime;
            if (resumeSec < 0) resumeSec = 0;
            if (this.duration > 0 && resumeSec >= this.duration) resumeSec = 0;

            this.startTime = this.ctx.currentTime - (resumeSec / this.playbackRate);
            this.isPlaying = true;
            this.lastScheduledTime = resumeSec;
            this.scheduledNoteKeys.clear();

            // 1. Play Audio Stems if present and enabled
            if (this.audioMode !== 'midi') {
                const hasSolo = Object.values(this.stems).some(s => s.isSolo);
                for (let key in this.stems) {
                    const stem = this.stems[key];
                    if (stem.buffer) {
                        const src = this.ctx.createBufferSource();
                        src.buffer = stem.buffer;
                        src.playbackRate.setValueAtTime(this.playbackRate, this.ctx.currentTime);

                        let targetVol = 1.0;
                        if (stem.isMuted) targetVol = 0;
                        else if (hasSolo && !stem.isSolo) targetVol = 0;

                        stem.gain.gain.setValueAtTime(targetVol, this.ctx.currentTime);
                        src.connect(stem.gain);

                        const offsetSec = (this.audioOffsetMs || 0) / 1000;
                        const stemStartTime = resumeSec + offsetSec;

                        if (stemStartTime >= 0 && stemStartTime < stem.buffer.duration) {
                            src.start(0, stemStartTime);
                        } else if (stemStartTime < 0) {
                            src.start(this.ctx.currentTime - stemStartTime, 0);
                        }
                        stem.source = src;
                    }
                }
            }

            // 2. Start MIDI Synthesizer Scheduler
            this.startMidiScheduler();
        }

        pause() {
            if (!this.isPlaying) return;
            this.pauseTime = this.getCurrentTime();
            this.isPlaying = false;
            this.stopMidiScheduler();

            for (let key in this.stems) {
                const stem = this.stems[key];
                if (stem.source) {
                    try {
                        stem.source.stop();
                        stem.source.disconnect();
                    } catch (e) {}
                    stem.source = null;
                }
            }
        }

        seek(sec) {
            const wasPlaying = this.isPlaying;
            if (wasPlaying) this.pause();
            this.pauseTime = Math.max(0, sec);
            this.lastScheduledTime = this.pauseTime;
            this.scheduledNoteKeys.clear();
            if (wasPlaying) this.play(this.pauseTime);
        }

        getCurrentTime() {
            if (!this.isPlaying || !this.ctx) {
                return this.pauseTime;
            }
            return (this.ctx.currentTime - this.startTime) * this.playbackRate;
        }

        setPlaybackRate(rate) {
            this.playbackRate = Math.max(0.25, Math.min(2.0, rate));
            if (this.isPlaying) {
                const cur = this.getCurrentTime();
                this.pause();
                this.play(cur);
            }
        }

        toggleMute(stemKey) {
            if (this.stems[stemKey]) {
                this.stems[stemKey].isMuted = !this.stems[stemKey].isMuted;
                if (this.stems[stemKey].gain && this.ctx) {
                    this.stems[stemKey].gain.gain.setValueAtTime(this.stems[stemKey].isMuted ? 0 : 1.0, this.ctx.currentTime);
                }
                return this.stems[stemKey].isMuted;
            }
            return false;
        }

        toggleSolo(stemKey) {
            if (this.stems[stemKey]) {
                this.stems[stemKey].isSolo = !this.stems[stemKey].isSolo;
                const hasSolo = Object.values(this.stems).some(s => s.isSolo);
                for (let k in this.stems) {
                    const st = this.stems[k];
                    if (st.gain && this.ctx) {
                        let vol = 1.0;
                        if (st.isMuted) vol = 0;
                        else if (hasSolo && !st.isSolo) vol = 0;
                        st.gain.gain.setValueAtTime(vol, this.ctx.currentTime);
                    }
                }
                return this.stems[stemKey].isSolo;
            }
            return false;
        }

        // ==========================================
        // Lookahead MIDI Synthesizer Engine
        // ==========================================

        startMidiScheduler() {
            this.stopMidiScheduler();
            this.schedulerInterval = setInterval(() => {
                this.processMidiSchedule();
            }, 30);
        }

        stopMidiScheduler() {
            if (this.schedulerInterval) {
                clearInterval(this.schedulerInterval);
                this.schedulerInterval = null;
            }
        }

        processMidiSchedule() {
            if (!this.isPlaying || !this.midiData || this.audioMode === 'audio' || !this.ctx) return;

            const curSongTime = this.getCurrentTime();
            const lookaheadSec = 0.12; // Look ahead 120ms
            const windowEnd = curSongTime + lookaheadSec;

            const tracks = this.midiData.tracks || [];

            for (let track of tracks) {
                if (!track.notes || track.notes.length === 0) continue;

                const instType = this.classifyTrackInstrument(track);
                if (this.midiAudition !== 'all' && this.midiAudition !== instType) {
                    continue;
                }

                for (let note of track.notes) {
                    const noteTimeSec = note.timeSec !== undefined ? note.timeSec : this.midiData.tickToSeconds(note.tick);
                    if (noteTimeSec >= this.lastScheduledTime && noteTimeSec < windowEnd) {
                        const noteKey = `${track.id}_${note.tick}_${note.pitch}`;
                        if (!this.scheduledNoteKeys.has(noteKey)) {
                            this.scheduledNoteKeys.add(noteKey);

                            const noteDurSec = note.durationSec !== undefined ? note.durationSec : (this.midiData.tickToSeconds(note.tick + note.durationTicks) - noteTimeSec);
                            const audioCtxStartTime = this.startTime + (noteTimeSec / this.playbackRate);
                            const audioCtxDuration = Math.max(0.08, noteDurSec / this.playbackRate);

                            if (audioCtxStartTime >= this.ctx.currentTime - 0.05) {
                                this.synthesizeMidiNote(instType, note.pitch, audioCtxStartTime, audioCtxDuration, note.velocity || 90);
                            }
                        }
                    }
                }
            }

            this.lastScheduledTime = curSongTime;
        }

        classifyTrackInstrument(track) {
            const name = (track.name || '').toLowerCase();
            const inst = (track.instrumentName || '').toLowerCase();
            if (track.isPercussion || track.channel === 9 || name.includes('drum') || name.includes('perc')) return 'drums';
            if (name.includes('bass') || inst.includes('bass')) return 'bass';
            if (name.includes('vocal') || name.includes('voice') || name.includes('sing') || name.includes('lead vocal')) return 'vocals';
            if (name.includes('key') || name.includes('piano') || name.includes('organ') || name.includes('synth')) return 'keys';
            return 'guitar';
        }

        synthesizeMidiNote(instType, pitch, atTime, durationSec, velocity = 90) {
            const velNorm = Math.min(1.0, Math.max(0.2, velocity / 127.0));
            const freq = 440 * Math.pow(2, (pitch - 69) / 12);
            const now = Math.max(this.ctx.currentTime, atTime);

            if (instType === 'drums') {
                this.synthesizeDrumSound(pitch, now, velNorm);
                return;
            }

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            if (instType === 'bass') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, now);
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(380, now);
                gain.gain.setValueAtTime(0.55 * velNorm, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(durationSec, 0.9));
            } else if (instType === 'vocals') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, now);
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(freq * 1.5, now);
                filter.Q.setValueAtTime(1.5, now);
                gain.gain.setValueAtTime(0.35 * velNorm, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
            } else if (instType === 'keys') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2200, now);
                gain.gain.setValueAtTime(0.4 * velNorm, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
            } else {
                // Guitar / Lead
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, now);
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1600, now);
                filter.frequency.exponentialRampToValueAtTime(450, now + Math.min(durationSec, 0.4));
                gain.gain.setValueAtTime(0.38 * velNorm, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
            }

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.midiSynthGain);

            try {
                osc.start(now);
                osc.stop(now + Math.max(0.08, durationSec));
            } catch (e) {}
        }

        synthesizeDrumSound(pitch, atTime, velNorm) {
            const now = Math.max(this.ctx.currentTime, atTime);

            if (pitch === 35 || pitch === 36) {
                // Kick
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
                gain.gain.setValueAtTime(0.85 * velNorm, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
                osc.connect(gain);
                gain.connect(this.midiSynthGain);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (pitch === 38 || pitch === 40) {
                // Snare
                if (this.noiseBuffer) {
                    const noise = this.ctx.createBufferSource();
                    noise.buffer = this.noiseBuffer;
                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'highpass';
                    filter.frequency.setValueAtTime(1000, now);
                    const gain = this.ctx.createGain();
                    gain.gain.setValueAtTime(0.6 * velNorm, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.midiSynthGain);
                    noise.start(now);
                    noise.stop(now + 0.13);
                }
            } else {
                // Hi-Hat / Cymbal / Tom
                if (this.noiseBuffer) {
                    const noise = this.ctx.createBufferSource();
                    noise.buffer = this.noiseBuffer;
                    const filter = this.ctx.createBiquadFilter();
                    filter.type = 'highpass';
                    filter.frequency.setValueAtTime(5000, now);
                    const gain = this.ctx.createGain();
                    gain.gain.setValueAtTime(0.25 * velNorm, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(this.midiSynthGain);
                    noise.start(now);
                    noise.stop(now + 0.09);
                }
            }
        }

        playMetronomeClick(isDownbeat = false) {
            this.initContext();
            if (!this.ctx) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(isDownbeat ? 1100 : 800, now);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now);
            osc.stop(now + 0.07);
        }

        // ==========================================
        // Waveform & Beat-Grid Audio Visualizer
        // ==========================================

        drawWaveform(canvas, midiData, offsetMs = 0, currentTime = 0) {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            // Background
            const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
            bgGrad.addColorStop(0, '#0a0f1d');
            bgGrad.addColorStop(1, '#05070e');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, w, h);

            // Center reference line
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);
            ctx.stroke();

            const audioBuffer = this.stems.song.buffer || Object.values(this.stems).find(s => s.buffer)?.buffer;
            const totalDuration = this.duration || (audioBuffer ? audioBuffer.duration : (midiData ? midiData.totalDurationSec : 180));

            // 1. Draw Waveform Peaks
            if (audioBuffer) {
                const channelData = audioBuffer.getChannelData(0);
                const step = Math.ceil(channelData.length / w);
                const amp = (h / 2) * 0.88;

                ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';

                for (let x = 0; x < w; x++) {
                    let min = 1.0;
                    let max = -1.0;
                    const startIdx = x * step;
                    const endIdx = Math.min(startIdx + step, channelData.length);

                    for (let j = startIdx; j < endIdx; j += 4) {
                        const val = channelData[j];
                        if (val < min) min = val;
                        if (val > max) max = val;
                    }
                    if (max < min) { min = 0; max = 0; }

                    const yTop = (h / 2) - (max * amp);
                    const yBot = (h / 2) - (min * amp);
                    ctx.fillRect(x, yTop, 1, Math.max(1, yBot - yTop));
                }
            } else {
                ctx.fillStyle = '#94a3b8';
                ctx.font = '14px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Cargue un archivo de audio para visualizar la forma de onda espectral', w / 2, h / 2 + 5);
            }

            // 2. Draw Beat & Measure Grid Lines from MIDI
            if (midiData && midiData.tempos && midiData.tempos.length > 0) {
                const bpm = midiData.tempos[0].bpm || 120;
                const beatSec = 60.0 / bpm;
                const offsetSec = (offsetMs || 0) / 1000;
                const totalBeats = Math.ceil((totalDuration - offsetSec) / beatSec);

                for (let b = 0; b <= totalBeats; b++) {
                    const beatTime = offsetSec + (b * beatSec);
                    if (beatTime < 0 || beatTime > totalDuration) continue;
                    const x = (beatTime / totalDuration) * w;

                    const isMeasure = (b % 4 === 0);
                    ctx.strokeStyle = isMeasure ? '#ffea00' : 'rgba(255, 255, 255, 0.25)';
                    ctx.lineWidth = isMeasure ? 2 : 1;

                    ctx.beginPath();
                    ctx.moveTo(x, isMeasure ? 0 : h * 0.25);
                    ctx.lineTo(x, isMeasure ? h : h * 0.75);
                    ctx.stroke();

                    if (isMeasure && x < w - 20) {
                        ctx.fillStyle = '#ffea00';
                        ctx.font = '10px monospace';
                        ctx.fillText(`M${b / 4 + 1}`, x + 4, 12);
                    }
                }
            }

            // 3. Playhead cursor
            if (currentTime > 0 && totalDuration > 0) {
                const curX = (currentTime / totalDuration) * w;
                ctx.strokeStyle = '#00e676';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#00e676';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.moveTo(curX, 0);
                ctx.lineTo(curX, h);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }
    }

    return AudioEngine;
}));
