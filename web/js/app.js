/**
 * Chart-Lab - Controlador Principal de Interfaz y Estado
 * Autor: Ey-Liam
 */
document.addEventListener('DOMContentLoaded', () => {
    const audioManager = new AudioManager();
    const visualizer = new HighwayVisualizer('highwayCanvas', 'waveformSyncCanvas', 'vocalPreviewCanvas');

    let parsedMidi = null;
    let trackAssignments = {};
    let generatedCharts = {};
    let lyricEvents = [];
    let syllableByNoteIdx = [];
    let sections = [{ tick: 0, name: 'Intro' }];

    // 1. Navegación de Pestañas Principales
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('main > .tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add('active');
            window.dispatchEvent(new Event('resize'));
        });
    });

    // 2. Portada por defecto en Canvas
    const albumCanvas = document.getElementById('albumArtCanvas');
    const drawDefaultCover = (title, artist) => {
        if (!albumCanvas) return;
        const ctx = albumCanvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 180, 180);
        grad.addColorStop(0, '#0b132b');
        grad.addColorStop(1, '#0284c7');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 180, 180);

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.strokeRect(8, 8, 164, 164);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CHART-LAB', 90, 40);

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 15px system-ui, sans-serif';
        ctx.fillText((title || 'Song Title').slice(0, 18), 90, 95);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '500 12px system-ui, sans-serif';
        ctx.fillText((artist || 'Artist').slice(0, 20), 90, 120);
    };
    drawDefaultCover('Song Title', 'Artist');

    document.getElementById('albumArtInput')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !albumCanvas) return;
        const img = new Image();
        img.onload = () => {
            const ctx = albumCanvas.getContext('2d');
            ctx.clearRect(0, 0, 180, 180);
            ctx.drawImage(img, 0, 0, 180, 180);
        };
        img.src = URL.createObjectURL(file);
    });

    // 3. Carga de Archivo MIDI
    const midiInput = document.getElementById('midiFileInput');
    const handleMidiFile = async (file) => {
        if (!file) return;
        try {
            const buf = await file.arrayBuffer();
            parsedMidi = MidiParser.parseArrayBuffer(buf);

            document.getElementById('midiFileName').textContent = `MIDI: ${file.name}`;
            const mainBpm = parsedMidi.tempos[0] ? Math.round(parsedMidi.tempos[0].bpm) : 120;
            document.getElementById('tempoSummaryBadge').textContent = `BPM: ${mainBpm} (${parsedMidi.tempos.length} cambios)`;

            const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
            const parts = cleanName.split(' - ');
            if (parts.length >= 2) {
                document.getElementById('metaArtist').value = parts[0].trim();
                document.getElementById('metaName').value = parts.slice(1).join(' - ').trim();
            } else {
                document.getElementById('metaName').value = cleanName;
            }
            drawDefaultCover(document.getElementById('metaName').value, document.getElementById('metaArtist').value);

            audioManager.setMidiPlaybackData(parsedMidi);
            sections = LyricsAligner.autoGenerateSections(parsedMidi);
            renderSectionsTable();

            autoAssignTracks();
            renderTrackRoutingTable();
            populateVocalTrackDropdown();
            rebuildAllCharts();
        } catch (err) {
            alert(`Error al leer el archivo MIDI: ${err.message}`);
        }
    };

    midiInput?.addEventListener('change', (e) => handleMidiFile(e.target.files[0]));

    const autoAssignTracks = () => {
        if (!parsedMidi) return;
        trackAssignments = {};
        const used = new Set();
        parsedMidi.tracks.forEach(trk => {
            const inst = CharterEngine.autoDetectInstrument(trk, used);
            trackAssignments[trk.id] = inst;
            if (inst !== 'none') used.add(inst);
        });
    };

    document.getElementById('btnAutoAssign')?.addEventListener('click', () => {
        autoAssignTracks();
        renderTrackRoutingTable();
        rebuildAllCharts();
    });

    document.getElementById('btnStopMidiPreview')?.addEventListener('click', () => {
        audioManager.pause();
        updatePlayButtonLabels();
    });

    const renderTrackRoutingTable = () => {
        const tbody = document.getElementById('trackRoutingBody');
        if (!tbody || !parsedMidi) return;
        tbody.innerHTML = '';

        parsedMidi.tracks.forEach(trk => {
            const tr = document.createElement('tr');
            const rangeStr = `${MidiParser.pitchToNoteName(trk.minPitch)} - ${MidiParser.pitchToNoteName(trk.maxPitch)}`;

            let optionsHtml = `<option value="none">Ignorar / No asignar</option>`;
            Object.values(CharterEngine.INSTRUMENTS).forEach(inst => {
                const sel = trackAssignments[trk.id] === inst.id ? 'selected' : '';
                optionsHtml += `<option value="${inst.id}" ${sel}>${inst.label}</option>`;
            });

            tr.innerHTML = `
                <td>Canal ${trk.channel + 1} (#${trk.id + 1})</td>
                <td class="fw-semibold">${trk.name}</td>
                <td><span class="badge badge-notes">${trk.notes.length} notas</span></td>
                <td class="font-monospace small">${rangeStr}</td>
                <td>
                    <button class="btn btn-sm btn-outline-info btn-preview-trk" data-trk="${trk.id}">
                        Escuchar Pista
                    </button>
                </td>
                <td>
                    <select class="form-select form-select-sm trk-assign-select" data-trk="${trk.id}">
                        ${optionsHtml}
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-preview-trk').forEach(btn => {
            btn.addEventListener('click', () => {
                const trkId = parseInt(btn.dataset.trk, 10);
                if (audioManager.isPlaying && audioManager.previewTrackIndex === trkId) {
                    audioManager.pause();
                    btn.textContent = 'Escuchar Pista';
                } else {
                    tbody.querySelectorAll('.btn-preview-trk').forEach(b => b.textContent = 'Escuchar Pista');
                    const firstNoteSec = parsedMidi.tracks[trkId].notes[0]
                        ? parsedMidi.tickToSeconds(parsedMidi.tracks[trkId].notes[0].tick)
                        : 0;
                    audioManager.seek(Math.max(0, firstNoteSec - 0.2));
                    audioManager.play(trkId);
                    btn.textContent = 'Detener';
                }
                updatePlayButtonLabels();
            });
        });

        tbody.querySelectorAll('.trk-assign-select').forEach(sel => {
            sel.addEventListener('change', () => {
                trackAssignments[parseInt(sel.dataset.trk, 10)] = sel.value;
                rebuildAllCharts();
            });
        });
    };

    const getTuningParams = () => ({
        frets: document.getElementById('tuningFrets')?.value || '5',
        maxChords: document.getElementById('tuningMaxChords')?.value || '2',
        style: document.getElementById('tuningStyle')?.value || 'balanced',
        hopoThreshold: document.getElementById('tuningHopoThreshold')?.value || '65',
        minSustain: document.getElementById('tuningMinSustain')?.value || '0.5',
        starPower: document.getElementById('tuningStarPower')?.value || '16',
        drumPedal: document.getElementById('tuningDrumPedal')?.value || 'pro_single',
        openNotesMode: document.getElementById('tuningOpenNotesMode')?.value || 'bass_only',
        density: document.getElementById('tuningDensity')?.value || '100'
    });

    const rebuildAllCharts = () => {
        if (!parsedMidi) return;
        const tuning = getTuningParams();
        generatedCharts = CharterEngine.generateAllDifficulties(parsedMidi, trackAssignments, tuning);

        const audit = ChartValidator.validateAndRepair(generatedCharts, parsedMidi.resolution);
        document.getElementById('auditBadge').textContent = `Auditoria: ${audit.fixesApplied} ajustes aplicados`;

        updateActiveInstrumentSelectors();
        updateMetricsPanel();
    };

    document.getElementById('btnReRoll')?.addEventListener('click', rebuildAllCharts);
    ['tuningFrets', 'tuningMaxChords', 'tuningStyle', 'tuningHopoThreshold', 'tuningMinSustain', 'tuningStarPower', 'tuningDrumPedal', 'tuningOpenNotesMode'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', rebuildAllCharts);
    });
    document.getElementById('tuningDensity')?.addEventListener('input', (e) => {
        document.getElementById('densityLabel').textContent = `${e.target.value}%`;
        rebuildAllCharts();
    });

    const updateActiveInstrumentSelectors = () => {
        const activeInsts = Object.keys(generatedCharts);
        ['statsInstSelect', 'highwayInstSelect'].forEach(selId => {
            const sel = document.getElementById(selId);
            if (!sel) return;
            const prevVal = sel.value;
            sel.innerHTML = '';
            activeInsts.forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = CharterEngine.INSTRUMENTS[k].label;
                sel.appendChild(opt);
            });
            if (activeInsts.includes(prevVal)) sel.value = prevVal;
        });
    };

    const updateMetricsPanel = () => {
        const inst = document.getElementById('statsInstSelect')?.value;
        const diff = document.getElementById('statsDiffSelect')?.value || 'Expert';
        const trackData = (generatedCharts[inst] && generatedCharts[inst][diff]) ? generatedCharts[inst][diff] : null;
        const stats = CharterEngine.computeTrackStats(trackData);

        document.getElementById('statTotalNotes').textContent = stats.totalNotes;
        document.getElementById('statNpsAvg').textContent = stats.avgNps;
        document.getElementById('statNpsPeak').textContent = stats.peakNps;
        document.getElementById('statChords').textContent = stats.chordsCount;
        document.getElementById('statStarPower').textContent = stats.spCount;
        document.getElementById('statSuggestedDiff').textContent = `Nivel ${stats.suggestedTier}`;
    };

    document.getElementById('statsInstSelect')?.addEventListener('change', updateMetricsPanel);
    document.getElementById('statsDiffSelect')?.addEventListener('change', updateMetricsPanel);

    document.getElementById('btnApplySuggestedDiff')?.addEventListener('click', () => {
        const mapField = {
            guitar: 'metaDiffGuitar',
            bass: 'metaDiffBass',
            rhythm: 'metaDiffRhythm',
            coop: 'metaDiffGuitarCoop',
            ghl_guitar: 'metaDiffGuitarGhl',
            ghl_bass: 'metaDiffBassGhl',
            drums: 'metaDiffDrums',
            keys: 'metaDiffKeys',
            vocals: 'metaDiffVocals',
            harm1: 'metaDiffVocalsHarm',
            dance: 'metaDiffDance'
        };
        Object.values(mapField).forEach(fid => {
            const el = document.getElementById(fid);
            if (el) el.value = -1;
        });
        Object.keys(generatedCharts).forEach(instKey => {
            const st = CharterEngine.computeTrackStats(generatedCharts[instKey].Expert);
            const fieldId = mapField[instKey];
            if (fieldId && document.getElementById(fieldId)) {
                document.getElementById(fieldId).value = st.suggestedTier;
            }
            if (instKey === 'drums' && document.getElementById('metaDiffDrumsReal')) {
                document.getElementById('metaDiffDrumsReal').value = st.suggestedTier;
            }
        });
    });

    // 4. Pestaña Letras y Secciones
    const populateVocalTrackDropdown = () => {
        const sel = document.getElementById('vocalTrackSelect');
        if (!sel || !parsedMidi) return;
        sel.innerHTML = '';
        parsedMidi.tracks.forEach(trk => {
            const opt = document.createElement('option');
            opt.value = trk.id;
            opt.textContent = `Pista #${trk.id + 1}: ${trk.name} (${trk.notes.length} notas)`;
            if (trackAssignments[trk.id] === 'vocals') opt.selected = true;
            sel.appendChild(opt);
        });
    };

    document.getElementById('btnPreviewSyllables')?.addEventListener('click', () => {
        const area = document.getElementById('lyricsTextInput');
        const mode = document.getElementById('lyricsModeSelect')?.value || 'syllables';
        if (area && area.value.trim()) {
            area.value = LyricsAligner.previewSyllableBreakdown(area.value, mode);
        }
    });

    document.getElementById('btnImportMidiLyrics')?.addEventListener('click', () => {
        if (!parsedMidi || !parsedMidi.embeddedLyrics.length) {
            alert('Este archivo MIDI no contiene eventos de letra internos.');
            return;
        }
        const text = parsedMidi.embeddedLyrics.map(e => e.text).join(' ');
        document.getElementById('lyricsTextInput').value = text;
    });

    const syncLyricsNow = () => {
        if (!parsedMidi) return;
        const trkId = parseInt(document.getElementById('vocalTrackSelect')?.value || '0', 10);
        const trk = parsedMidi.tracks[trkId];
        if (!trk) return;

        const rawText = document.getElementById('lyricsTextInput')?.value || '';
        const mode = document.getElementById('lyricsModeSelect')?.value || 'syllables';
        const res = LyricsAligner.alignLyricsToTrack(parsedMidi, trk.notes, rawText, mode);

        lyricEvents = res.events;
        syllableByNoteIdx = res.syllableByNoteIdx;

        document.getElementById('lyricCountLabel').textContent = lyricEvents.length;
        document.getElementById('lyricsStatusBadge').textContent = `Letras: ${lyricEvents.filter(e => e.type === 'lyric').length} silabas`;

        const tbody = document.getElementById('lyricsEventsBody');
        tbody.innerHTML = '';
        lyricEvents.slice(0, 300).forEach(ev => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-monospace">${ev.tick}</td>
                <td class="font-monospace">${ev.timeSec.toFixed(2)}s</td>
                <td><span class="badge badge-notes">${ev.type}</span></td>
                <td class="fw-semibold">${ev.text}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    document.getElementById('btnAlignLyrics')?.addEventListener('click', syncLyricsNow);

    document.getElementById('btnPlayVocalPreview')?.addEventListener('click', () => {
        if (!parsedMidi) return;
        const trkId = parseInt(document.getElementById('vocalTrackSelect')?.value || '0', 10);
        if (audioManager.isPlaying) {
            audioManager.pause();
        } else {
            const firstTick = parsedMidi.tracks[trkId]?.notes[0]?.tick || 0;
            audioManager.seek(Math.max(0, parsedMidi.tickToSeconds(firstTick) - 0.2));
            audioManager.play(trkId);
        }
        updatePlayButtonLabels();
    });

    const renderSectionsTable = () => {
        const tbody = document.getElementById('sectionsListBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        sections.sort((a, b) => a.tick - b.tick);
        sections.forEach((sec, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-monospace">${sec.tick}</td>
                <td>${sec.name}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger py-0 px-2 btn-del-sec" data-idx="${idx}">X</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.btn-del-sec').forEach(btn => {
            btn.addEventListener('click', () => {
                sections.splice(parseInt(btn.dataset.idx, 10), 1);
                renderSectionsTable();
            });
        });
    };

    document.getElementById('btnAutoSections')?.addEventListener('click', () => {
        sections = LyricsAligner.autoGenerateSections(parsedMidi);
        renderSectionsTable();
    });

    document.getElementById('btnAddSection')?.addEventListener('click', () => {
        const measure = Math.max(1, parseInt(document.getElementById('newSectionMeasure')?.value || '1', 10));
        const name = (document.getElementById('newSectionName')?.value || '').trim();
        if (!name) return;
        const res = parsedMidi ? parsedMidi.resolution : 480;
        sections.push({ tick: (measure - 1) * res * 4, name });
        document.getElementById('newSectionName').value = '';
        renderSectionsTable();
    });

    // 5. Pestaña Audio y Sincronización
    const stemKeys = ['song', 'guitar', 'bass', 'drums', 'vocals', 'keys'];
    stemKeys.forEach(key => {
        const fileIn = document.getElementById(`stemFile_${key}`);
        const muteBtn = document.getElementById(`stemMute_${key}`);
        const soloBtn = document.getElementById(`stemSolo_${key}`);
        const nameLbl = document.getElementById(`stemName_${key}`);

        fileIn?.addEventListener('change', async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            nameLbl.textContent = `Cargando ${f.name}...`;
            try {
                const dur = await audioManager.loadStemFile(key, f);
                nameLbl.textContent = `${f.name} (${dur.toFixed(1)}s)`;
            } catch (err) {
                nameLbl.textContent = `Error en formato de audio`;
            }
        });

        muteBtn?.addEventListener('click', () => {
            if (!audioManager.stems[key]) return;
            audioManager.stems[key].mute = !audioManager.stems[key].mute;
            muteBtn.classList.toggle('active', audioManager.stems[key].mute);
            if (audioManager.isPlaying) audioManager.seek(audioManager.getCurrentTimeSec());
        });

        soloBtn?.addEventListener('click', () => {
            if (!audioManager.stems[key]) return;
            audioManager.stems[key].solo = !audioManager.stems[key].solo;
            soloBtn.classList.toggle('active', audioManager.stems[key].solo);
            if (audioManager.isPlaying) audioManager.seek(audioManager.getCurrentTimeSec());
        });
    });

    document.getElementById('audioSourceMode')?.addEventListener('change', (e) => {
        audioManager.sourceMode = e.target.value;
        if (audioManager.isPlaying) audioManager.seek(audioManager.getCurrentTimeSec());
    });

    const offsetInput = document.getElementById('audioOffsetMs');
    offsetInput?.addEventListener('input', () => {
        audioManager.offsetMs = parseInt(offsetInput.value || '0', 10);
    });
    document.getElementById('btnOffsetMinus10')?.addEventListener('click', () => {
        offsetInput.value = parseInt(offsetInput.value || '0', 10) - 10;
        audioManager.offsetMs = parseInt(offsetInput.value, 10);
    });
    document.getElementById('btnOffsetPlus10')?.addEventListener('click', () => {
        offsetInput.value = parseInt(offsetInput.value || '0', 10) + 10;
        audioManager.offsetMs = parseInt(offsetInput.value, 10);
    });

    document.getElementById('midiSynthVolume')?.addEventListener('input', (e) => {
        document.getElementById('midiVolLabel').textContent = `${e.target.value}%`;
        audioManager.midiVolume = parseInt(e.target.value, 10) / 100;
    });

    document.getElementById('masterStemVolume')?.addEventListener('input', (e) => {
        document.getElementById('stemVolLabel').textContent = `${e.target.value}%`;
        audioManager.stemMasterVolume = parseInt(e.target.value, 10) / 100;
        if (audioManager.isPlaying) audioManager.seek(audioManager.getCurrentTimeSec());
    });

    // 6. Controles de Reproducción y Bucle de Renderizado (60 FPS)
    const updatePlayButtonLabels = () => {
        const label = audioManager.isPlaying ? 'Pausar' : 'Reproducir';
        const btn1 = document.getElementById('btnPlayPause');
        const btn2 = document.getElementById('btnAudioTabPlay');
        if (btn1) btn1.textContent = label;
        if (btn2) btn2.textContent = audioManager.isPlaying ? 'Pausar Prueba' : 'Reproducir Prueba';
    };

    const toggleMainPlayback = () => {
        if (audioManager.isPlaying) audioManager.pause();
        else audioManager.play(null);
        updatePlayButtonLabels();
    };

    document.getElementById('btnPlayPause')?.addEventListener('click', toggleMainPlayback);
    document.getElementById('btnAudioTabPlay')?.addEventListener('click', toggleMainPlayback);
    document.getElementById('btnRestartVis')?.addEventListener('click', () => {
        audioManager.seek(0);
    });

    const scrubber = document.getElementById('timeScrubber');
    scrubber?.addEventListener('input', () => {
        const targetSec = (parseFloat(scrubber.value) / 100) * audioManager.durationSec;
        audioManager.seek(targetSec);
    });

    document.getElementById('playbackRateSelect')?.addEventListener('change', (e) => {
        audioManager.playbackRate = parseFloat(e.target.value || '1.0');
        if (audioManager.isPlaying) audioManager.seek(audioManager.getCurrentTimeSec());
    });

    const metroBtn = document.getElementById('btnMetronomeToggle');
    metroBtn?.addEventListener('click', () => {
        audioManager.metronomeEnabled = !audioManager.metronomeEnabled;
        metroBtn.textContent = `Metronomo: ${audioManager.metronomeEnabled ? 'ON' : 'OFF'}`;
    });

    const formatTime = (sec) => {
        const m = Math.floor(sec / 60);
        const s = (sec % 60).toFixed(1).padStart(4, '0');
        return `${m}:${s}`;
    };

    const renderLoop = () => {
        const curSec = audioManager.getCurrentTimeSec();
        const durSec = Math.max(1, audioManager.durationSec);

        if (scrubber && document.activeElement !== scrubber) {
            scrubber.value = ((curSec / durSec) * 100).toFixed(2);
        }
        const timeDisp = document.getElementById('timeDisplay');
        if (timeDisp) {
            timeDisp.textContent = `${formatTime(curSec)} / ${formatTime(durSec)}`;
        }

        // 1. Renderizar Highway 3D
        const visInst = document.getElementById('highwayInstSelect')?.value || 'guitar';
        const visDiff = document.getElementById('highwayDiffSelect')?.value || 'Expert';
        const visSpeed = parseFloat(document.getElementById('highwaySpeedSelect')?.value || '1.8');
        const instMeta = CharterEngine.INSTRUMENTS[visInst] || CharterEngine.INSTRUMENTS.guitar;
        const activeNotes = (generatedCharts[visInst] && generatedCharts[visInst][visDiff])
            ? generatedCharts[visInst][visDiff].notes
            : [];

        visualizer.renderHighway(activeNotes, lyricEvents, curSec, visSpeed, instMeta.lanes, instMeta.isGhl);

        // 2. Renderizar Inspector de Espectro y Sincronización
        const zoomSec = parseFloat(document.getElementById('waveformZoom')?.value || '8');
        visualizer.renderWaveformSync(
            audioManager.waveformPeaks,
            durSec,
            audioManager.beatTimesSec,
            curSec,
            audioManager.offsetMs,
            zoomSec
        );

        // 3. Renderizar Cinta Vocal
        const vTrkId = parseInt(document.getElementById('vocalTrackSelect')?.value || '0', 10);
        const vNotesRaw = (parsedMidi && parsedMidi.tracks[vTrkId]) ? parsedMidi.tracks[vTrkId].notes : [];
        const vNotesTimed = vNotesRaw.map(n => ({
            pitch: n.pitch,
            timeSec: parsedMidi.tickToSeconds(n.tick),
            durationSec: Math.max(0.08, parsedMidi.tickToSeconds(n.tick + n.durationTicks) - parsedMidi.tickToSeconds(n.tick))
        }));
        const ribbonScroll = audioManager.isPlaying
            ? (curSec / durSec)
            : (parseFloat(document.getElementById('vocalRibbonScroll')?.value || '0') / 100);
        visualizer.renderVocalRibbon(vNotesTimed, syllableByNoteIdx, ribbonScroll, durSec);

        requestAnimationFrame(renderLoop);
    };
    requestAnimationFrame(renderLoop);

    // 7. Recolección de Metadatos y Exportación
    const collectMetadata = () => ({
        name: document.getElementById('metaName')?.value || 'Song Title',
        artist: document.getElementById('metaArtist')?.value || 'Artist',
        album: document.getElementById('metaAlbum')?.value || 'Album',
        albumTrack: document.getElementById('metaAlbumTrack')?.value || '1',
        year: document.getElementById('metaYear')?.value || '2026',
        genre: document.getElementById('metaGenre')?.value || 'Rock',
        subGenre: document.getElementById('metaSubGenre')?.value || '',
        charter: document.getElementById('metaCharter')?.value || 'Chart-Lab',
        previewStart: document.getElementById('metaPreviewStart')?.value || '15000',
        delayMs: document.getElementById('audioOffsetMs')?.value || '0',
        icon: document.getElementById('metaIcon')?.value || 'chartlab',
        playlist: document.getElementById('metaPlaylist')?.value || '',
        loadingPhrase: document.getElementById('metaLoadingPhrase')?.value || '',
        diffBand: parseInt(document.getElementById('metaDiffBand')?.value || '3', 10),
        diffGuitar: parseInt(document.getElementById('metaDiffGuitar')?.value || '3', 10),
        diffBass: parseInt(document.getElementById('metaDiffBass')?.value || '2', 10),
        diffRhythm: parseInt(document.getElementById('metaDiffRhythm')?.value || '-1', 10),
        diffGuitarCoop: parseInt(document.getElementById('metaDiffGuitarCoop')?.value || '-1', 10),
        diffGuitarGhl: parseInt(document.getElementById('metaDiffGuitarGhl')?.value || '-1', 10),
        diffBassGhl: parseInt(document.getElementById('metaDiffBassGhl')?.value || '-1', 10),
        diffDrums: parseInt(document.getElementById('metaDiffDrums')?.value || '3', 10),
        diffDrumsReal: parseInt(document.getElementById('metaDiffDrumsReal')?.value || '3', 10),
        diffKeys: parseInt(document.getElementById('metaDiffKeys')?.value || '-1', 10),
        diffVocals: parseInt(document.getElementById('metaDiffVocals')?.value || '2', 10),
        diffVocalsHarm: parseInt(document.getElementById('metaDiffVocalsHarm')?.value || '-1', 10),
        diffDance: parseInt(document.getElementById('metaDiffDance')?.value || '-1', 10),
        proDrums: document.getElementById('metaProDrums')?.checked ?? true,
        fiveLaneDrums: document.getElementById('metaFiveLaneDrums')?.checked ?? false,
        sustainCutoff: document.getElementById('metaSustainCutoff')?.checked ?? false,
        ghwtDeReady: document.getElementById('metaGhwtDeReady')?.checked ?? false,
        creditComposedBy: document.getElementById('metaCreditComposedBy')?.value || '',
        creditProducedBy: document.getElementById('metaCreditProducedBy')?.value || '',
        linkSpotify: document.getElementById('metaLinkSpotify')?.value || '',
        linkYoutube: document.getElementById('metaLinkYoutube')?.value || ''
    });

    document.getElementById('btnExportZip')?.addEventListener('click', async () => {
        const meta = collectMetadata();
        const chartStr = PackageExporter.buildChartString(parsedMidi, generatedCharts, lyricEvents, sections, meta);
        const iniStr = PackageExporter.buildSongIniString(meta, audioManager.durationSec * 1000);
        await PackageExporter.exportZipPackage(chartStr, iniStr, albumCanvas, audioManager.stems, meta);
    });

    document.getElementById('btnExportChartOnly')?.addEventListener('click', () => {
        const meta = collectMetadata();
        const chartStr = PackageExporter.buildChartString(parsedMidi, generatedCharts, lyricEvents, sections, meta);
        PackageExporter.triggerDownload(new Blob([chartStr], { type: 'text/plain;charset=utf-8' }), 'notes.chart');
    });

    document.getElementById('btnExportIniOnly')?.addEventListener('click', () => {
        const meta = collectMetadata();
        const iniStr = PackageExporter.buildSongIniString(meta, audioManager.durationSec * 1000);
        PackageExporter.triggerDownload(new Blob([iniStr], { type: 'text/plain;charset=utf-8' }), 'song.ini');
    });

    document.getElementById('btnViewChartText')?.addEventListener('click', () => {
        const meta = collectMetadata();
        const chartStr = PackageExporter.buildChartString(parsedMidi, generatedCharts, lyricEvents, sections, meta);
        document.getElementById('chartTextPreview').value = chartStr;
        const modal = new bootstrap.Modal(document.getElementById('chartPreviewModal'));
        modal.show();
    });

    document.getElementById('btnCopyChartText')?.addEventListener('click', () => {
        const txt = document.getElementById('chartTextPreview')?.value || '';
        navigator.clipboard.writeText(txt);
    });
});