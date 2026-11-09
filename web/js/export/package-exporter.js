/**
 * Chart-Lab - Serializador de notes.chart, song.ini y Empaquetador ZIP
 * Autor: Ey-Liam
 */
class PackageExporter {
    static buildChartString(parsedMidi, generatedCharts, lyricEvents, sections, meta) {
        const res = parsedMidi ? parsedMidi.resolution : 480;
        const lines = [];

        // 1. [Song]
        lines.push('[Song]');
        lines.push('{');
        lines.push(`  Name = "${(meta.name || 'Song Title').replace(/"/g, "'")}"`);
        lines.push(`  Artist = "${(meta.artist || 'Artist').replace(/"/g, "'")}"`);
        lines.push(`  Album = "${(meta.album || 'Album').replace(/"/g, "'")}"`);
        lines.push(`  Year = ", ${meta.year || '2026'}"`);
        lines.push(`  Charter = "${(meta.charter || 'Chart-Lab').replace(/"/g, "'")}"`);
        lines.push(`  Offset = 0`);
        lines.push(`  Resolution = ${res}`);
        lines.push(`  Player2 = bass`);
        lines.push(`  Difficulty = ${meta.diffGuitar >= 0 ? meta.diffGuitar : 3}`);
        lines.push(`  PreviewStart = ${(parseInt(meta.previewStart || 15000, 10) / 1000).toFixed(2)}`);
        lines.push(`  PreviewEnd = ${((parseInt(meta.previewStart || 15000, 10) + 30000) / 1000).toFixed(2)}`);
        lines.push(`  Genre = "${(meta.genre || 'Rock').replace(/"/g, "'")}"`);
        lines.push(`  MediaType = "cd"`);
        lines.push(`  MusicStream = "song.ogg"`);
        lines.push('}');

        // 2. [SyncTrack]
        lines.push('[SyncTrack]');
        lines.push('{');
        if (parsedMidi && parsedMidi.timeSignatures && parsedMidi.timeSignatures.length > 0) {
            parsedMidi.timeSignatures.forEach(ts => {
                const denomExp = Math.round(Math.log2(ts.denominator || 4));
                lines.push(`  ${ts.tick} = TS ${ts.numerator} ${denomExp}`);
            });
        } else {
            lines.push('  0 = TS 4');
        }

        if (parsedMidi && parsedMidi.tempos && parsedMidi.tempos.length > 0) {
            parsedMidi.tempos.forEach(t => {
                const milliBpm = Math.round(t.bpm * 1000);
                lines.push(`  ${t.tick} = B ${milliBpm}`);
            });
        } else {
            lines.push('  0 = B 120000');
        }
        lines.push('}');

        // 3. [Events]
        lines.push('[Events]');
        lines.push('{');
        const allEvents = [];
        (sections || []).forEach(sec => {
            allEvents.push({ tick: sec.tick, val: `section ${sec.name}` });
        });
        (lyricEvents || []).forEach(le => {
            if (le.type === 'phrase_start' || le.type === 'phrase_end') {
                allEvents.push({ tick: le.tick, val: le.type });
            } else if (le.type === 'lyric') {
                allEvents.push({ tick: le.tick, val: `lyric ${le.text.replace(/"/g, "'")}` });
            }
        });
        allEvents.sort((a, b) => a.tick - b.tick);
        allEvents.forEach(ev => {
            lines.push(`  ${ev.tick} = E "${ev.val}"`);
        });
        lines.push('}');

        // 4. Secciones por Instrumento y Dificultad
        const diffs = ['Expert', 'Hard', 'Medium', 'Easy'];
        Object.entries(generatedCharts || {}).forEach(([instKey, diffsMap]) => {
            const instDef = CharterEngine.INSTRUMENTS[instKey];
            if (!instDef) return;

            diffs.forEach(diff => {
                const trackData = diffsMap[diff];
                if (!trackData || !trackData.notes || trackData.notes.length === 0) return;

                lines.push(`[${diff}${instDef.chartSuffix}]`);
                lines.push('{');

                const entries = [];
                trackData.notes.forEach(n => {
                    const outFret = n.rawChartFret !== undefined ? n.rawChartFret : n.fret;
                    entries.push({ tick: n.tick, order: 1, text: `  ${n.tick} = N ${outFret} ${n.sustainTicks || 0}` });
                    if (n.cymbalFlag) {
                        entries.push({ tick: n.tick, order: 2, text: `  ${n.tick} = N ${n.cymbalFlag} 0` });
                    }
                    if (n.isTap) {
                        entries.push({ tick: n.tick, order: 3, text: `  ${n.tick} = N 6 0` });
                    }
                });

                (trackData.starPower || []).forEach(sp => {
                    entries.push({ tick: sp.tick, order: 0, text: `  ${sp.tick} = S 2 ${sp.lengthTicks}` });
                });

                entries.sort((a, b) => a.tick - b.tick || a.order - b.order);
                entries.forEach(e => lines.push(e.text));
                lines.push('}');
            });
        });

        return lines.join('\r\n');
    }

    static buildSongIniString(meta, durationMs = 180000) {
        const lines = ['[song]'];
        lines.push(`name = ${meta.name || 'Song Title'}`);
        lines.push(`artist = ${meta.artist || 'Artist'}`);
        lines.push(`album = ${meta.album || 'Album'}`);
        lines.push(`genre = ${meta.genre || 'Rock'}`);
        if (meta.subGenre) lines.push(`sub_genre = ${meta.subGenre}`);
        lines.push(`year = ${meta.year || '2026'}`);
        lines.push(`charter = ${meta.charter || 'Chart-Lab'}`);
        lines.push(`song_length = ${Math.round(durationMs)}`);
        lines.push(`album_track = ${meta.albumTrack || 1}`);
        lines.push(`preview_start_time = ${meta.previewStart || 15000}`);
        lines.push(`delay = ${meta.delayMs || 0}`);
        lines.push(`icon = ${meta.icon || 'chartlab'}`);
        if (meta.playlist) lines.push(`playlist = ${meta.playlist}`);
        if (meta.loadingPhrase) lines.push(`loading_phrase = ${meta.loadingPhrase}`);

        // Dificultades
        lines.push(`diff_band = ${meta.diffBand !== undefined && !isNaN(meta.diffBand) ? meta.diffBand : -1}`);
        lines.push(`diff_guitar = ${meta.diffGuitar !== undefined && !isNaN(meta.diffGuitar) ? meta.diffGuitar : -1}`);
        lines.push(`diff_bass = ${meta.diffBass !== undefined && !isNaN(meta.diffBass) ? meta.diffBass : -1}`);
        lines.push(`diff_rhythm = ${meta.diffRhythm !== undefined && !isNaN(meta.diffRhythm) ? meta.diffRhythm : -1}`);
        lines.push(`diff_guitar_coop = ${meta.diffGuitarCoop !== undefined && !isNaN(meta.diffGuitarCoop) ? meta.diffGuitarCoop : -1}`);
        lines.push(`diff_guitarghl = ${meta.diffGuitarGhl !== undefined && !isNaN(meta.diffGuitarGhl) ? meta.diffGuitarGhl : -1}`);
        lines.push(`diff_bassghl = ${meta.diffBassGhl !== undefined && !isNaN(meta.diffBassGhl) ? meta.diffBassGhl : -1}`);
        lines.push(`diff_drums = ${meta.diffDrums !== undefined && !isNaN(meta.diffDrums) ? meta.diffDrums : -1}`);
        lines.push(`diff_drums_real = ${meta.diffDrumsReal !== undefined && !isNaN(meta.diffDrumsReal) ? meta.diffDrumsReal : -1}`);
        lines.push(`diff_keys = ${meta.diffKeys !== undefined && !isNaN(meta.diffKeys) ? meta.diffKeys : -1}`);
        lines.push(`diff_vocals = ${meta.diffVocals !== undefined && !isNaN(meta.diffVocals) ? meta.diffVocals : -1}`);
        lines.push(`diff_vocals_harm = ${meta.diffVocalsHarm !== undefined && !isNaN(meta.diffVocalsHarm) ? meta.diffVocalsHarm : -1}`);
        lines.push(`diff_dance = ${meta.diffDance !== undefined && !isNaN(meta.diffDance) ? meta.diffDance : -1}`);

        // Parámetros de motor
        lines.push(`pro_drums = ${meta.proDrums ? '1' : '0'}`);
        lines.push(`five_lane_drums = ${meta.fiveLaneDrums ? '1' : '0'}`);
        if (meta.sustainCutoff) lines.push(`sustain_cutoff_threshold = 0`);

        if (meta.ghwtDeReady) {
            lines.push(`ghwt_de_compatible = 1`);
            lines.push(`checksum_verified = 1`);
        }

        if (meta.creditComposedBy) lines.push(`credit_composed_by = ${meta.creditComposedBy}`);
        if (meta.creditProducedBy) lines.push(`credit_produced_by = ${meta.creditProducedBy}`);
        if (meta.linkSpotify) lines.push(`link_spotify = ${meta.linkSpotify}`);
        if (meta.linkYoutube) lines.push(`link_youtube = ${meta.linkYoutube}`);

        lines.push('; --- Metadata & Credits ---');
        lines.push('credit_arranged_by = Ey-Liam');
        lines.push('credit_courtesy_of = Ey-Liam');
        lines.push('credit_other = Ey-Liam');
        lines.push('; Concept inspiration: EFHIII & rhythm gaming community');

        return lines.join('\r\n');
    }

    static async exportZipPackage(chartStr, iniStr, albumCanvas, stemsMap, meta) {
        if (typeof JSZip === 'undefined') {
            throw new Error('La libreria JSZip no esta disponible.');
        }

        const zip = new JSZip();
        const safeArtist = (meta.artist || 'Artist').replace(/[\\/:*?"<>|]/g, '').trim();
        const safeName = (meta.name || 'Song').replace(/[\\/:*?"<>|]/g, '').trim();
        const safeCharter = (meta.charter || 'Chart-Lab').replace(/[\\/:*?"<>|]/g, '').trim();
        const folderName = `${safeArtist} - ${safeName} [${safeCharter}]`;
        const folder = zip.folder(folderName);

        folder.file('notes.chart', chartStr);
        folder.file('song.ini', iniStr);

        if (albumCanvas) {
            const dataUrl = albumCanvas.toDataURL('image/png');
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
            folder.file('album.png', base64Data, { base64: true });
        }

        Object.entries(stemsMap || {}).forEach(([slotKey, stemObj]) => {
            if (stemObj && stemObj.file) {
                const ext = stemObj.file.name.split('.').pop().toLowerCase() || 'ogg';
                folder.file(`${slotKey}.${ext}`, stemObj.file);
            }
        });

        const blob = await zip.generateAsync({ type: 'blob' });
        this.triggerDownload(blob, `${folderName}.zip`);
    }

    static triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 200);
    }
}

window.PackageExporter = PackageExporter;