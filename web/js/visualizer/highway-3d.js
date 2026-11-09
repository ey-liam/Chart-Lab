/**
 * MIDI-CH Studio Pro - 60 FPS 3D Perspective Rhythm Highway Visualizer
 * Renders Clone Hero / Guitar Hero style highway with perspective notes, sustains,
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
        4: { fill: '#00e676', border: '#b9f6ca', glow: 'rgba(0, 230, 118, 0.6)' }  // Green Tom/Crash
    };

    class HighwayVisualizer {
        constructor(canvas, audioEngine) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.audio = audioEngine;

            this.currentChart = null; // Charted events array
            this.currentEvents = null; // Lyric events array
            this.midiData = null;

            this.selectedInstrument = 'guitar';
            this.selectedDifficulty = 'Expert';

            this.speedWindowSeconds = 2.2; // Seconds visible on highway
            this.isRunning = false;
            this.animId = null;

            // Hit effects animation particles
            this.hitParticles = [];

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
            this.updateCurrentChart();
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
            const isDrumMode = this.selectedInstrument === 'drums';

            // 1. Draw Background & Highway Surface
            this.drawHighway(ctx, w, h, isDrumMode);

            // 2. Draw Moving Beat & Measure Lines
            if (this.midiData) {
                this.drawBeatLines(ctx, w, h, currentTime);
            }

            // 3. Draw Strike Target Line & Buttons
            this.drawStrikeLine(ctx, w, h, isDrumMode, currentTime);

            // 4. Draw Sustains and Notes
            if (this.currentChart && this.currentChart.length > 0 && this.midiData) {
                this.drawNotesAndSustains(ctx, w, h, currentTime, isDrumMode);
            }

            // 5. Draw Hit Sparkles / Particles
            this.drawParticles(ctx);

            // 6. Draw Real-time Karaoke Lyrics Banner
            this.drawKaraokeBanner(ctx, w, h, currentTime);
        }

        /**
         * Computes 3D perspective projection coordinates on the highway
         */
        getHighwayCoords(fret, progress, isDrumMode = false) {
            // progress: 0 = horizon, 1 = strike line
            const horizonY = this.height * 0.18;
            const strikeY = this.height * 0.86;

            const topWidth = this.width * 0.32;
            const bottomWidth = this.width * 0.72;

            const y = horizonY + (strikeY - horizonY) * progress;
            const currentWidth = topWidth + (bottomWidth - topWidth) * progress;
            const centerX = this.width / 2;
            const leftX = centerX - currentWidth / 2;

            const laneCount = 5;
            const laneWidth = currentWidth / laneCount;

            if (fret === 7) {
                // Open note spans across entire lane
                return { x: centerX, y, width: currentWidth, isFullWidth: true };
            }

            const x = leftX + laneWidth * (fret + 0.5);
            return { x, y, width: laneWidth, isFullWidth: false };
        }

        drawHighway(ctx, w, h, isDrumMode) {
            const horizonY = h * 0.18;
            const strikeY = h * 0.86;
            const topW = w * 0.32;
            const botW = w * 0.72;
            const centerX = w / 2;

            // Gradient Highway Board
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

            // Highway border rails (Neon glow)
            ctx.lineWidth = 3;
            ctx.strokeStyle = isDrumMode ? '#ff6d00' : '#2979ff';
            ctx.shadowColor = isDrumMode ? 'rgba(255, 109, 0, 0.8)' : 'rgba(41, 121, 255, 0.8)';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Lane Divider Lines (5 lanes = 4 internal lines)
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            for (let i = 1; i < 5; i++) {
                const topX = (centerX - topW / 2) + (topW / 5) * i;
                const botX = (centerX - botW / 2) + (botW / 5) * i;
                ctx.beginPath();
                ctx.moveTo(topX, horizonY);
                ctx.lineTo(botX, strikeY);
                ctx.stroke();
            }
        }

        drawBeatLines(ctx, w, h, currentTime) {
            const ppq = this.midiData.ppq || 480;
            const minTime = currentTime;
            const maxTime = currentTime + this.speedWindowSeconds;

            const minTick = this.midiData.secondsToTick(minTime);
            const maxTick = this.midiData.secondsToTick(maxTime);

            const beatTicks = ppq;
            const measureTicks = ppq * 4;

            const firstBeatTick = Math.floor(minTick / beatTicks) * beatTicks;

            for (let t = firstBeatTick; t <= maxTick; t += beatTicks) {
                const noteTime = this.midiData.tickToSeconds(t);
                const progress = (noteTime - currentTime) / this.speedWindowSeconds;
                if (progress < 0 || progress > 1) continue;

                const coord = this.getHighwayCoords(0, 1 - progress);
                const isMeasure = (t % measureTicks === 0);

                ctx.lineWidth = isMeasure ? 2 : 1;
                ctx.strokeStyle = isMeasure ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.18)';

                const currentWidth = (w * 0.32) + (w * 0.40) * (1 - progress);
                const leftX = (w / 2) - currentWidth / 2;
                const rightX = (w / 2) + currentWidth / 2;

                ctx.beginPath();
                ctx.moveTo(leftX, coord.y);
                ctx.lineTo(rightX, coord.y);
                ctx.stroke();
            }
        }

        drawStrikeLine(ctx, w, h, isDrumMode, currentTime) {
            const strikeY = h * 0.86;
            const botW = w * 0.72;
            const centerX = w / 2;

            // Strike line bar
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#ffffff';
            ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(centerX - botW / 2, strikeY);
            ctx.lineTo(centerX + botW / 2, strikeY);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Target Rings / Fret Buttons
            const colors = isDrumMode ? DRUM_COLORS : FRET_COLORS;
            const laneWidth = botW / 5;

            for (let f = 0; f < 5; f++) {
                const cx = (centerX - botW / 2) + laneWidth * (f + 0.5);
                const c = colors[f];

                ctx.save();
                ctx.beginPath();
                ctx.ellipse(cx, strikeY, laneWidth * 0.38, 10, 0, 0, Math.PI * 2);
                ctx.lineWidth = 2;
                ctx.strokeStyle = c.border;
                ctx.fillStyle = 'rgba(10, 15, 25, 0.7)';
                ctx.fill();
                ctx.stroke();

                // Inner glow dot
                ctx.beginPath();
                ctx.ellipse(cx, strikeY, laneWidth * 0.18, 4, 0, 0, Math.PI * 2);
                ctx.fillStyle = c.fill;
                ctx.fill();
                ctx.restore();
            }
        }

        drawNotesAndSustains(ctx, w, h, currentTime, isDrumMode) {
            const minTime = currentTime - 0.2;
            const maxTime = currentTime + this.speedWindowSeconds;

            const visibleEvents = this.currentChart.filter(ev => {
                const noteTime = this.midiData.tickToSeconds(ev.tick);
                const sustainSec = ev.sustain ? (this.midiData.tickToSeconds(ev.tick + ev.sustain) - noteTime) : 0;
                return (noteTime + sustainSec >= minTime) && (noteTime <= maxTime);
            });

            const colors = isDrumMode ? DRUM_COLORS : FRET_COLORS;

            // 1. Draw Sustains first so they render under gems
            for (let ev of visibleEvents) {
                if (ev.sustain && ev.sustain > 0) {
                    const startSec = this.midiData.tickToSeconds(ev.tick);
                    const endSec = this.midiData.tickToSeconds(ev.tick + ev.sustain);

                    const startProgress = Math.max(0, Math.min(1, 1 - (startSec - currentTime) / this.speedWindowSeconds));
                    const endProgress = Math.max(0, Math.min(1, 1 - (endSec - currentTime) / this.speedWindowSeconds));

                    const pStart = this.getHighwayCoords(ev.fret, startProgress);
                    const pEnd = this.getHighwayCoords(ev.fret, endProgress);

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

            // 2. Draw Notes / Gems
            for (let ev of visibleEvents) {
                const noteTime = this.midiData.tickToSeconds(ev.tick);
                const delta = noteTime - currentTime;
                const progress = 1 - (delta / this.speedWindowSeconds);

                if (progress < 0 || progress > 1.05) continue;

                // Trigger hit particles if crossed strike line
                if (Math.abs(delta) < 0.03 && !ev._hitTriggered && this.audio && this.audio.isPlaying) {
                    ev._hitTriggered = true;
                    this.triggerHit(ev.fret, isDrumMode);
                    // Synthesizer note if no audio
                    if (!this.audio.hasLoadedAudio()) {
                        this.audio.playSynthNote(this.selectedInstrument, ev.fret, 0.25);
                    }
                } else if (delta > 0.05) {
                    ev._hitTriggered = false;
                }

                const coord = this.getHighwayCoords(ev.fret, progress, isDrumMode);
                const c = colors[ev.fret] || colors[0];

                ctx.save();
                if (coord.isFullWidth) {
                    // Open note purple bar
                    ctx.fillStyle = c.fill;
                    ctx.shadowColor = c.glow;
                    ctx.shadowBlur = 12;
                    ctx.fillRect(coord.x - coord.width / 2 + 10, coord.y - 6, coord.width - 20, 12);
                } else if (isDrumMode && ev.fret === 0) {
                    // Drum Kick: orange wide bar
                    ctx.fillStyle = c.fill;
                    ctx.shadowColor = c.glow;
                    ctx.shadowBlur = 10;
                    ctx.fillRect(this.width / 2 - (coord.width * 2.5) + 8, coord.y - 5, coord.width * 5 - 16, 10);
                } else {
                    // Standard Gem / Drum Cymbal
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

                    // Inner 3D jewel highlight
                    ctx.beginPath();
                    ctx.ellipse(coord.x, coord.y - radiusY * 0.2, radiusX * 0.5, radiusY * 0.35, 0, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        triggerHit(fret, isDrumMode) {
            const coord = this.getHighwayCoords(fret, 1.0, isDrumMode);
            const colors = isDrumMode ? DRUM_COLORS : FRET_COLORS;
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

            // Find current lyrics within a 3-second window
            const activeLyrics = this.lyricEvents.filter(ev => {
                if (ev.type !== 'lyric') return false;
                const t = this.midiData.tickToSeconds(ev.tick);
                return Math.abs(t - currentTime) <= 3.0;
            });

            if (activeLyrics.length === 0) return;

            const textString = activeLyrics.map(l => l.syllable || l.eventText.replace('lyric ', '')).join('');

            ctx.save();
            ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
            ctx.strokeStyle = '#2979ff';
            ctx.lineWidth = 1;

            const boxW = Math.min(w * 0.8, 600);
            const boxH = 34;
            const boxX = (w - boxW) / 2;
            const boxY = 12;

            ctx.fillRect(boxX, boxY, boxW, boxH);
            ctx.strokeRect(boxX, boxY, boxW, boxH);

            ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#ffea00';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`🎤 ${textString}`, w / 2, boxY + boxH / 2);
            ctx.restore();
        }
    }

    return HighwayVisualizer;
}));
