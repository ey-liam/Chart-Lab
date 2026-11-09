/**
 * Chart-Lab - Web Audio Engine & Stems Manager
 * Supports:
 * 1. Single audio file or multi-stem playback (guitar, bass, drums, vocals, song).
 * 2. Real-time millisecond offset compensation.
 * 3. Mute & solo per stem.
 * 4. Built-in Web Audio polyphonic synthesizer for preview without audio files.
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
            this.stems = {
                song: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Backing / Full' },
                guitar: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Guitar Stem' },
                bass: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Bass Stem' },
                drums: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Drums Stem' },
                vocals: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Vocals Stem' },
                keys: { buffer: null, source: null, gain: null, isMuted: false, isSolo: false, file: null, name: 'Keys Stem' }
            };

            this.isPlaying = false;
            this.playbackRate = 1.0;
            this.audioOffsetMs = 0; // Milliseconds to adjust chart vs audio
            this.startTime = 0;
            this.pauseTime = 0;
            this.duration = 0;

            // Synth fallback settings
            this.enableSynthFallback = true;
            this.synthGain = null;
        }

        initContext() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioCtx();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
                this.masterGain.connect(this.ctx.destination);

                this.synthGain = this.ctx.createGain();
                this.synthGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
                this.synthGain.connect(this.masterGain);

                for (let key in this.stems) {
                    const g = this.ctx.createGain();
                    g.gain.setValueAtTime(1.0, this.ctx.currentTime);
                    g.connect(this.masterGain);
                    this.stems[key].gain = g;
                }
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
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

            const hasSolo = Object.values(this.stems).some(s => s.isSolo);

            for (let key in this.stems) {
                const stem = this.stems[key];
                if (stem.buffer) {
                    const src = this.ctx.createBufferSource();
                    src.buffer = stem.buffer;
                    src.playbackRate.setValueAtTime(this.playbackRate, this.ctx.currentTime);

                    // Volume based on mute / solo
                    let targetVol = 1.0;
                    if (stem.isMuted) targetVol = 0;
                    else if (hasSolo && !stem.isSolo) targetVol = 0;

                    stem.gain.gain.setValueAtTime(targetVol, this.ctx.currentTime);
                    src.connect(stem.gain);

                    // Apply audio offset in seconds
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

        pause() {
            if (!this.isPlaying) return;
            this.pauseTime = this.getCurrentTime();
            this.isPlaying = false;

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

        seekTo(sec) {
            const wasPlaying = this.isPlaying;
            if (wasPlaying) this.pause();
            this.pauseTime = Math.max(0, sec);
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

        playMetronomeClick(isDownbeat = false) {
            this.initContext();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(isDownbeat ? 1000 : 750, this.ctx.currentTime);
            gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.06);
        }

        setAudioOffsetMs(ms) {
            this.audioOffsetMs = ms;
        }

        setStemMute(stemKey, isMuted) {
            if (this.stems[stemKey]) {
                this.stems[stemKey].isMuted = isMuted;
                this.updateStemGains();
            }
        }

        setStemSolo(stemKey, isSolo) {
            if (this.stems[stemKey]) {
                this.stems[stemKey].isSolo = isSolo;
                this.updateStemGains();
            }
        }

        updateStemGains() {
            if (!this.ctx) return;
            const hasSolo = Object.values(this.stems).some(s => s.isSolo);

            for (let key in this.stems) {
                const stem = this.stems[key];
                if (stem.gain) {
                    let vol = 1.0;
                    if (stem.isMuted) vol = 0;
                    else if (hasSolo && !stem.isSolo) vol = 0;
                    stem.gain.gain.setValueAtTime(vol, this.ctx.currentTime);
                }
            }
        }

        /**
         * Synthesize a note pitch in real-time when no audio file is provided
         */
        playSynthNote(instrumentType, midiPitch, durationSec = 0.3) {
            if (!this.enableSynthFallback || !this.ctx) return;
            const now = this.ctx.currentTime;
            const freq = 440 * Math.pow(2, (midiPitch - 69) / 12);

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            if (instrumentType === 'bass') {
                osc.type = 'sawtooth';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(400, now);
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + Math.max(0.15, durationSec));
            } else if (instrumentType === 'drums') {
                if (midiPitch === 0) {
                    // Kick
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(140, now);
                    osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
                    gain.gain.setValueAtTime(0.8, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                } else if (midiPitch === 1) {
                    // Snare: noise burst + sine body
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(180, now);
                    gain.gain.setValueAtTime(0.6, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                } else {
                    // Cymbals / Hi-hat
                    osc.type = 'square';
                    filter.type = 'highpass';
                    filter.frequency.setValueAtTime(6000, now);
                    gain.gain.setValueAtTime(0.25, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                }
            } else {
                // Guitar / Keys
                osc.type = 'sawtooth';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1800, now);
                filter.frequency.exponentialRampToValueAtTime(500, now + durationSec);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
            }

            osc.frequency.setValueAtTime(freq, now);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.synthGain);

            osc.start(now);
            osc.stop(now + Math.max(0.1, durationSec));
        }
    }

    return AudioEngine;
}));
