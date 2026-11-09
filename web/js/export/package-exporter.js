/**
 * Chart-Lab - Clone Hero & YARG Package Exporter
 * Generates 100% compliant .chart, song.ini (matching official YARG standard),
 * and ready-to-play ZIP packages.
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.PackageExporter = factory();
        root.ChartExporter = factory(); // backwards compatibility
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

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
     * Generates clean .chart string
     */
    function generateChartString(midiData, allCharts, lyricEvents, metadata = {}) {
        const ppq = midiData.ppq || 480;
        const name = metadata.name || 'Untitled Song';
        const artist = metadata.artist || 'Unknown Artist';
        const album = metadata.album || 'Unknown Album';
        const year = metadata.year || '2024';
        const charter = metadata.charter || 'Chart-Lab';
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
        chart += `  Player2 = bass\n`;
        chart += `  Difficulty = ${metadata.diffGuitar || 2}\n`;
        chart += `  PreviewStart = ${metadata.previewStartSec || 30}\n`;
        chart += `  PreviewEnd = ${(metadata.previewStartSec || 30) + 30}\n`;
        chart += `  Genre = "${genre}"\n`;
        chart += `  MediaType = "cd"\n`;

        // Audio streams (matching Ariana Grande & YARG standard naming)
        if (metadata.hasGuitarStem) chart += `  GuitarStream = "Guitar.wav"\n`;
        if (metadata.hasBassStem) chart += `  BassStream = "Bass.wav"\n`;
        if (metadata.hasDrumsStem) chart += `  DrumStream = "Drums.wav"\n`;
        if (metadata.hasVocalsStem) chart += `  VocalStream = "Vocals.wav"\n`;
        if (metadata.hasKeysStem) chart += `  KeysStream = "Keys.wav"\n`;
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

        // [Events] - Vocals and Sections (based on Ariana Grande & Clone Hero standard)
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

                // Strictly sort lines by tick
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
     * Generates official YARG / Clone Hero song.ini
     * Difficulties are clean integers (1, 2, 3, etc.).
     * Hidden creator metadata is placed cleanly at the very bottom.
     */
    function generateSongIni(metadata = {}) {
        const name = metadata.name || 'Untitled Song';
        const artist = metadata.artist || 'Unknown Artist';
        const album = metadata.album || 'Unknown Album';
        const genre = metadata.genre || 'Rock';
        const year = metadata.year || '2024';
        const charter = metadata.charter || 'Chart-Lab';
        const songLength = metadata.songLengthMs || 180000;
        const previewStart = (metadata.previewStartSec || 30) * 1000;
        const previewEnd = previewStart + 30000;

        // Difficulties as pure integers 1, 2, 3, 4, 5, 6
        const diffGuitar = parseInt(metadata.diffGuitar) || 3;
        const diffBass = parseInt(metadata.diffBass) || 2;
        const diffDrums = parseInt(metadata.diffDrums) || 3;
        const diffKeys = parseInt(metadata.diffKeys) || 3;
        const diffRhythm = parseInt(metadata.diffRhythm) || 2;
        const diffVocals = parseInt(metadata.diffVocals) || 3;
        const diffBand = Math.round((diffGuitar + diffBass + diffDrums + diffKeys) / 4) || 2;

        return `[song]
name = ${name}
artist = ${artist}
album = ${album}
genre = ${genre}
year = ${year}
charter = ${charter}
version = 1.0
song_length = ${songLength}
preview_start_time = ${previewStart}
preview_end_time = ${previewEnd}
diff_band = ${diffBand}
diff_guitar = ${diffGuitar}
diff_rhythm = ${diffRhythm}
diff_bass = ${diffBass}
diff_drums = ${diffDrums}
diff_keys = ${diffKeys}
diff_guitarghl = 0
diff_bassghl = 0
diff_vocals = ${diffVocals}
parts_vocals_harm = 1
modchart = 0
icon = chartlab
loading_phrase = Charted with Chart-Lab Suite

; --- Metadata & Credits ---
credit_arranged_by = Ey-Liam
credit_courtesy_of = EFHIII
credit_other = Ey-Liam & EFHIII
`;
    }

    /**
     * Generates a sleek, professional album art placeholder
     */
    function generatePlaceholderAlbumArt(title, artist) {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 512;
        const ctx = c.getContext('2d');

        // Dark gradient background
        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0, '#0a0e17');
        grad.addColorStop(0.5, '#131c2e');
        grad.addColorStop(1, '#080c14');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        // Neon fret lines
        const colors = ['#00e676', '#ff1744', '#ffea00', '#2979ff', '#ff9100'];
        colors.forEach((col, idx) => {
            ctx.beginPath();
            ctx.strokeStyle = col;
            ctx.lineWidth = 3;
            ctx.moveTo(60 + idx * 75, 40);
            ctx.lineTo(90 + idx * 75, 470);
            ctx.stroke();
        });

        // Center card
        ctx.fillStyle = 'rgba(10, 14, 23, 0.9)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.fillRect(50, 180, 412, 160);
        ctx.strokeRect(50, 180, 412, 160);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title || 'Song Title', 256, 240);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText(artist || 'Artist Name', 256, 275);

        ctx.fillStyle = '#64748b';
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText('CHART-LAB SUITE', 256, 310);

        return new Promise(resolve => {
            c.toBlob(blob => resolve(blob), 'image/png');
        });
    }

    /**
     * Packages everything into ready-to-play ZIP
     */
    async function packageToZip(chartText, songIniText, audioFiles = {}, albumArtBlob = null, metadata = {}) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library is not loaded.');
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
                if (stemKey === 'guitar') filename = 'Guitar.wav';
                else if (stemKey === 'bass') filename = 'Bass.wav';
                else if (stemKey === 'drums') filename = 'Drums.wav';
                else if (stemKey === 'vocals') filename = 'Vocals.wav';
                else if (stemKey === 'keys') filename = 'Keys.wav';
                else if (stemKey === 'song') filename = 'song.ogg';

                if (file.name && (file.name.endsWith('.mp3') || file.name.endsWith('.ogg') || file.name.endsWith('.wav'))) {
                    const ext = file.name.substring(file.name.lastIndexOf('.'));
                    filename = filename.substring(0, filename.lastIndexOf('.')) + ext;
                }

                folder.file(filename, file);
            }
        }

        // Generate Zip
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
