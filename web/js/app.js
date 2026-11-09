/**
 * MIDI-CH Studio Pro - Main Application Controller
 * Coordinates UI tabs, file parsing, track routing, lyrics alignment,
 * interactive highway visualizer, audio playback, and package export.
 */
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // Application State
    const state = {
        midiData: null,
        audioEngine: new AudioEngine(),
        highway: null,
        trackAssignments: {
            guitar: [],
            bass: [],
            drums: [],
            keys: [],
            rhythm: [],
            vocals: []
        },
        configs: {
            guitar: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.guitar),
            bass: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.bass),
            drums: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.drums),
            keys: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.keys),
            rhythm: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.rhythm)
        },
        allCharts: {},
        lyricEvents: [],
        metadata: {
            name: 'Song Title',
            artist: 'Artist',
            album: 'Album',
            year: new Date().getFullYear().toString(),
            charter: 'EFHIII & Antigravity (MIDI-CH Studio Pro)',
            genre: 'Rock',
            offsetMs: 0,
            previewStartSec: 45,
            diffGuitar: 3,
            diffBass: 2,
            diffDrums: 3,
            diffKeys: 4,
            diffRhythm: 2,
            diffVocals: 3
        },
        albumArtBlob: null
    };

    // Initialize Highway Visualizer
    const highwayCanvas = document.getElementById('highwayCanvas');
    state.highway = new HighwayVisualizer(highwayCanvas, state.audioEngine);
    state.highway.start();

    // Setup Tab Navigation
    const tabButtons = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetEl = document.getElementById(targetTab);
            if (targetEl) targetEl.classList.add('active');

            if (targetTab === 'tab-highway') {
                state.highway.resize();
            }
        });
    });

    // Setup MIDI File Drag & Drop
    const midiDropZone = document.getElementById('midiDropZone');
    const midiFileInput = document.getElementById('midiFileInput');

    midiDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        midiDropZone.classList.add('hover');
    });

    midiDropZone.addEventListener('dragleave', () => {
        midiDropZone.classList.remove('hover');
    });

    midiDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        midiDropZone.classList.remove('hover');
        if (e.dataTransfer.files.length > 0) {
            handleMidiFile(e.dataTransfer.files[0]);
        }
    });

    midiFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleMidiFile(e.target.files[0]);
        }
    });

    async function handleMidiFile(file) {
        try {
            document.getElementById('midiFileName').textContent = `Cargando: ${file.name}...`;
            const arrayBuf = await file.arrayBuffer();
            const parsed = MidiParser.parse(arrayBuf);
            state.midiData = parsed;

            // Extract clean title from filename
            let baseName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
            if (baseName.includes(' - ')) {
                const parts = baseName.split(' - ');
                state.metadata.artist = parts[0].trim();
                state.metadata.name = parts[1].trim();
            } else {
                state.metadata.name = baseName;
            }

            updateMetadataForm();

            // Auto-assign tracks
            state.trackAssignments = CharterEngine.autoAssignTracks(parsed.tracks);

            // Check if MIDI already has lyrics
            const midiLyrics = LyricsEngine.extractMidiLyrics(parsed);
            if (midiLyrics.length > 0) {
                state.lyricEvents = LyricsEngine.formatMidiLyricsToEvents(midiLyrics, parsed.ppq);
                document.getElementById('lyricsStatusBadge').textContent = `${midiLyrics.length} eventos líricos encontrados en el MIDI`;
                document.getElementById('lyricsStatusBadge').className = 'badge badge-success';
            } else {
                // Auto generate sections as baseline
                state.lyricEvents = LyricsEngine.generateSections(parsed.maxTick, parsed.ppq);
                document.getElementById('lyricsStatusBadge').textContent = 'Sin letras embebidas (puedes pegarlas abajo)';
                document.getElementById('lyricsStatusBadge').className = 'badge badge-warning';
            }

            // Rebuild charts
            recalculateCharts();

            // Render Track Routing Table
            renderTrackRoutingTable();

            // Render Vocal Track Selector for lyrics
            populateVocalTrackDropdown();

            document.getElementById('midiFileName').textContent = `Archivo: ${file.name} (${parsed.tracks.length} pistas, ${(parsed.totalDurationSec).toFixed(1)}s)`;
            showToast('MIDI cargado y analizado con éxito', 'success');

        } catch (err) {
            console.error(err);
            alert('Error al leer el archivo MIDI: ' + err.message);
        }
    }

    // Render Track Routing Matrix
    function renderTrackRoutingTable() {
        const tbody = document.getElementById('trackRoutingBody');
        tbody.innerHTML = '';

        if (!state.midiData) return;

        state.midiData.tracks.forEach(track => {
            const tr = document.createElement('tr');

            // Find current assignment
            let assignedTo = 'none';
            for (let inst in state.trackAssignments) {
                if (state.trackAssignments[inst].includes(track.id)) {
                    assignedTo = inst;
                    break;
                }
            }

            const percBadge = track.isPercussion ? '<span class="badge badge-percussion">Percusión</span>' : '';
            const pitchRangeStr = track.notes.length > 0 ? `${MidiParser.pitchToName(track.minPitch)} - ${MidiParser.pitchToName(track.maxPitch)}` : 'N/A';

            tr.innerHTML = `
                <td><strong>#${track.id + 1}</strong></td>
                <td>
                    <div class="track-title">${track.name || 'Sin nombre'}</div>
                    <small class="text-muted">${track.instrumentName || 'General Instrument'} ${percBadge}</small>
                </td>
                <td><span class="badge badge-notes">${track.notes.length} notas</span></td>
                <td><small>${pitchRangeStr}</small></td>
                <td>
                    <select class="form-select form-select-sm track-assign-select" data-track-id="${track.id}">
                        <option value="none" ${assignedTo === 'none' ? 'selected' : ''}>-- Ignorar --</option>
                        <option value="guitar" ${assignedTo === 'guitar' ? 'selected' : ''}>🎸 Guitarra Líder (Single)</option>
                        <option value="bass" ${assignedTo === 'bass' ? 'selected' : ''}>🎸 Bajo (DoubleBass)</option>
                        <option value="rhythm" ${assignedTo === 'rhythm' ? 'selected' : ''}>🎸 Guitarra Rítmica</option>
                        <option value="keys" ${assignedTo === 'keys' ? 'selected' : ''}>🎹 Teclado / Piano</option>
                        <option value="drums" ${assignedTo === 'drums' ? 'selected' : ''}>🥁 Batería (Drums)</option>
                        <option value="vocals" ${assignedTo === 'vocals' ? 'selected' : ''}>🎤 Voz (Melodía / Letras)</option>
                    </select>
                </td>
            `;

            tbody.appendChild(tr);
        });

        // Add event listeners to dropdowns
        document.querySelectorAll('.track-assign-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const trackId = parseInt(e.target.getAttribute('data-track-id'));
                const newInst = e.target.value;

                // Remove from all existing assignments
                for (let k in state.trackAssignments) {
                    state.trackAssignments[k] = state.trackAssignments[k].filter(id => id !== trackId);
                }

                if (newInst !== 'none') {
                    state.trackAssignments[newInst].push(trackId);
                }

                recalculateCharts();
            });
        });
    }

    // Auto-Assign button
    document.getElementById('btnAutoAssign').addEventListener('click', () => {
        if (!state.midiData) {
            showToast('Por favor carga un archivo MIDI primero', 'warning');
            return;
        }
        state.trackAssignments = CharterEngine.autoAssignTracks(state.midiData.tracks);
        renderTrackRoutingTable();
        recalculateCharts();
        showToast('Pistas auto-asignadas con éxito', 'success');
    });

    // Populate vocal track dropdown in lyrics tab
    function populateVocalTrackDropdown() {
        const sel = document.getElementById('vocalTrackSelect');
        sel.innerHTML = '';

        if (!state.midiData) return;

        state.midiData.tracks.forEach(track => {
            if (track.notes.length > 0 && !track.isPercussion) {
                const isSelected = state.trackAssignments.vocals.includes(track.id);
                const opt = document.createElement('option');
                opt.value = track.id;
                opt.textContent = `Pista #${track.id + 1}: ${track.name} (${track.notes.length} notas)`;
                if (isSelected) opt.selected = true;
                sel.appendChild(opt);
            }
        });
    }

    // Recalculate charts across all assigned tracks
    function recalculateCharts() {
        if (!state.midiData) return;

        state.allCharts = CharterEngine.buildAllCharts(state.midiData, state.trackAssignments, state.configs);

        // Update Highway
        state.highway.setSongData(state.midiData, state.allCharts, state.lyricEvents);

        // Update active instrument selector options
        updateHighwayInstrumentOptions();
    }

    function updateHighwayInstrumentOptions() {
        const instSel = document.getElementById('highwayInstSelect');
        instSel.innerHTML = '';

        const available = Object.keys(state.allCharts).filter(k => Object.keys(state.allCharts[k]).length > 0);

        if (available.length === 0) {
            const opt = document.createElement('option');
            opt.value = 'guitar';
            opt.textContent = 'Sin instrumentos asignados';
            instSel.appendChild(opt);
            return;
        }

        const labels = {
            guitar: '🎸 Guitarra Líder',
            bass: '🎸 Bajo',
            drums: '🥁 Batería',
            keys: '🎹 Teclado',
            rhythm: '🎸 Rítmica'
        };

        available.forEach(inst => {
            const opt = document.createElement('option');
            opt.value = inst;
            opt.textContent = labels[inst] || inst;
            if (inst === state.highway.selectedInstrument) opt.selected = true;
            instSel.appendChild(opt);
        });

        if (!available.includes(state.highway.selectedInstrument)) {
            state.highway.setInstrument(available[0]);
        }
    }

    // Highway Controls
    document.getElementById('highwayInstSelect').addEventListener('change', (e) => {
        state.highway.setInstrument(e.target.value);
    });

    document.getElementById('highwayDiffSelect').addEventListener('change', (e) => {
        state.highway.setDifficulty(e.target.value);
    });

    document.getElementById('highwaySpeedSelect').addEventListener('change', (e) => {
        const rate = parseFloat(e.target.value);
        state.audioEngine.setPlaybackRate(rate);
    });

    const btnPlayPause = document.getElementById('btnPlayPause');
    btnPlayPause.addEventListener('click', togglePlayback);

    function togglePlayback() {
        if (state.audioEngine.isPlaying) {
            state.audioEngine.pause();
            btnPlayPause.innerHTML = '▶ Reproducir';
            btnPlayPause.classList.remove('btn-danger');
            btnPlayPause.classList.add('btn-success');
        } else {
            state.audioEngine.play();
            btnPlayPause.innerHTML = '⏸ Pausar';
            btnPlayPause.classList.remove('btn-success');
            btnPlayPause.classList.add('btn-danger');
        }
    }

    // Keyboard shortcut: Spacebar to toggle play/pause
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            togglePlayback();
        }
    });

    // Time scrubber
    const timeScrubber = document.getElementById('timeScrubber');
    const timeDisplay = document.getElementById('timeDisplay');

    timeScrubber.addEventListener('input', (e) => {
        const pct = parseFloat(e.target.value) / 100;
        const totalDuration = state.midiData ? state.midiData.totalDurationSec : (state.audioEngine.duration || 100);
        const targetSec = pct * totalDuration;
        state.audioEngine.seekTo(targetSec);
    });

    // Scrubber update loop
    setInterval(() => {
        if (state.audioEngine && state.midiData) {
            const cur = state.audioEngine.getCurrentTime();
            const total = state.midiData.totalDurationSec || state.audioEngine.duration || 1;
            const pct = Math.min(100, Math.max(0, (cur / total) * 100));

            if (!timeScrubber.matches(':active')) {
                timeScrubber.value = pct;
            }

            const curMin = Math.floor(cur / 60);
            const curSec = Math.floor(cur % 60).toString().padStart(2, '0');
            const totMin = Math.floor(total / 60);
            const totSec = Math.floor(total % 60).toString().padStart(2, '0');
            timeDisplay.textContent = `${curMin}:${curSec} / ${totMin}:${totSec}`;
        }
    }, 100);

    // Audio Offset & Stems Management
    const audioOffsetInput = document.getElementById('audioOffsetInput');
    audioOffsetInput.addEventListener('input', (e) => {
        const ms = parseInt(e.target.value) || 0;
        state.metadata.offsetMs = ms;
        state.audioEngine.setAudioOffsetMs(ms);
        document.getElementById('offsetDisplay').textContent = `${ms} ms`;
    });

    document.getElementById('btnNudgeOffsetMinus').addEventListener('click', () => {
        audioOffsetInput.value = (parseInt(audioOffsetInput.value) || 0) - 25;
        audioOffsetInput.dispatchEvent(new Event('input'));
    });

    document.getElementById('btnNudgeOffsetPlus').addEventListener('click', () => {
        audioOffsetInput.value = (parseInt(audioOffsetInput.value) || 0) + 25;
        audioOffsetInput.dispatchEvent(new Event('input'));
    });

    // Stems audio file loaders
    const stemKeys = ['song', 'guitar', 'bass', 'drums', 'vocals', 'keys'];
    stemKeys.forEach(stem => {
        const input = document.getElementById(`stemFile_${stem}`);
        if (input) {
            input.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    document.getElementById(`stemName_${stem}`).textContent = file.name;
                    await state.audioEngine.loadAudioFile(stem, file);
                    showToast(`Pista de audio cargada: ${stem}`, 'success');
                }
            });
        }

        const muteBtn = document.getElementById(`stemMute_${stem}`);
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                const isMuted = !state.audioEngine.stems[stem].isMuted;
                state.audioEngine.setStemMute(stem, isMuted);
                muteBtn.classList.toggle('active', isMuted);
            });
        }

        const soloBtn = document.getElementById(`stemSolo_${stem}`);
        if (soloBtn) {
            soloBtn.addEventListener('click', () => {
                const isSolo = !state.audioEngine.stems[stem].isSolo;
                state.audioEngine.setStemSolo(stem, isSolo);
                soloBtn.classList.toggle('active', isSolo);
            });
        }
    });

    // Lyrics Syllable Auto-Aligner
    document.getElementById('btnAlignLyrics').addEventListener('click', () => {
        if (!state.midiData) {
            showToast('Por favor carga un archivo MIDI primero', 'warning');
            return;
        }

        const rawText = document.getElementById('lyricsTextInput').value;
        if (!rawText.trim()) {
            showToast('Pega la letra de la canción en el área de texto', 'warning');
            return;
        }

        const vocalTrackId = parseInt(document.getElementById('vocalTrackSelect').value);
        const vocalTrack = state.midiData.tracks.find(t => t.id === vocalTrackId);

        if (!vocalTrack || vocalTrack.notes.length === 0) {
            showToast('La pista vocal seleccionada no tiene notas', 'danger');
            return;
        }

        const mode = document.getElementById('lyricsModeSelect').value; // 'syllables' or 'words'
        const syllables = LyricsEngine.parseLyricsText(rawText, mode);

        const aligned = LyricsEngine.alignLyricsToNotes(syllables, vocalTrack.notes, state.midiData.ppq);

        // Also add auto-generated sections
        const sections = LyricsEngine.generateSections(state.midiData.maxTick, state.midiData.ppq);
        const combined = [...aligned, ...sections];
        combined.sort((a, b) => a.tick - b.tick);

        state.lyricEvents = combined;

        // Render aligned table
        renderLyricsPreviewTable(aligned);

        // Update highway
        state.highway.lyricEvents = combined;

        showToast(`¡${syllables.length} sílabas sincronizadas a ${vocalTrack.notes.length} notas vocales!`, 'success');
    });

    function renderLyricsPreviewTable(events) {
        const tbody = document.getElementById('lyricsPreviewBody');
        tbody.innerHTML = '';

        const lyricOnly = events.filter(e => e.type === 'lyric');

        lyricOnly.slice(0, 50).forEach((ev, idx) => {
            const tr = document.createElement('tr');
            const timeSec = state.midiData.tickToSeconds(ev.tick);
            const m = Math.floor(timeSec / 60);
            const s = (timeSec % 60).toFixed(2).padStart(5, '0');

            tr.innerHTML = `
                <td>#${idx + 1}</td>
                <td>${m}:${s}</td>
                <td><span class="badge badge-notes">${ev.noteName || 'N/A'}</span></td>
                <td><strong>${ev.syllable || ''}</strong></td>
            `;
            tbody.appendChild(tr);
        });

        if (lyricOnly.length > 50) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="4" class="text-center text-muted">... y ${lyricOnly.length - 50} sílabas más sincronizadas</td>`;
            tbody.appendChild(tr);
        }
    }

    // Metadata Form Handlers
    function updateMetadataForm() {
        document.getElementById('metaName').value = state.metadata.name;
        document.getElementById('metaArtist').value = state.metadata.artist;
        document.getElementById('metaAlbum').value = state.metadata.album;
        document.getElementById('metaYear').value = state.metadata.year;
        document.getElementById('metaCharter').value = state.metadata.charter;
        document.getElementById('metaGenre').value = state.metadata.genre;
        document.getElementById('metaDiffGuitar').value = state.metadata.diffGuitar;
        document.getElementById('metaDiffBass').value = state.metadata.diffBass;
        document.getElementById('metaDiffDrums').value = state.metadata.diffDrums;
        document.getElementById('metaDiffKeys').value = state.metadata.diffKeys;
    }

    function syncMetadataFromForm() {
        state.metadata.name = document.getElementById('metaName').value;
        state.metadata.artist = document.getElementById('metaArtist').value;
        state.metadata.album = document.getElementById('metaAlbum').value;
        state.metadata.year = document.getElementById('metaYear').value;
        state.metadata.charter = document.getElementById('metaCharter').value;
        state.metadata.genre = document.getElementById('metaGenre').value;
        state.metadata.diffGuitar = parseInt(document.getElementById('metaDiffGuitar').value) || 3;
        state.metadata.diffBass = parseInt(document.getElementById('metaDiffBass').value) || 2;
        state.metadata.diffDrums = parseInt(document.getElementById('metaDiffDrums').value) || 3;
        state.metadata.diffKeys = parseInt(document.getElementById('metaDiffKeys').value) || 4;
        state.metadata.diffVocals = 3;
        state.metadata.songLengthMs = state.midiData ? Math.round(state.midiData.totalDurationSec * 1000) : 180000;
    }

    // Album art upload
    document.getElementById('albumArtInput').addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            state.albumArtBlob = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (re) => {
                document.getElementById('albumArtPreview').src = re.target.result;
            };
            reader.readAsDataURL(state.albumArtBlob);
            showToast('Portada de álbum personalizada cargada', 'success');
        }
    });

    // 1-Click Export Handlers
    document.getElementById('btnExportZip').addEventListener('click', async () => {
        if (!state.midiData) {
            showToast('Por favor carga un archivo MIDI primero', 'warning');
            return;
        }

        syncMetadataFromForm();

        // Check which stems are available
        state.metadata.hasGuitarStem = !!state.audioEngine.stems.guitar.file;
        state.metadata.hasBassStem = !!state.audioEngine.stems.bass.file;
        state.metadata.hasDrumsStem = !!state.audioEngine.stems.drums.file;
        state.metadata.hasVocalsStem = !!state.audioEngine.stems.vocals.file;
        state.metadata.hasKeysStem = !!state.audioEngine.stems.keys.file;

        const chartText = ChartExporter.generateChartString(state.midiData, state.allCharts, state.lyricEvents, state.metadata);
        const songIniText = ChartExporter.generateSongIni(state.metadata);

        const audioFiles = {};
        for (let k in state.audioEngine.stems) {
            if (state.audioEngine.stems[k].file) {
                audioFiles[k] = state.audioEngine.stems[k].file;
            }
        }

        try {
            document.getElementById('btnExportZip').disabled = true;
            document.getElementById('btnExportZip').innerHTML = '⏳ Empaquetando ZIP...';

            const result = await ChartExporter.packageToZip(chartText, songIniText, audioFiles, state.albumArtBlob, state.metadata);
            ChartExporter.triggerDownload(result.blob, result.filename);

            showToast(`¡Paquete ${result.filename} descargado con éxito!`, 'success');
        } catch (err) {
            console.error(err);
            alert('Error al generar el ZIP: ' + err.message);
        } finally {
            document.getElementById('btnExportZip').disabled = false;
            document.getElementById('btnExportZip').innerHTML = '📦 Descargar Paquete Completo (.ZIP)';
        }
    });

    document.getElementById('btnExportChartOnly').addEventListener('click', () => {
        if (!state.midiData) {
            showToast('Por favor carga un archivo MIDI primero', 'warning');
            return;
        }
        syncMetadataFromForm();
        const chartText = ChartExporter.generateChartString(state.midiData, state.allCharts, state.lyricEvents, state.metadata);
        const blob = new Blob([chartText], { type: 'text/plain;charset=utf-8' });
        ChartExporter.triggerDownload(blob, 'notes.chart');
        showToast('notes.chart descargado', 'success');
    });

    document.getElementById('btnExportIniOnly').addEventListener('click', () => {
        syncMetadataFromForm();
        const iniText = ChartExporter.generateSongIni(state.metadata);
        const blob = new Blob([iniText], { type: 'text/plain;charset=utf-8' });
        ChartExporter.triggerDownload(blob, 'song.ini');
        showToast('song.ini descargado', 'success');
    });

    document.getElementById('btnViewChartText').addEventListener('click', () => {
        if (!state.midiData) {
            showToast('Por favor carga un archivo MIDI primero', 'warning');
            return;
        }
        syncMetadataFromForm();
        const chartText = ChartExporter.generateChartString(state.midiData, state.allCharts, state.lyricEvents, state.metadata);
        document.getElementById('chartTextPreview').value = chartText;
        const modal = new bootstrap.Modal(document.getElementById('chartPreviewModal'));
        modal.show();
    });

    document.getElementById('btnCopyChartText').addEventListener('click', () => {
        const text = document.getElementById('chartTextPreview').value;
        navigator.clipboard.writeText(text);
        showToast('Texto del chart copiado al portapapeles', 'info');
    });

    // Helper: Toast alerts
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} shadow-lg`;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '9999';
        toast.style.minWidth = '280px';
        toast.style.animation = 'fadeIn 0.3s ease';
        toast.innerHTML = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
});
