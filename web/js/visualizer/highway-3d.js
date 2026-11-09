/**
 * Chart-Lab - 3D Perspective Rhythm Highway Visualizer
 * Renders Clone Hero / Guitar Hero / GHL / Dance style highway with perspective notes, sustains,
 * beat lines, hit effects, and real-time karaoke lyrics banner.
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.HighwayVisualizer = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    const FRET_COLORS = {
        0: { fill: '#00e676', border: '#b9f6ca', glow: 'rgba(0, 230, 118, 0.6)' }, // Green
        1: { fill: '#ff1744', border: '#ff8a80', glow: 'rgba(255, 23, 68, 0.6)' },  // Red
        2: { fill: '#ffea00', border: '#ffff8d', glow: 'rgba(255, 234, 0, 0.6)' },  // Yellow
        3: { fill: '#2979ff', border: '#82b1ff', glow: 'rgba(41, 121, 255, 0.6)' }, // Blue
        4: { fill: '#ff9100', border: '#ffd180', glow: 'rgba(255, 145, 0, 0.6)' },  // Orange
        7: { fill: '#d500f9', border: '#ea80fc', glow: 'rgba(213, 0, 249, 0.8)' }   // Open Note Purple
    };

    const DRUM_COLORS = {
        0: { fill: '#ff6d00', border: '#ffe0b2', glow: 'rgba(255, 109, 0, 0.7)' }, // Kick
        1: { fill: '#ff1744', border: '#ff8a80', glow: 'rgba(255, 23, 68, 0.6)' }, // Red Snare
        2: { fill: '#ffea00', border: '#ffff8d', glow: 'rgba(255, 234, 0, 0.6)' }, // Yellow Tom/Hihat
        3: { fill: '#2979ff', border: '#82b1ff', glow: 'rgba(41, 121, 255, 0.6)' }, // Blue Tom/Ride
        4: { fill: '#00e676', border: '#b9f6ca', glow: 'rgba(0, 230, 118, 0.6)' }, // Green Tom/Crash
        5: { fill: '#a855f7', border: '#e9d5ff', glow: 'rgba(168, 85, 247, 0.6)' }  // 5th Pad
    };

    const GHL_COLORS = {
        0: { fill: '#d500f9', border: '#ea80fc', glow: 'rgba(213, 0, 249, 0.8)' }, // Open
        1: { fill: '#f8fafc', border: '#94a3b8', glow: 'rgba(248, 250, 252, 0.8)' }, // White 1
        2: { fill: '#f8fafc', border: '#94a3b8', glow: 'rgba(248, 250, 252, 0.8)' }, // White 2
        3: { fill: '#f8fafc', border: '#94a3b8', glow: 'rgba(248, 250, 252, 0.8)' }, // White 3
        4: { fill: '#0f172a', border: '#38bdf8', glow: 'rgba(56, 189, 248, 0.8)' },  // Black 1
        7: { fill: '#0f172a', border: '#38bdf8', glow: 'rgba(56, 189, 248, 0.8)' },  // Black 2
        8: { fill: '#0f172a', border: '#38bdf8', glow: 'rgba(56, 189, 248, 0.8)' }   // Black 3
    };

    const DANCE_COLORS = {
        0: { fill: '#00e676', border: '#b9f6ca', glow: 'rgba(0, 230, 118, 0.6)' }, // Left
        1: { fill: '#2979ff', border: '#82b1ff', glow: 'rgba(41, 121, 255, 0.6)' }, // Down
        2: { fill: '#d500f9', border: '#ea80fc', glow: 'rgba(213, 0, 249, 0.6)' }, // Up
        3: { fill: '#ff1744', border: '#ff8a80', glow: 'rgba(255, 23, 68, 0.6)' }  // Right
    };

    class HighwayVisualizer {
        constructor(canvas, audioEngine) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.audio = audioEngine;

            this.currentChart = null;
            this.currentEvents = null;
            this.midiData = null;

            this.selectedInstrument = 'guitar';
            this.selectedDifficulty = 'Expert';

            this.speedWindowSeconds = 2.2;
            this.isRunning = false;
            this.animId = null;

            this.hitParticles = [];

            this.metronomeEnabled = false;
            this.metronomeCallback = null;
            this.lastTriggeredBeat = -1;

            this.resize();
            window.addEventListener('resize', () => this.resize());
        }

        resize() {
            const rect = this.canvas.getBoundingClientRect();
            this.width = rect.width || 800;
            this.height = rect.height || 500;
            this.canvas.width = this.width * (window.devicePixelRatio || 1);
            this.canvas.height = this.height * (window.devicePixelRatio || 1);
            this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        }

        setSongData(midiData, chartedData, lyricEvents) {
            this.midiData = midiData;
            this.allCharts = chartedData;
            this.lyricEvents = lyricEvents || [];
            this.lastTriggeredBeat = -1;
            this.updateCurrentChart();
        }

        setMetronome(enabled, callback) {
            this.metronomeEnabled = !!enabled;
            this.metronomeCallback = callback || null;
            this.lastTriggeredBeat = -1;
        }

        updateCurrentChart() {
            if (this.allCharts && this.allCharts[this.selectedInstrument]) {
                this.currentChart = this.allCharts[this.selectedInstrument][this.selectedDifficulty] || [];
            } else {
                this.currentChart = [];
            }
        }

        setInstrument(inst) {
            this.selectedInstrument = inst;
            this.updateCurrentChart();
        }

        setDifficulty(diff) {
            this.selectedDifficulty = diff;
            this.updateCurrentChart();
        }

        start() {
            if (this.isRunning) return;
            this.isRunning = true;
            const loop = () => {
                if (this.isRunning) {
                    this.render();
                    this.animId = requestAnimationFrame(loop);
                }
            };
            this.animId = requestAnimationFrame(loop);
        }

        stop() {
            this.isRunning = false;
            if (this.animId) cancelAnimationFrame(this.animId);
        }

        render() {
            const ctx = this.ctx;
            const w = this.width;
            const h = this.height;

            ctx.clearRect(0, 0, w, h);

            const currentTime = this.audio ? this.audio.getCurrentTime() : 0;
            const isDrumMode = this.selectedInstrument.includes('drum');
            const isGHLMode = this.selectedInstrument.includes('ghl');
            const isDanceMode = this.selectedInstrument === 'dance';

            // Metronome audio pulse on downbeat/beat
            if (this.metronomeEnabled && this.metronomeCallback && this.midiData && this.midiData.tempos && this.midiData.tempos.length > 0 && this.audio && this.audio.isPlaying) {
                const bpm = this.midiData.tempos[0].bpm || 120;
                const beatIntervalSec = 60.0 / bpm;
                const currentBeat = Math.floor(currentTime / beatIntervalSec);
                if (currentBeat !== this.lastTriggeredBeat && currentBeat >= 0) {
                    this.lastTriggeredBeat = currentBeat;
                    const isDownbeat = (currentBeat % 4 === 0);
                    this.metronomeCallback(isDownbeat);
                }
            }

            // 1. Draw Background & Highway Surface
            this.drawHighway(ctx, w, h, isDrumMode, isGHLMode, isDanceMode);

            // 2. Draw Moving Beat & Measure Lines
            if (this.midiData) {
                this.drawBeatLines(ctx, w, h, currentTime);
            }

            // 3. Draw Strike Target Line & Buttons
            this.drawStrikeLine(ctx, w, h, isDrumMode, isGHLMode, isDanceMode, currentTime);

            // 4. Draw Sustains and Notes
            if (this.currentChart && this.currentChart.length > 0 && this.midiData) {
                this.drawNotesAndSustains(ctx, w, h, currentTime, isDrumMode, isGHLMode, isDanceMode);
            }

            // 5. Draw Hit Sparkles
            this.drawParticles(ctx);

            // 6. Draw Karaoke Banner
            this.drawKaraokeBanner(ctx, w, h, currentTime);
        }

        getHighwayCoords(fret, progress, isDrumMode = false, isGHLMode = false, isDanceMode = false) {
            const horizonY = this.height * 0.16;
            const strikeY = this.height * 0.86;

            // Proportioned 3D highway (prevents ultra-wide horizontal stretching)
            const bottomWidth = Math.min(this.width * 0.85, 480);
            const topWidth = bottomWidth * 0.40;

            const y = horizonY + (strikeY - horizonY) * progress;
            const currentWidth = topWidth + (bottomWidth - topWidth) * progress;
            const centerX = this.width / 2;
            const leftX = centerX - currentWidth / 2;

            if (fret === 7 && !isGHLMode) {
                return { x: centerX, y, width: currentWidth, isFullWidth: true };
            }
            if (fret === 0 && isGHLMode) {
                return { x: centerX, y, width: currentWidth, isFullWidth: true };
            }

            let laneCount = 5;
            let col = fret;
            let yOffset = 0;

            if (isGHLMode) {
                laneCount = 3;
                if (fret === 1 || fret === 4) col = 0;
                else if (fret === 2 || fret === 7) col = 1;
                else if (fret === 3 || fret === 8) col = 2;

                // Black row slightly higher than white row
                if (fret === 4 || fret === 7 || fret === 8) yOffset = -8 * progress;
                else yOffset = 6 * progress;
            } else if (isDanceMode) {
                laneCount = 4;
                col = fret % 4;
            }

            const laneWidth = currentWidth / laneCount;
            const x = leftX + laneWidth * (col + 0.5);
            return { x, y: y + yOffset, width: laneWidth, isFullWidth: false };
        }

        drawHighway(ctx, w, h, isDrumMode, isGHLMode, isDanceMode) {
            const horizonY = h * 0.16;
            const strikeY = h * 0.86;
            const botW = Math.min(w * 0.85, 480);
            const topW = botW * 0.40;
            const centerX = w / 2;

            const grad = ctx.createLinearGradient(centerX, horizonY, centerX, strikeY);
            grad.addColorStop(0, '#0d1117');
            grad.addColorStop(0.5, '#161b22');
            grad.addColorStop(1, '#0a0d14');

            ctx.beginPath();
            ctx.moveTo(centerX - topW / 2, horizonY);
            ctx.lineTo(centerX + topW / 2, horizonY);
            ctx.lineTo(centerX + botW / 2, strikeY);
            ctx.lineTo(centerX - botW / 2, strikeY);
            ctx.closePath();

            ctx.fillStyle = grad;
            ctx.fill();

            ctx.lineWidth = 3;
            ctx.strokeStyle = isDrumMode ? '#ff6d00' : (isGHLMode ? '#f8fafc' : '#2979ff');
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Lane dividers
            const laneCount = isGHLMode ? 3 : (isDanceMode ? 4 : 5);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            for (let i = 1; i < laneCount; i++) {
                const topX = (centerX - topW / 2) + (topW / laneCount) * i;
                const botX = (centerX - botW / 2) + (botW / laneCount) * i;
                ctx.beginPath();
                ctx.moveTo(topX, horizonY);
                ctx.lineTo(botX, strikeY);
                ctx.stroke();
            }
        }

        drawBeatLines(ctx, w, h, currentTime) {
            const minTime = currentTime;
            const maxTime = currentTime + this.speedWindowSeconds;

            if (!this.midiData.tempos || this.midiData.tempos.length === 0) return;
            const bpm = this.midiData.tempos[0].bpm || 120;
            const beatIntervalSec = 60.0 / bpm;

            const startBeat = Math.floor(minTime / beatIntervalSec);
            const endBeat = Math.ceil(maxTime / beatIntervalSec);

            ctx.lineWidth = 1;
            for (let b = startBeat; b <= endBeat; b++) {
                const beatTime = b * beatIntervalSec;
                if (beatTime < minTime || beatTime > maxTime) continue;

                const delta = beatTime - currentTime;
                const progress = 1 - (delta / this.speedWindowSeconds);
                if (progress < 0 || progress > 1) continue;

                const isMeasure = (b % 4 === 0);
                ctx.strokeStyle = isMeasure ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)';
                ctx.lineWidth = isMeasure ? 2 : 1;

                const pLeft = this.getHighwayCoords(0, progress);
                const pRight = this.getHighwayCoords(4, progress);

                ctx.beginPath();
                ctx.moveTo(pLeft.x - pLeft.width / 2, pLeft.y);
                ctx.lineTo(pRight.x + pRight.width / 2, pRight.y);
                ctx.stroke();
            }
        }

        drawStrikeLine(ctx, w, h, isDrumMode, isGHLMode, isDanceMode, currentTime) {
            const strikeY = h * 0.86;
            const botW = Math.min(w * 0.85, 480);
            const centerX = w / 2;

            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.moveTo(centerX - botW / 2, strikeY);
            ctx.lineTo(centerX + botW / 2, strikeY);
            ctx.stroke();

            const laneCount = isGHLMode ? 3 : (isDanceMode ? 4 : 5);
            const laneWidth = botW / laneCount;
            let colors = FRET_COLORS;
            if (isDrumMode) colors = DRUM_COLORS;
            else if (isGHLMode) colors = GHL_COLORS;
            else if (isDanceMode) colors = DANCE_COLORS;

            for (let f = 0; f < laneCount; f++) {
                const cx = (centerX - botW / 2) + laneWidth * (f + 0.5);
                const c = colors[f] || colors[0];

                ctx.save();
                ctx.beginPath();
                ctx.ellipse(cx, strikeY, laneWidth * 0.38, 10, 0, 0, Math.PI * 2);
                ctx.lineWidth = 2;
                ctx.strokeStyle = c.border;
                ctx.fillStyle = 'rgba(10, 15, 25, 0.7)';
                ctx.fill();
                ctx.stroke();

                ctx.beginPath();
                ctx.ellipse(cx, strikeY, laneWidth * 0.18, 4, 0, 0, Math.PI * 2);
                ctx.fillStyle = c.fill;
                ctx.fill();
                ctx.restore();
            }
        }

        drawNotesAndSustains(ctx, w, h, currentTime, isDrumMode, isGHLMode, isDanceMode) {
            const minTime = currentTime - 0.2;
            const maxTime = currentTime + this.speedWindowSeconds;

            const visibleEvents = this.currentChart.filter(ev => {
                if (ev.isCymbalMarker) return false;
                const noteTime = this.midiData.tickToSeconds(ev.tick);
                const sustainSec = ev.sustain ? (this.midiData.tickToSeconds(ev.tick + ev.sustain) - noteTime) : 0;
                return (noteTime + sustainSec >= minTime) && (noteTime <= maxTime);
            });

            let colors = FRET_COLORS;
            if (isDrumMode) colors = DRUM_COLORS;
            else if (isGHLMode) colors = GHL_COLORS;
            else if (isDanceMode) colors = DANCE_COLORS;

            // Sustains
            for (let ev of visibleEvents) {
                if (ev.sustain && ev.sustain > 0) {
                    const startSec = this.midiData.tickToSeconds(ev.tick);
                    const endSec = this.midiData.tickToSeconds(ev.tick + ev.sustain);

                    const startProgress = Math.max(0, Math.min(1, 1 - (startSec - currentTime) / this.speedWindowSeconds));
                    const endProgress = Math.max(0, Math.min(1, 1 - (endSec - currentTime) / this.speedWindowSeconds));

                    const pStart = this.getHighwayCoords(ev.fret, startProgress, isDrumMode, isGHLMode, isDanceMode);
                    const pEnd = this.getHighwayCoords(ev.fret, endProgress, isDrumMode, isGHLMode, isDanceMode);

                    const c = colors[ev.fret] || colors[0];
                    ctx.save();
                    ctx.lineWidth = Math.max(4, pStart.width * 0.18);
                    ctx.strokeStyle = c.glow;
                    ctx.shadowColor = c.fill;
                    ctx.shadowBlur = 6;
                    ctx.beginPath();
                    ctx.moveTo(pStart.x, pStart.y);
                    ctx.lineTo(pEnd.x, pEnd.y);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // Notes / Gems
            for (let ev of visibleEvents) {
                const noteTime = this.midiData.tickToSeconds(ev.tick);
                const delta = noteTime - currentTime;
                const progress = 1 - (delta / this.speedWindowSeconds);

                if (progress < 0 || progress > 1.05) continue;

                if (Math.abs(delta) < 0.04 && !ev._hitTriggered && this.audio && this.audio.isPlaying) {
                    ev._hitTriggered = true;
                    this.triggerHit(ev.fret, isDrumMode, isGHLMode, isDanceMode);
                } else if (delta > 0.05) {
                    ev._hitTriggered = false;
                }

                const coord = this.getHighwayCoords(ev.fret, progress, isDrumMode, isGHLMode, isDanceMode);
                const c = colors[ev.fret] || colors[0];

                ctx.save();
                if (coord.isFullWidth) {
                    ctx.fillStyle = c.fill;
                    ctx.shadowColor = c.glow;
                    ctx.shadowBlur = 12;
                    ctx.fillRect(coord.x - coord.width / 2 + 10, coord.y - 6, coord.width - 20, 12);
                } else if (isDrumMode && ev.fret === 0) {
                    const kickW = coord.width * 5;
                    ctx.fillStyle = c.fill;
                    ctx.shadowColor = c.glow;
                    ctx.shadowBlur = 10;
                    ctx.fillRect(this.width / 2 - kickW / 2 + 8, coord.y - 5, kickW - 16, 10);
                } else {
                    const radiusX = Math.max(8, coord.width * 0.36);
                    const radiusY = Math.max(5, 7 + 4 * progress);

                    ctx.shadowColor = c.glow;
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.ellipse(coord.x, coord.y, radiusX, radiusY, 0, 0, Math.PI * 2);
                    ctx.fillStyle = c.fill;
                    ctx.fill();

                    ctx.lineWidth = 2;
                    ctx.strokeStyle = c.border;
                    ctx.stroke();

                    // Highlight
                    ctx.beginPath();
                    ctx.ellipse(coord.x, coord.y - radiusY * 0.2, radiusX * 0.5, radiusY * 0.35, 0, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        triggerHit(fret, isDrumMode, isGHLMode, isDanceMode) {
            const coord = this.getHighwayCoords(fret, 1.0, isDrumMode, isGHLMode, isDanceMode);
            let colors = FRET_COLORS;
            if (isDrumMode) colors = DRUM_COLORS;
            else if (isGHLMode) colors = GHL_COLORS;
            else if (isDanceMode) colors = DANCE_COLORS;
            const c = colors[fret] || colors[0];

            for (let i = 0; i < 8; i++) {
                this.hitParticles.push({
                    x: coord.x,
                    y: coord.y,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6 - 2,
                    color: c.fill,
                    alpha: 1.0,
                    size: Math.random() * 4 + 2
                });
            }
        }

        drawParticles(ctx) {
            for (let i = this.hitParticles.length - 1; i >= 0; i--) {
                const p = this.hitParticles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.05;

                if (p.alpha <= 0) {
                    this.hitParticles.splice(i, 1);
                    continue;
                }

                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        drawKaraokeBanner(ctx, w, h, currentTime) {
            if (!this.lyricEvents || this.lyricEvents.length === 0 || !this.midiData) return;

            const currentLyrics = [];
            for (let ev of this.lyricEvents) {
                const evTime = this.midiData.tickToSeconds(ev.tick);
                if (Math.abs(evTime - currentTime) < 2.0 && ev.eventText && ev.eventText.startsWith('lyric ')) {
                    currentLyrics.push(ev.eventText.replace('lyric ', ''));
                }
            }

            if (currentLyrics.length > 0) {
                const text = currentLyrics.join('');
                ctx.save();
                ctx.fillStyle = 'rgba(10, 15, 25, 0.75)';
                ctx.fillRect(w * 0.15, 15, w * 0.7, 36);
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 1;
                ctx.strokeRect(w * 0.15, 15, w * 0.7, 36);

                ctx.font = 'bold 16px sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.fillText(text, w / 2, 38);
                ctx.restore();
            }
        }
    }

    return HighwayVisualizer;
}));
