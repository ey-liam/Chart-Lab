/**
 * Chart-Lab - HiDPI 3D Highway, Waveform Beat-Sync & Vocal Ribbon Renderer
 * Corrige el estiramiento de canvas mediante ResizeObserver y devicePixelRatio.
 */
class HighwayVisualizer {
    constructor(highwayCanvasId, waveformCanvasId, vocalCanvasId) {
        this.hwCanvas = document.getElementById(highwayCanvasId);
        this.wfCanvas = document.getElementById(waveformCanvasId);
        this.vcCanvas = document.getElementById(vocalCanvasId);

        this.FRET_COLORS_5 = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#f97316'];
        this.FRET_COLORS_6 = ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#475569', '#475569', '#475569'];

        this.setupHiDPICanvas(this.hwCanvas);
        this.setupHiDPICanvas(this.wfCanvas);
        this.setupHiDPICanvas(this.vcCanvas);
    }

    setupHiDPICanvas(canvas) {
        if (!canvas) return;
        const updateSize = () => {
            const rect = canvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
        };
        updateSize();
        const ro = new ResizeObserver(updateSize);
        ro.observe(canvas);
        window.addEventListener('resize', updateSize);
    }

    renderHighway(notes, lyrics, currentTimeSec, windowSec = 1.8, laneCount = 5, isGhl = false) {
        if (!this.hwCanvas) return;
        const ctx = this.hwCanvas.getContext('2d');
        const W = this.hwCanvas.width;
        const H = this.hwCanvas.height;
        if (W === 0 || H === 0) return;

        ctx.clearRect(0, 0, W, H);

        // Geometría con proporción fija centrada para evitar estiramiento en pantallas ultra-anchas
        const maxBoardW = Math.min(W * 0.78, H * 1.15);
        const topWidth = maxBoardW * 0.34;
        const bottomWidth = maxBoardW * 0.92;
        const horizonY = H * 0.14;
        const strikeY = H * 0.86;
        const centerX = W * 0.5;

        // Fondo de la pista 3D
        const grad = ctx.createLinearGradient(0, horizonY, 0, strikeY);
        grad.addColorStop(0, '#090e1a');
        grad.addColorStop(1, '#131d31');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(centerX - topWidth / 2, horizonY);
        ctx.lineTo(centerX + topWidth / 2, horizonY);
        ctx.lineTo(centerX + bottomWidth / 2, strikeY);
        ctx.lineTo(centerX - bottomWidth / 2, strikeY);
        ctx.closePath();
        ctx.fill();

        const visualLanes = isGhl ? 3 : laneCount;

        // Líneas divisorias de carriles
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = Math.max(1, W * 0.0015);
        for (let i = 0; i <= visualLanes; i++) {
            const ratio = i / visualLanes - 0.5;
            ctx.beginPath();
            ctx.moveTo(centerX + ratio * topWidth, horizonY);
            ctx.lineTo(centerX + ratio * bottomWidth, strikeY);
            ctx.stroke();
        }

        // Línea de golpeo (Strikeline)
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = Math.max(2, H * 0.006);
        ctx.beginPath();
        ctx.moveTo(centerX - bottomWidth / 2, strikeY);
        ctx.lineTo(centerX + bottomWidth / 2, strikeY);
        ctx.stroke();

        // Receptores en la línea de golpeo
        for (let i = 0; i < visualLanes; i++) {
            const laneRatio = (i + 0.5) / visualLanes - 0.5;
            const rx = centerX + laneRatio * bottomWidth;
            const rRadius = (bottomWidth / visualLanes) * 0.3;
            ctx.strokeStyle = isGhl ? '#cbd5e1' : (this.FRET_COLORS_5[i] || '#38bdf8');
            ctx.lineWidth = Math.max(2, H * 0.005);
            ctx.beginPath();
            ctx.arc(rx, strikeY, rRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Proyección perspectiva de tiempo a coordenada Y
        const projectY = (tSec) => {
            const norm = (tSec - currentTimeSec) / windowSec; // 0 en strikeline, 1 en horizonte
            const persp = 1 - Math.pow(norm, 0.78);
            return horizonY + persp * (strikeY - horizonY);
        };

        const widthAtY = (y) => {
            const t = (y - horizonY) / (strikeY - horizonY);
            return topWidth + t * (bottomWidth - topWidth);
        };

        // Dibujar Notas y Sustains
        if (Array.isArray(notes)) {
            for (let i = 0; i < notes.length; i++) {
                const n = notes[i];
                const noteEndSec = n.timeSec + (n.sustainSec || 0);
                if (noteEndSec < currentTimeSec - 0.05) continue;
                if (n.timeSec > currentTimeSec + windowSec) break;

                const clampedHeadTime = Math.max(currentTimeSec, n.timeSec);
                const headY = projectY(clampedHeadTime);
                const boardWAtHead = widthAtY(headY);

                // Nota abierta (barra morada completa)
                if (n.fret === 7) {
                    ctx.fillStyle = '#c084fc';
                    const barH = Math.max(6, H * 0.018 * ((headY - horizonY) / (strikeY - horizonY)));
                    ctx.fillRect(centerX - boardWAtHead * 0.46, headY - barH / 2, boardWAtHead * 0.92, barH);
                    continue;
                }

                const laneIdx = isGhl ? (n.fret % 3) : Math.min(visualLanes - 1, n.fret);
                const laneRatio = (laneIdx + 0.5) / visualLanes - 0.5;
                const xHead = centerX + laneRatio * boardWAtHead;
                const color = isGhl ? this.FRET_COLORS_6[n.fret % 6] : (this.FRET_COLORS_5[laneIdx] || '#38bdf8');

                // Cola de Sustain
                if (n.sustainSec > 0.04) {
                    const tailTime = Math.min(currentTimeSec + windowSec, noteEndSec);
                    const tailY = projectY(tailTime);
                    const boardWAtTail = widthAtY(tailY);
                    const xTail = centerX + laneRatio * boardWAtTail;
                    const tailW = Math.max(4, (boardWAtHead / visualLanes) * 0.22);

                    ctx.strokeStyle = color;
                    ctx.lineWidth = tailW;
                    ctx.beginPath();
                    ctx.moveTo(xHead, headY);
                    ctx.lineTo(xTail, tailY);
                    ctx.stroke();
                }

                // Gema de Nota (Solo si aún no cruzó la línea de golpeo)
                if (n.timeSec >= currentTimeSec - 0.03) {
                    const scale = 0.35 + 0.65 * ((headY - horizonY) / (strikeY - horizonY));
                    const rx = (boardWAtHead / visualLanes) * 0.32;
                    const ry = rx * 0.55;

                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.ellipse(xHead, headY, rx, ry, 0, 0, Math.PI * 2);
                    ctx.fill();

                    // Centro blanco para HOPO o borde cian para Tap
                    ctx.fillStyle = n.isTap ? '#38bdf8' : (n.isHopo ? '#ffffff' : '#0f172a');
                    ctx.beginPath();
                    ctx.ellipse(xHead, headY, rx * 0.48, ry * 0.48, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Overlay de Karaoke / Letras en la parte superior del visor 3D
        if (Array.isArray(lyrics) && lyrics.length > 0) {
            ctx.fillStyle = 'rgba(9, 13, 20, 0.82)';
            ctx.fillRect(0, 0, W, horizonY * 0.85);

            const activeWindow = lyrics.filter(l => l.type === 'lyric' && l.timeSec >= currentTimeSec - 1.5 && l.timeSec <= currentTimeSec + 4.0);
            ctx.font = `600 ${Math.round(H * 0.038)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            const lineText = activeWindow.map(l => l.timeSec <= currentTimeSec ? `[${l.text}]` : l.text).join(' ');
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(lineText || '...', centerX, horizonY * 0.55);
        }
    }

    renderWaveformSync(peaks, durationSec, beatTimesSec, currentTimeSec, offsetMs, zoomSec = 8) {
        if (!this.wfCanvas) return;
        const ctx = this.wfCanvas.getContext('2d');
        const W = this.wfCanvas.width;
        const H = this.wfCanvas.height;
        if (W === 0 || H === 0) return;

        ctx.clearRect(0, 0, W, H);
        const halfWin = zoomSec / 2;
        const startSec = currentTimeSec - halfWin;
        const endSec = currentTimeSec + halfWin;
        const offsetSec = (offsetMs || 0) / 1000;

        // 1. Dibujar Forma de Onda del Audio
        if (peaks && peaks.length > 0 && durationSec > 0) {
            ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
            const stepPx = 2;
            for (let x = 0; x < W; x += stepPx) {
                const t = startSec + (x / W) * zoomSec;
                if (t < 0 || t > durationSec) continue;
                const idx = Math.floor((t / durationSec) * peaks.length);
                const amp = peaks[idx] || 0;
                const barH = Math.max(2, amp * (H * 0.85));
                ctx.fillRect(x, (H - barH) / 2, stepPx - 0.5, barH);
            }
        } else {
            ctx.fillStyle = '#64748b';
            ctx.font = `${Math.round(H * 0.11)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('Sube un archivo de audio (song.ogg / .mp3 / .wav) para visualizar su espectro junto a los pulsos MIDI', W / 2, H / 2);
        }

        // 2. Dibujar Rejilla de Pulsos MIDI desplazados por Offset
        if (Array.isArray(beatTimesSec)) {
            for (let i = 0; i < beatTimesSec.length; i++) {
                const beatT = beatTimesSec[i] + offsetSec;
                if (beatT < startSec) continue;
                if (beatT > endSec) break;

                const x = ((beatT - startSec) / zoomSec) * W;
                const isMeasure = (i % 4 === 0);
                ctx.strokeStyle = isMeasure ? '#f59e0b' : 'rgba(148, 163, 184, 0.35)';
                ctx.lineWidth = isMeasure ? 2 : 1;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, H);
                ctx.stroke();
            }
        }

        // 3. Cabezal de Reproducción Central
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(W / 2, 0);
        ctx.lineTo(W / 2, H);
        ctx.stroke();
    }

    renderVocalRibbon(vocalNotes, lyricEvents, scrollNorm = 0, totalDurationSec = 60) {
        if (!this.vcCanvas) return;
        const ctx = this.vcCanvas.getContext('2d');
        const W = this.vcCanvas.width;
        const H = this.vcCanvas.height;
        if (W === 0 || H === 0) return;

        ctx.clearRect(0, 0, W, H);
        const winSec = 10;
        const startSec = scrollNorm * Math.max(1, totalDurationSec - winSec);
        const endSec = startSec + winSec;

        if (!vocalNotes || vocalNotes.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = `${Math.round(H * 0.13)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('Selecciona una pista vocal y sincroniza la letra para ver los tubos de tono y sílabas', W / 2, H / 2);
            return;
        }

        let minP = 48, maxP = 84;
        vocalNotes.forEach(n => {
            if (n.pitch < minP) minP = n.pitch;
            if (n.pitch > maxP) maxP = n.pitch;
        });
        const range = Math.max(12, maxP - minP + 4);

        // Dibujar tubos de nota vocal y su sílaba correspondiente
        ctx.font = `600 ${Math.round(H * 0.13)}px system-ui, sans-serif`;
        ctx.textAlign = 'left';

        vocalNotes.forEach((n, idx) => {
            const nEnd = n.timeSec + n.durationSec;
            if (nEnd < startSec || n.timeSec > endSec) return;

            const x = ((n.timeSec - startSec) / winSec) * W;
            const w = Math.max(8, (n.durationSec / winSec) * W);
            const y = H * 0.75 - ((n.pitch - minP) / range) * (H * 0.58);

            ctx.fillStyle = '#0284c7';
            ctx.fillRect(x, y - 5, w, 10);

            const lyr = lyricEvents && lyricEvents[idx] ? lyricEvents[idx].text : '';
            if (lyr) {
                ctx.fillStyle = '#f8fafc';
                ctx.fillText(lyr, x + 2, y + 20);
            }
        });
    }
}

window.HighwayVisualizer = HighwayVisualizer;