/**
 * MIDI-CH Studio Pro - Clone Hero / YARG Chart & Song.ini Exporter
 * Generates 100% compliant .chart files, song.ini metadata, and ready-to-play ZIP packages.
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ChartExporter = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // Maps internal instrument names to standard Clone Hero chart track names
    const TRACK_HEADER_MAP = {
        guitar: {
            'Expert': 'ExpertSingle',
            'Hard': 'HardSingle',
            'Medium': 'MediumSingle',
            'Easy': 'EasySingle'
        },
        bass: {
            'Expert': 'ExpertDoubleBass',
            'Hard': 'HardDoubleBass',
            'Medium': 'MediumDoubleBass',
            'Easy': 'EasyDoubleBass'
        },
        rhythm: {
            'Expert': 'ExpertRhythm',
            'Hard': 'HardRhythm',
            'Medium': 'MediumRhythm',
            'Easy': 'EasyRhythm'
        },
        keys: {
            'Expert': 'ExpertKeyboard',
            'Hard': 'HardKeyboard',
            'Medium': 'MediumKeyboard',
            'Easy': 'EasyKeyboard'
        },
        drums: {
            'Expert': 'ExpertDrums',
            'Hard': 'HardDrums',
            'Medium': 'MediumDrums',
            'Easy': 'EasyDrums'
        }
    };

    /**
     * Generates full .chart file contents
     */
    function generateChartString(midiData, allCharts, lyricEvents, metadata = {}) {
        const ppq = midiData.ppq || 480;
        const name = metadata.name || 'Untitled Song';
        const artist = metadata.artist || 'Unknown Artist';
        const album = metadata.album || 'Unknown Album';
        const year = metadata.year || '2024';
        const charter = metadata.charter || 'EFHIII & Antigravity (MIDI-CH Studio Pro)';
        const offsetSec = (metadata.offsetMs || 0) / 1000;
        const genre = metadata.genre || 'Rock';

        let chart = '';

        // [Song] Header
        chart += '[Song]\n{\n';
        chart += `  Name = "${name}"\n`;
        chart += `  Artist = "${artist}"\n`;
        chart += `  Charter = "${charter}"\n`;
        chart += `  Album = "${album}"\n`;
        chart += `  Year = ", ${year}"\n`;
        chart += `  Offset = ${offsetSec.toFixed(3)}\n`;
        chart += `  Resolution = ${ppq}\n`;
        chart += `  Player2 = "bass"\n`;
        chart += `  Difficulty = 0\n`;
        chart += `  PreviewStart = ${metadata.previewStartSec || 0}\n`;
        chart += `  PreviewEnd = ${(metadata.previewStartSec || 0) + 30}\n`;
        chart += `  Genre = "${genre}"\n`;
        chart += `  MediaType = "cd"\n`;

        // Audio streams
        if (metadata.hasGuitarStem) chart += `  GuitarStream = "guitar.ogg"\n`;
        if (metadata.hasBassStem) chart += `  BassStream = "bass.ogg"\n`;
        if (metadata.hasDrumsStem) chart += `  DrumStream = "drums.ogg"\n`;
        if (metadata.hasVocalsStem) chart += `  VocalStream = "vocals.ogg"\n`;
        if (metadata.hasKeysStem) chart += `  KeyboardStream = "keys.ogg"\n`;
        chart += `  MusicStream = "song.ogg"\n`;
        chart += '}\n';

        // [SyncTrack]
        chart += '[SyncTrack]\n{\n';
        const syncEvents = [];
        if (midiData.timeSignatures) {
            for (let ts of midiData.timeSignatures) {
                syncEvents.push({ tick: ts.tick, text: `TS ${ts.num}` });
            }
        }
        if (midiData.tempos) {
            for (let tm of midiData.tempos) {
                syncEvents.push({ tick: tm.tick, text: `B ${Math.round(tm.bpm * 1000)}` });
            }
        }
        syncEvents.sort((a, b) => a.tick - b.tick);
        if (syncEvents.length === 0 || syncEvents[0].tick !== 0) {
            chart += '  0 = TS 4\n';
            chart += '  0 = B 120000\n';
        }
        for (let ev of syncEvents) {
            chart += `  ${ev.tick} = ${ev.text}\n`;
        }
        chart += '}\n';

        // [Events]
        chart += '[Events]\n{\n';
        const events = [...(lyricEvents || [])];
        if (events.length === 0) {
            events.push({ tick: 0, eventText: 'section Intro' });
        }
        events.sort((a, b) => a.tick - b.tick);
        for (let ev of events) {
            chart += `  ${ev.tick} = E "${ev.eventText}"\n`;
        }
        chart += '}\n';

        // Instrument Sections
        for (let inst in allCharts) {
            const instTracks = allCharts[inst];
            const headerDict = TRACK_HEADER_MAP[inst];
            if (!headerDict) continue;

            for (let diff in instTracks) {
                const headerName = headerDict[diff];
                const noteList = instTracks[diff];
                if (!headerName || !noteList || noteList.length === 0) continue;

                chart += `[${headerName}]\n{\n`;

                const lines = [];
                for (let ev of noteList) {
                    lines.push(`  ${ev.tick} = N ${ev.fret} ${ev.sustain || 0}`);
                    if (ev.starPower) {
                        lines.push(`  ${ev.starPower.tick} = S 2 ${ev.starPower.duration}`);
                    }
                }

                // Sort lines by tick
                lines.sort((a, b) => {
                    const tickA = parseInt(a.trim().split(' ')[0]);
                    const tickB = parseInt(b.trim().split(' ')[0]);
                    return tickA - tickB;
                });

                chart += lines.join('\n') + '\n}\n';
            }
        }

        return chart;
    }

    /**
     * Generates standard song.ini text
     */
    function generateSongIni(metadata = {}) {
        return `[Song]
name = ${metadata.name || 'Untitled Song'}
artist = ${metadata.artist || 'Unknown Artist'}
album = ${metadata.album || 'Unknown Album'}
genre = ${metadata.genre || 'Rock'}
year = ${metadata.year || '2024'}
charter = ${metadata.charter || 'EFHIII & Antigravity (MIDI-CH Studio Pro)'}
song_length = ${metadata.songLengthMs || 180000}
diff_guitar = ${metadata.diffGuitar !== undefined ? metadata.diffGuitar : 3}
diff_bass = ${metadata.diffBass !== undefined ? metadata.diffBass : 2}
diff_drums = ${metadata.diffDrums !== undefined ? metadata.diffDrums : 3}
diff_keys = ${metadata.diffKeys !== undefined ? metadata.diffKeys : 4}
diff_rhythm = ${metadata.diffRhythm !== undefined ? metadata.diffRhythm : 2}
diff_vocals = ${metadata.diffVocals !== undefined ? metadata.diffVocals : 3}
preview_start_time = ${metadata.previewStartMs || 45000}
icon = midi-ch-pro
loading_phrase = Charted automatically with MIDI-CH Studio Pro (Enhanced based on EFHIII midi-ch)
`;
    }

    /**
     * Generates an album art image using HTML5 Canvas if no image is uploaded
     */
    function generatePlaceholderAlbumArt(title, artist) {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 512;
        const ctx = c.getContext('2d');

        // Dark gradient background
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(0.5, '#1e1b4b');
        grad.addColorStop(1, '#090d16');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        // Neon fret lines
        const colors = ['#00e676', '#ff1744', '#ffea00', '#2979ff', '#ff9100'];
        colors.forEach((col, idx) => {
            ctx.beginPath();
            ctx.strokeStyle = col;
            ctx.lineWidth = 4;
            ctx.moveTo(60 + idx * 75, 40);
            ctx.lineTo(100 + idx * 75, 460);
            ctx.stroke();
        });

        // Center card
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.fillRect(50, 180, 412, 160);
        ctx.strokeRect(50, 180, 412, 160);

        // Title and Artist
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title || 'Song Name', 256, 240);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillText(artist || 'Artist Name', 256, 275);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText('MIDI-CH STUDIO PRO', 256, 310);

        return new Promise(resolve => {
            c.toBlob(blob => resolve(blob), 'image/png');
        });
    }

    /**
     * Packages the complete song folder as a ZIP file ready for Clone Hero / YARG
     */
    async function packageToZip(chartText, songIniText, audioFiles = {}, albumArtBlob = null, metadata = {}) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library is not loaded. Cannot export zip.');
        }

        const zip = new JSZip();
        const folderName = `${metadata.artist || 'Artist'} - ${metadata.name || 'Song'}`;
        const folder = zip.folder(folderName);

        // 1. notes.chart
        folder.file('notes.chart', chartText);

        // 2. song.ini
        folder.file('song.ini', songIniText);

        // 3. album.png
        if (albumArtBlob) {
            folder.file('album.png', albumArtBlob);
        } else {
            const defaultArt = await generatePlaceholderAlbumArt(metadata.name, metadata.artist);
            folder.file('album.png', defaultArt);
        }

        // 4. Audio files / Stems
        for (let stemKey in audioFiles) {
            const file = audioFiles[stemKey];
            if (file) {
                let filename = 'song.ogg';
                if (stemKey === 'guitar') filename = 'guitar.ogg';
                else if (stemKey === 'bass') filename = 'bass.ogg';
                else if (stemKey === 'drums') filename = 'drums.ogg';
                else if (stemKey === 'vocals') filename = 'vocals.ogg';
                else if (stemKey === 'keys') filename = 'keys.ogg';
                else if (stemKey === 'song') filename = 'song.ogg';

                // If original file extension is mp3 or wav, preserve or save as is
                if (file.name && (file.name.endsWith('.mp3') || file.name.endsWith('.wav'))) {
                    filename = filename.replace('.ogg', file.name.substring(file.name.lastIndexOf('.')));
                }

                folder.file(filename, file);
            }
        }

        // 5. README Credits
        const readmeText = `=====================================================
${metadata.name || 'Song'} - Charted for Clone Hero & YARG
=====================================================
Artist: ${metadata.artist || 'Unknown'}
Album: ${metadata.album || 'Unknown'}
Charter: ${metadata.charter || 'EFHIII & Antigravity (MIDI-CH Studio Pro)'}

INSTRUCCIONES DE INSTALACIÓN:
1. Copia esta carpeta completa a tu directorio de canciones de Clone Hero o YARG:
   - Clone Hero: Documentos/Clone Hero/Songs/
   - YARG: Documentos/YARG/Songs/
2. Abre el juego y selecciona "Settings > Scan Songs" (Buscar canciones).
3. ¡A jugar!

CRÉDITOS Y AGRADECIMIENTOS:
- Basado en el concepto original de MIDI-CH por EFHIII (Saffron Haas):
  https://github.com/EFHIII/midi-ch
- Mejorado y expandido por MIDI-CH Studio Pro:
  Soporte multi-instrumento (Guitarra, Bajo, Batería, Teclas, Voz),
  alineador automático de letras, previsualizador Highway 3D interactivo
  y generador de paquetes song.ini integrados.
`;
        folder.file('README_CREDITS.txt', readmeText);

        // Generate Zip Blob
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        return {
            blob: zipBlob,
            filename: `${folderName} (Clone Hero).zip`
        };
    }

    /**
     * Browser helper to trigger file download
     */
    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return {
        generateChartString,
        generateSongIni,
        generatePlaceholderAlbumArt,
        packageToZip,
        triggerDownload,
        TRACK_HEADER_MAP
    };
}));
