/**
 * Chart-Lab - Main Application Controller
 * Coordinates UI tabs, file parsing, multi-instrument track routing, lyrics alignment,
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
            guitarghl: [],
            bass: [],
            bassghl: [],
            rhythm: [],
            rhythmghl: [],
            guitar_coop: [],
            guitar_coop_ghl: [],
            drums: [],
            drums_5lane: [],
            keys: [],
            keys_real: [],
            vocals: [],
            vocals_harm1: [],
            vocals_harm2: [],
            vocals_harm3: [],
            dance: []
        },
        configs: {
            guitar: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.guitar),
            guitarghl: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.guitarghl),
            bass: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.bass),
            bassghl: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.bassghl),
            rhythm: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.rhythm),
            rhythmghl: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.rhythmghl),
            guitar_coop: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.guitar_coop),
            guitar_coop_ghl: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.guitar_coop_ghl),
            drums: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.drums),
            drums_5lane: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.drums_5lane),
            keys: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.keys),
            keys_real: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.keys_real),
            dance: Object.assign({}, CharterEngine.DEFAULT_CONFIGS.dance)
        },
        allCharts: {},
        lyricEvents: [],
        metadata: {
            name: 'Song Title',
            artist: 'Artist',
            album: 'Album',
            albumTrack: 1,
            year: new Date().getFullYear().toString(),
            genre: 'Rock',
            subGenre: 'Alternative',
            tags: '',
            location: '',
            rating: 1,
            playlist: '',
            playlistTrack: 1,
            charter: 'Chart-Lab',
            icon: 'chartlab',
            loadingPhrase: 'Charted with Chart-Lab Suite',
            offsetMs: 0,
            previewStartSec: 30,

            // Difficulties
            diffBand: 2,
            diffGuitar: 3,
            diffGuitarGhl: 0,
            diffGuitarReal: 0,
            diffGuitarReal22: 0,
            diffGuitarCoop: 0,
            diffGuitarCoopGhl: 0,
            diffRhythm: 0,
            diffRhythmGhl: 0,
            diffBass: 2,
            diffBassGhl: 0,
            diffBassReal: 0,
            diffBassReal22: 0,
            diffDrums: 3,
            diffDrumsReal: 3,
            diffEliteDrums: 0,
            diffKeys: 0,
            diffKeysReal: 0,
            diffVocals: 3,
            diffVocalsHarm: 0,
            diffDance: 0,

            // Engine flags
            proDrums: true,
            fiveLaneDrums: false,
            partsVocalsHarm: 1,
            vocalScrollSpeed: 100,
            modchart: 0,
            videoStartTime: 0,
            endEvents: 0,

            // Credits
            creditAlbumArtBy: '',
            creditComposedBy: '',
            creditEngineeredBy: '',
            creditLicense: '',
            creditMasteredBy: '',
            creditMixedBy: '',
            creditPerformedBy: '',
            creditProducedBy: '',
            creditPublishedBy: '',
            creditWrittenBy: '',

            // Social links
            linkBandcamp: '',
            linkBluesky: '',
            linkFacebook: '',
            linkInstagram: '',
            linkNewgrounds: '',
            linkSoundcloud: '',
            linkSpotify: '',
            linkTiktok: '',
            linkTwitter: '',
            linkYoutube: '',
            linkOther: ''
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
                document.getElementById('lyricsStatusBadge').textContent = `${midiLyrics.length} eventos líricos encontrados`;
                document.getElementById('lyricsStatusBadge').className = 'badge badge-success';
            } else {
                state.lyricEvents = LyricsEngine.generateSections(parsed.maxTick, parsed.ppq);
                document.getElementById('lyricsStatusBadge').textContent = 'Sin letras embebidas';
                document.getElementById('lyricsStatusBadge').className = 'badge badge-warning';
            }

            // Rebuild charts
            recalculateCharts();

            // Render Track Routing Table
            renderTrackRoutingTable();

            // Render Vocal Track Selector for lyrics
            populateVocalTrackDropdown();

            document.getElementById('midiFileName').textContent = `Archivo: ${file.name} (${parsed.tracks.length} pistas, ${(parsed.totalDurationSec).toFixed(1)}s)`;
            showToast('MIDI procesado correctamente', 'success');

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

            let optionsHtml = `<option value="none" ${assignedTo === 'none' ? 'selected' : ''}>-- Ignorar --</option>`;
            for (let instKey in CharterEngine.INSTRUMENTS) {
                const info = CharterEngine.INSTRUMENTS[instKey];
                optionsHtml += `<option value="${instKey}" ${assignedTo === instKey ? 'selected' : ''}>${info.name}</option>`;
            }

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
                        ${optionsHtml}
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
                    if (!state.trackAssignments[newInst]) state.trackAssignments[newInst] = [];
                    state.trackAssignments[newInst].push(trackId);
                }

                recalculateCharts();
            });
        });
    }

    // Auto-Assign button
    document.getElementById('btnAutoAssign').addEventListener('click', () => {
        if (!state.midiData) {
            showToast('Cargue un archivo MIDI primero', 'warning');
            return;
        }
        state.trackAssignments = CharterEngine.autoAssignTracks(state.midiData.tracks);
        renderTrackRoutingTable();
        recalculateCharts();
        showToast('Pistas asignadas automáticamente', 'success');
    });

    // Chart Algorithm Tuning Handlers
    const tuningFrets = document.getElementById('tuningFrets');
    const tuningMaxChords = document.getElementById('tuningMaxChords');
    const tuningMinSustain = document.getElementById('tuningMinSustain');
    const tuningOpenNotes = document.getElementById('tuningOpenNotes');

    if (tuningFrets) {
        tuningFrets.addEventListener('change', (e) => {
            const frets = parseInt(e.target.value);
            for (let k in state.configs) state.configs[k].frets = frets;
            recalculateCharts();
        });
    }

    if (tuningMaxChords) {
        tuningMaxChords.addEventListener('change', (e) => {
            const maxChords = parseInt(e.target.value);
            for (let k in state.configs) state.configs[k].maxChordSize = maxChords;
            recalculateCharts();
        });
    }

    if (tuningMinSustain) {
        tuningMinSustain.addEventListener('change', (e) => {
            const minS = parseFloat(e.target.value);
            for (let k in state.configs) state.configs[k].minSustainQuarterBeats = minS;
            recalculateCharts();
        });
    }

    if (tuningOpenNotes) {
        tuningOpenNotes.addEventListener('change', (e) => {
            state.configs.bass.allowOpenNotes = e.target.checked;
            recalculateCharts();
        });
    }

    const tuningDensity = document.getElementById('tuningDensity');
    const densityLabel = document.getElementById('densityLabel');
    if (tuningDensity) {
        tuningDensity.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (densityLabel) densityLabel.textContent = `${val}%`;
            for (let k in state.configs) state.configs[k].density = val / 100.0;
            recalculateCharts();
        });
    }

    const tuningStyle = document.getElementById('tuningStyle');
    if (tuningStyle) {
        tuningStyle.addEventListener('change', (e) => {
            const style = e.target.value;
            for (let k in state.configs) state.configs[k].style = style;
            recalculateCharts();
            showToast(`Estilo de digitación: ${style}`, 'info');
        });
    }

    const tuningStarPower = document.getElementById('tuningStarPower');
    if (tuningStarPower) {
        tuningStarPower.addEventListener('change', (e) => {
            const freq = parseInt(e.target.value);
            for (let k in state.configs) state.configs[k].starPowerFrequency = freq;
            recalculateCharts();
            showToast(`Star Power: cada ${freq} compases`, 'info');
        });
    }

    const tuningDrumPedal = document.getElementById('tuningDrumPedal');
    if (tuningDrumPedal) {
        tuningDrumPedal.addEventListener('change', (e) => {
            if (state.configs.drums) {
                state.configs.drums.singleKickPedal = (e.target.value === 'single');
                recalculateCharts();
                showToast(`Pedal de bombo: ${e.target.value === 'single' ? 'Pedal Simple' : 'Doble Pedal'}`, 'info');
            }
        });
    }

    const btnReRoll = document.getElementById('btnReRoll');
    if (btnReRoll) {
        btnReRoll.addEventListener('click', () => {
            recalculateCharts();
            showToast('Gráfico re-generado', 'info');
        });
    }

    // Populate vocal track dropdown in lyrics tab
    function populateVocalTrackDropdown() {
        const sel = document.getElementById('vocalTrackSelect');
        sel.innerHTML = '';

        if (!state.midiData) return;

        state.midiData.tracks.forEach(track => {
            if (track.notes.length > 0 && !track.isPercussion) {
                const isSelected = state.trackAssignments.vocals && state.trackAssignments.vocals.includes(track.id);
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

        // Run validation
        if (typeof ChartValidator !== 'undefined') {
            const audit = ChartValidator.validateAndRepair(state.allCharts, state.midiData.ppq);
            const auditEl = document.getElementById('auditBadge');
            if (auditEl) {
                if (audit.fixesApplied > 0) {
                    auditEl.textContent = `Audit: ${audit.fixesApplied} correcciones`;
                    auditEl.className = 'badge badge-warning';
                } else {
                    auditEl.textContent = 'Audit: 100% verificado';
                    auditEl.className = 'badge badge-success';
                }
            }
        }

        // Update Highway
        state.highway.setSongData(state.midiData, state.allCharts, state.lyricEvents);

        // Update active instrument selector options
        updateHighwayInstrumentOptions();

        // Update Live Stats
        updateLiveStats();
    }

    function updateLiveStats() {
        if (!state.allCharts || !state.midiData) return;
        const instSel = document.getElementById('statsInstSelect');
        const diffSel = document.getElementById('statsDiffSelect');
        if (!instSel || !diffSel) return;

        const inst = instSel.value;
        const diff = diffSel.value;
        const track = (state.allCharts[inst] && state.allCharts[inst][diff]) || [];
        const stats = CharterEngine.calculateTrackStats(track, state.midiData);

        const totalEl = document.getElementById('statTotalNotes');
        const avgEl = document.getElementById('statNpsAvg');
        const peakEl = document.getElementById('statNpsPeak');
        const chordsEl = document.getElementById('statChords');
        const spEl = document.getElementById('statStarPower');
        const diffEl = document.getElementById('statSuggestedDiff');

        if (totalEl) totalEl.textContent = stats.totalNotes;
        if (avgEl) avgEl.textContent = stats.npsAvg;
        if (peakEl) peakEl.textContent = stats.npsPeak;
        if (chordsEl) chordsEl.textContent = stats.chordCount;
        if (spEl) spEl.textContent = stats.starPowerCount;
        if (diffEl) {
            diffEl.textContent = `Nivel ${stats.suggestedDiff}`;
            diffEl.dataset.diffVal = stats.suggestedDiff;
        }
    }

    const statsInstSelect = document.getElementById('statsInstSelect');
    if (statsInstSelect) statsInstSelect.addEventListener('change', updateLiveStats);

    const statsDiffSelect = document.getElementById('statsDiffSelect');
    if (statsDiffSelect) statsDiffSelect.addEventListener('change', updateLiveStats);

    const btnApplySuggestedDiff = document.getElementById('btnApplySuggestedDiff');
    if (btnApplySuggestedDiff) {
        btnApplySuggestedDiff.addEventListener('click', () => {
            const instSel = document.getElementById('statsInstSelect');
            const diffEl = document.getElementById('statSuggestedDiff');
            if (!instSel || !diffEl) return;

            const inst = instSel.value;
            const diffVal = parseInt(diffEl.dataset.diffVal || 3);
            const diffMap = {
                guitar: 'diffGuitar',
                bass: 'diffBass',
                drums: 'diffDrums',
                keys: 'diffKeys',
                rhythm: 'diffRhythm'
            };
            const metaKey = diffMap[inst];
            if (metaKey) {
                state.metadata[metaKey] = diffVal;
                syncMetadataToForm();
                showToast(`Dificultad de ${inst} actualizada a Nivel ${diffVal} en song.ini`, 'success');
            }
        });
    }

    const btnAutoSections = document.getElementById('btnAutoSections');
    if (btnAutoSections) {
        btnAutoSections.addEventListener('click', () => {
            if (!state.midiData) {
                showToast('Cargue un archivo MIDI primero', 'warning');
                return;
            }
            const autoSections = CharterEngine.generateAutoPracticeSections(state.midiData);
            state.lyricEvents = state.lyricEvents.filter(e => !e.eventText || !e.eventText.startsWith('section ')).concat(autoSections);
            state.lyricEvents.sort((a, b) => a.tick - b.tick);
            renderLyricsEventsTable();
            showToast(`${autoSections.length} secciones de práctica generadas`, 'success');
        });
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

        available.forEach(inst => {
            const opt = document.createElement('option');
            opt.value = inst;
            const info = CharterEngine.INSTRUMENTS[inst];
            opt.textContent = info ? info.name : inst;
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
        const speed = parseFloat(e.target.value);
        state.highway.speedWindowSeconds = speed;
    });

    const playbackRateSelect = document.getElementById('playbackRateSelect');
    if (playbackRateSelect) {
        playbackRateSelect.addEventListener('change', (e) => {
            const rate = parseFloat(e.target.value) || 1.0;
            state.audioEngine.setPlaybackRate(rate);
            showToast(`Velocidad de reproducción: ${rate}x`, 'info');
        });
    }

    let metronomeActive = false;
    const btnMetronomeToggle = document.getElementById('btnMetronomeToggle');
    if (btnMetronomeToggle) {
        btnMetronomeToggle.addEventListener('click', () => {
            metronomeActive = !metronomeActive;
            btnMetronomeToggle.classList.toggle('active', metronomeActive);
            btnMetronomeToggle.classList.toggle('btn-warning', metronomeActive);
            btnMetronomeToggle.classList.toggle('btn-outline-warning', !metronomeActive);
            state.highway.setMetronome(metronomeActive, (isDownbeat) => {
                state.audioEngine.playMetronomeClick(isDownbeat);
            });
            showToast(metronomeActive ? 'Metrónomo activado' : 'Metrónomo desactivado', 'info');
        });
    }

    const btnPlayPause = document.getElementById('btnPlayPause');
    btnPlayPause.addEventListener('click', togglePlayback);

    function togglePlayback() {
        if (state.audioEngine.isPlaying) {
            state.audioEngine.pause();
            btnPlayPause.textContent = 'Reproducir';
            btnPlayPause.classList.remove('btn-danger');
            btnPlayPause.classList.add('btn-success');
        } else {
            state.audioEngine.play();
            btnPlayPause.textContent = 'Pausar';
            btnPlayPause.classList.remove('btn-success');
            btnPlayPause.classList.add('btn-danger');
        }
    }

    // Scrubber
    const timeScrubber = document.getElementById('timeScrubber');
    const timeDisplay = document.getElementById('timeDisplay');

    timeScrubber.addEventListener('input', (e) => {
        if (!state.midiData) return;
        const targetSec = (parseFloat(e.target.value) / 100) * state.midiData.totalDurationSec;
        state.audioEngine.seek(targetSec);
    });

    setInterval(() => {
        if (!state.midiData) return;
        const cur = state.audioEngine.getCurrentTime();
        const total = state.midiData.totalDurationSec;
        timeScrubber.value = (cur / total) * 100;
        timeDisplay.textContent = `${formatTime(cur)} / ${formatTime(total)}`;
    }, 100);

    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // Audio & Stems Handlers
    const stemsList = ['song', 'guitar', 'bass', 'drums', 'vocals', 'keys'];
    stemsList.forEach(stem => {
        const fileInput = document.getElementById(`stemFile_${stem}`);
        const nameEl = document.getElementById(`stemName_${stem}`);
        const muteBtn = document.getElementById(`stemMute_${stem}`);
        const soloBtn = document.getElementById(`stemSolo_${stem}`);

        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    const f = e.target.files[0];
                    nameEl.textContent = `${f.name} (${(f.size / (1024 * 1024)).toFixed(1)} MB)`;
                    await state.audioEngine.loadStem(stem, f);
                    showToast(`Stem ${stem} cargado`, 'info');
                }
            });
        }

        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                const isMuted = state.audioEngine.toggleMute(stem);
                muteBtn.classList.toggle('active', isMuted);
            });
        }

        if (soloBtn) {
            soloBtn.addEventListener('click', () => {
                const isSolo = state.audioEngine.toggleSolo(stem);
                soloBtn.classList.toggle('active', isSolo);
            });
        }
    });

    // Global Offset Handler
    const audioOffsetInput = document.getElementById('audioOffsetMs');
    if (audioOffsetInput) {
        audioOffsetInput.addEventListener('change', (e) => {
            const ms = parseInt(e.target.value) || 0;
            state.metadata.offsetMs = ms;
            state.audioEngine.setGlobalOffset(ms);
        });
    }

    // Lyrics Sincronizer
    document.getElementById('btnAlignLyrics').addEventListener('click', () => {
        if (!state.midiData) {
            showToast('Cargue un archivo MIDI primero', 'warning');
            return;
        }

        const trackSelect = document.getElementById('vocalTrackSelect');
        const trackId = parseInt(trackSelect.value);
        if (isNaN(trackId)) {
            showToast('Seleccione una pista vocal', 'warning');
            return;
        }

        const vocalTrack = state.midiData.tracks.find(t => t.id === trackId);
        if (!vocalTrack || vocalTrack.notes.length === 0) {
            showToast('La pista seleccionada no contiene notas', 'warning');
            return;
        }

        const rawText = document.getElementById('lyricsTextInput').value;
        if (!rawText.trim()) {
            showToast('Ingrese la letra en el cuadro de texto', 'warning');
            return;
        }

        const mode = document.getElementById('lyricsModeSelect').value;
        const events = LyricsEngine.alignLyricsToVocalTrack(rawText, vocalTrack.notes, state.midiData.ppq, { mode });
        state.lyricEvents = events;

        // Render generated events table
        renderLyricsTable(events);

        // Update Highway
        state.highway.setSongData(state.midiData, state.allCharts, state.lyricEvents);

        document.getElementById('lyricsStatusBadge').textContent = `${events.length} sílabas sincronizadas`;
        document.getElementById('lyricsStatusBadge').className = 'badge badge-success';
        showToast('Sílabas sincronizadas con éxito', 'success');
    });

    function renderLyricsTable(events) {
        const tbody = document.getElementById('lyricsEventsBody');
        tbody.innerHTML = '';

        const lyricOnly = events.filter(e => e.eventText && e.eventText.startsWith('lyric '));
        const maxDisplay = Math.min(50, lyricOnly.length);

        for (let i = 0; i < maxDisplay; i++) {
            const ev = lyricOnly[i];
            const sec = state.midiData ? state.midiData.tickToSeconds(ev.tick) : 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>${ev.tick}</code></td>
                <td><small>${formatTime(sec)}</small></td>
                <td><span class="badge badge-lyrics">Lírica</span></td>
                <td><strong>${ev.eventText.replace('lyric ', '')}</strong></td>
            `;
            tbody.appendChild(tr);
        }

        if (lyricOnly.length > 50) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="4" class="text-center text-muted">... y ${lyricOnly.length - 50} sílabas más sincronizadas</td>`;
            tbody.appendChild(tr);
        }
    }

    // Metadata Form Handlers
    function updateMetadataForm() {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = (val !== undefined && val !== null) ? val : '';
        };
        const setCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
        };

        const m = state.metadata;
        setVal('metaName', m.name);
        setVal('metaArtist', m.artist);
        setVal('metaAlbum', m.album);
        setVal('metaAlbumTrack', m.albumTrack);
        setVal('metaYear', m.year);
        setVal('metaGenre', m.genre);
        setVal('metaSubGenre', m.subGenre);
        setVal('metaTags', m.tags);
        setVal('metaLocation', m.location);
        setVal('metaRating', m.rating);
        setVal('metaPlaylist', m.playlist);
        setVal('metaCharter', m.charter);
        setVal('metaIcon', m.icon);
        setVal('metaLoadingPhrase', m.loadingPhrase);

        setVal('metaDiffBand', m.diffBand);
        setVal('metaDiffGuitar', m.diffGuitar);
        setVal('metaDiffGuitarGhl', m.diffGuitarGhl);
        setVal('metaDiffGuitarCoop', m.diffGuitarCoop);
        setVal('metaDiffBass', m.diffBass);
        setVal('metaDiffBassGhl', m.diffBassGhl);
        setVal('metaDiffRhythm', m.diffRhythm);
        setVal('metaDiffRhythmGhl', m.diffRhythmGhl);
        setVal('metaDiffDrums', m.diffDrums);
        setVal('metaDiffDrumsReal', m.diffDrumsReal);
        setVal('metaDiffEliteDrums', m.diffEliteDrums);
        setVal('metaDiffKeys', m.diffKeys);
        setVal('metaDiffKeysReal', m.diffKeysReal);
        setVal('metaDiffVocals', m.diffVocals);
        setVal('metaDiffVocalsHarm', m.diffVocalsHarm);
        setVal('metaDiffDance', m.diffDance);

        setCheck('metaProDrums', m.proDrums);
        setCheck('metaFiveLaneDrums', m.fiveLaneDrums);
        setCheck('metaGhwtDeReady', m.ghwtDeReady);
        setVal('metaPartsVocalsHarm', m.partsVocalsHarm);
        setVal('metaVocalScrollSpeed', m.vocalScrollSpeed);
        setVal('metaModchart', m.modchart);
        setVal('metaVideoStartTime', m.videoStartTime);

        setVal('metaCreditComposedBy', m.creditComposedBy);
        setVal('metaCreditProducedBy', m.creditProducedBy);
        setVal('metaCreditMixedBy', m.creditMixedBy);
        setVal('metaCreditMasteredBy', m.creditMasteredBy);
        setVal('metaCreditEngineeredBy', m.creditEngineeredBy);
        setVal('metaCreditAlbumArtBy', m.creditAlbumArtBy);
        setVal('metaCreditLicense', m.creditLicense);

        setVal('metaLinkSpotify', m.linkSpotify);
        setVal('metaLinkYoutube', m.linkYoutube);
        setVal('metaLinkBandcamp', m.linkBandcamp);
        setVal('metaLinkSoundcloud', m.linkSoundcloud);
        setVal('metaLinkTwitter', m.linkTwitter);
        setVal('metaLinkInstagram', m.linkInstagram);
    }

    function syncMetadataFromForm() {
        const getVal = (id, def = '') => {
            const el = document.getElementById(id);
            return el ? el.value : def;
        };
        const getNum = (id, def = 0) => {
            const el = document.getElementById(id);
            return el ? (parseInt(el.value) || def) : def;
        };
        const getCheck = (id, def = false) => {
            const el = document.getElementById(id);
            return el ? el.checked : def;
        };

        const m = state.metadata;
        m.name = getVal('metaName', 'Song Title');
        m.artist = getVal('metaArtist', 'Artist');
        m.album = getVal('metaAlbum', 'Album');
        m.albumTrack = getNum('metaAlbumTrack', 1);
        m.year = getVal('metaYear', '2024');
        m.genre = getVal('metaGenre', 'Rock');
        m.subGenre = getVal('metaSubGenre', 'Alternative');
        m.tags = getVal('metaTags', '');
        m.location = getVal('metaLocation', '');
        m.rating = getNum('metaRating', 1);
        m.playlist = getVal('metaPlaylist', '');
        m.charter = getVal('metaCharter', 'Chart-Lab');
        m.icon = getVal('metaIcon', 'chartlab');
        m.loadingPhrase = getVal('metaLoadingPhrase', 'Charted with Chart-Lab Suite');

        m.diffBand = getNum('metaDiffBand', 2);
        m.diffGuitar = getNum('metaDiffGuitar', 3);
        m.diffGuitarGhl = getNum('metaDiffGuitarGhl', 0);
        m.diffGuitarCoop = getNum('metaDiffGuitarCoop', 0);
        m.diffBass = getNum('metaDiffBass', 2);
        m.diffBassGhl = getNum('metaDiffBassGhl', 0);
        m.diffRhythm = getNum('metaDiffRhythm', 0);
        m.diffRhythmGhl = getNum('metaDiffRhythmGhl', 0);
        m.diffDrums = getNum('metaDiffDrums', 3);
        m.diffDrumsReal = getNum('metaDiffDrumsReal', 3);
        m.diffEliteDrums = getNum('metaDiffEliteDrums', 0);
        m.diffKeys = getNum('metaDiffKeys', 0);
        m.diffKeysReal = getNum('metaDiffKeysReal', 0);
        m.diffVocals = getNum('metaDiffVocals', 3);
        m.diffVocalsHarm = getNum('metaDiffVocalsHarm', 0);
        m.diffDance = getNum('metaDiffDance', 0);

        m.proDrums = getCheck('metaProDrums', true);
        m.fiveLaneDrums = getCheck('metaFiveLaneDrums', false);
        m.ghwtDeReady = getCheck('metaGhwtDeReady', false);
        m.partsVocalsHarm = getNum('metaPartsVocalsHarm', 1);
        m.vocalScrollSpeed = getNum('metaVocalScrollSpeed', 100);
        m.modchart = getNum('metaModchart', 0);
        m.videoStartTime = getNum('metaVideoStartTime', 0);

        m.creditComposedBy = getVal('metaCreditComposedBy', '');
        m.creditProducedBy = getVal('metaCreditProducedBy', '');
        m.creditMixedBy = getVal('metaCreditMixedBy', '');
        m.creditMasteredBy = getVal('metaCreditMasteredBy', '');
        m.creditEngineeredBy = getVal('metaCreditEngineeredBy', '');
        m.creditAlbumArtBy = getVal('metaCreditAlbumArtBy', '');
        m.creditLicense = getVal('metaCreditLicense', '');

        m.linkSpotify = getVal('metaLinkSpotify', '');
        m.linkYoutube = getVal('metaLinkYoutube', '');
        m.linkBandcamp = getVal('metaLinkBandcamp', '');
        m.linkSoundcloud = getVal('metaLinkSoundcloud', '');
        m.linkTwitter = getVal('metaLinkTwitter', '');
        m.linkInstagram = getVal('metaLinkInstagram', '');

        m.songLengthMs = state.midiData ? Math.round(state.midiData.totalDurationSec * 1000) : 180000;
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
            showToast('Portada de álbum seleccionada', 'info');
        }
    });

    // 1-Click Export Handlers
    document.getElementById('btnExportZip').addEventListener('click', async () => {
        if (!state.midiData) {
            showToast('Cargue un archivo MIDI primero', 'warning');
            return;
        }

        syncMetadataFromForm();

        state.metadata.hasGuitarStem = !!state.audioEngine.stems.guitar.file;
        state.metadata.hasBassStem = !!state.audioEngine.stems.bass.file;
        state.metadata.hasDrumsStem = !!state.audioEngine.stems.drums.file;
        state.metadata.hasVocalsStem = !!state.audioEngine.stems.vocals.file;
        state.metadata.hasKeysStem = !!state.audioEngine.stems.keys.file;

        const chartText = PackageExporter.generateChartFile(state.midiData, state.allCharts, state.lyricEvents, state.metadata);
        const songIniText = PackageExporter.generateSongIni(state.metadata);

        const stems = {};
        for (let k in state.audioEngine.stems) {
            if (state.audioEngine.stems[k].file) {
                stems[`${k}.wav`] = state.audioEngine.stems[k].file;
            }
        }

        try {
            document.getElementById('btnExportZip').disabled = true;
            document.getElementById('btnExportZip').textContent = 'Empaquetando ZIP...';

            let artBlob = state.albumArtBlob;
            if (!artBlob) {
                artBlob = await PackageExporter.generatePlaceholderAlbumArt(state.metadata.name, state.metadata.artist);
            }

            const zipBlob = await PackageExporter.packageZip(chartText, songIniText, artBlob, stems, state.metadata);
            const safeName = `${state.metadata.artist} - ${state.metadata.name}`.replace(/[\\/:*?"<>|]/g, '');
            PackageExporter.triggerDownload(zipBlob, `${safeName}.zip`);

            showToast('Paquete ZIP descargado con éxito', 'success');
        } catch (err) {
            console.error(err);
            alert('Error al generar el ZIP: ' + err.message);
        } finally {
            document.getElementById('btnExportZip').disabled = false;
            document.getElementById('btnExportZip').textContent = 'Descargar Paquete ZIP';
        }
    });

    document.getElementById('btnExportChartOnly').addEventListener('click', () => {
        if (!state.midiData) {
            showToast('Cargue un archivo MIDI primero', 'warning');
            return;
        }
        syncMetadataFromForm();
        const chartText = PackageExporter.generateChartFile(state.midiData, state.allCharts, state.lyricEvents, state.metadata);
        const blob = new Blob([chartText], { type: 'text/plain;charset=utf-8' });
        PackageExporter.triggerDownload(blob, 'notes.chart');
        showToast('notes.chart descargado', 'success');
    });

    document.getElementById('btnExportIniOnly').addEventListener('click', () => {
        syncMetadataFromForm();
        const iniText = PackageExporter.generateSongIni(state.metadata);
        const blob = new Blob([iniText], { type: 'text/plain;charset=utf-8' });
        PackageExporter.triggerDownload(blob, 'song.ini');
        showToast('song.ini descargado', 'success');
    });

    document.getElementById('btnViewChartText').addEventListener('click', () => {
        if (!state.midiData) {
            showToast('Cargue un archivo MIDI primero', 'warning');
            return;
        }
        syncMetadataFromForm();
        const chartText = PackageExporter.generateChartFile(state.midiData, state.allCharts, state.lyricEvents, state.metadata);
        document.getElementById('chartTextPreview').value = chartText;
        const modal = new bootstrap.Modal(document.getElementById('chartPreviewModal'));
        modal.show();
    });

    document.getElementById('btnCopyChartText').addEventListener('click', () => {
        const text = document.getElementById('chartTextPreview').value;
        navigator.clipboard.writeText(text);
        showToast('Contenido copiado al portapapeles', 'info');
    });

    // Helper: Toast alerts
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} shadow-lg`;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '9999';
        toast.style.minWidth = '260px';
        toast.style.animation = 'fadeIn 0.3s ease';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.5s ease';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
});
