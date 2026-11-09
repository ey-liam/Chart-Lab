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
        root.ChartExporter = factory();
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
        guitarghl: {
            'Expert': 'ExpertGHLGuitar',
            'Hard': 'HardGHLGuitar',
            'Medium': 'MediumGHLGuitar',
            'Easy': 'EasyGHLGuitar'
        },
        bass: {
            'Expert': 'ExpertDoubleBass',
            'Hard': 'HardDoubleBass',
            'Medium': 'MediumDoubleBass',
            'Easy': 'EasyDoubleBass'
        },
        bassghl: {
            'Expert': 'ExpertGHLBass',
            'Hard': 'HardGHLBass',
            'Medium': 'MediumGHLBass',
            'Easy': 'EasyGHLBass'
        },
        rhythm: {
            'Expert': 'ExpertRhythm',
            'Hard': 'HardRhythm',
            'Medium': 'MediumRhythm',
            'Easy': 'EasyRhythm'
        },
        rhythmghl: {
            'Expert': 'ExpertGHLRhythm',
            'Hard': 'HardGHLRhythm',
            'Medium': 'MediumGHLRhythm',
            'Easy': 'EasyGHLRhythm'
        },
        guitar_coop: {
            'Expert': 'ExpertGuitarCoop',
            'Hard': 'HardGuitarCoop',
            'Medium': 'MediumGuitarCoop',
            'Easy': 'EasyGuitarCoop'
        },
        guitar_coop_ghl: {
            'Expert': 'ExpertGHLCoop',
            'Hard': 'HardGHLCoop',
            'Medium': 'MediumGHLCoop',
            'Easy': 'EasyGHLCoop'
        },
        keys: {
            'Expert': 'ExpertKeyboard',
            'Hard': 'HardKeyboard',
            'Medium': 'MediumKeyboard',
            'Easy': 'EasyKeyboard'
        },
        keys_real: {
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
        },
        drums_5lane: {
            'Expert': 'ExpertDoubleDrums',
            'Hard': 'HardDoubleDrums',
            'Medium': 'MediumDoubleDrums',
            'Easy': 'EasyDoubleDrums'
        },
        dance: {
            'Expert': 'ExpertDance',
            'Hard': 'HardDance',
            'Medium': 'MediumDance',
            'Easy': 'EasyDance'
        }
    };

    /**
     * Generates a fully formatted .chart file
     */
    function generateChartFile(midiData, allCharts, lyricEvents, metadata = {}) {
        const resolution = midiData.ppq || 480;
        const name = metadata.name || 'Untitled Song';
        const artist = metadata.artist || 'Unknown Artist';
        const charter = metadata.charter || 'Chart-Lab';
        const offset = metadata.offset || 0;

        let chart = '';

        // [Song] Header
        chart += '[Song]\n{\n';
        chart += `  Name = "${name}"\n`;
        chart += `  Artist = "${artist}"\n`;
        chart += `  Charter = "${charter}"\n`;
        chart += `  Offset = ${offset}\n`;
        chart += `  Resolution = ${resolution}\n`;
        chart += `  Player2 = bass\n`;
        chart += `  Difficulty = 0\n`;
        chart += `  PreviewStart = ${metadata.previewStartSec || 30}\n`;
        chart += `  PreviewEnd = ${(metadata.previewStartSec || 30) + 30}\n`;
        chart += `  Genre = "${metadata.genre || 'rock'}"\n`;
        chart += `  MediaType = "cd"\n`;

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

        // [Events] - Vocals and Sections
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
     * Generates official YARG / Clone Hero / Phase Shift song.ini
     * Supports every instrument, difficulty, tag, credit, and community link.
     */
    function generateSongIni(metadata = {}) {
        const name = metadata.name || 'Untitled Song';
        const artist = metadata.artist || 'Unknown Artist';
        const album = metadata.album || 'Unknown Album';
        const albumTrack = metadata.albumTrack !== undefined ? metadata.albumTrack : 1;
        const year = metadata.year || '2024';
        const genre = metadata.genre || 'Rock';
        const subGenre = metadata.subGenre || 'Alternative';
        const tags = metadata.tags || '';
        const location = metadata.location || '';
        const rating = metadata.rating !== undefined ? metadata.rating : 1;
        const songLength = metadata.songLengthMs || 180000;
        const icon = metadata.icon || 'chartlab';
        const playlist = metadata.playlist || '';
        const playlistTrack = metadata.playlistTrack !== undefined ? metadata.playlistTrack : 1;
        const partsVocalsHarm = metadata.partsVocalsHarm !== undefined ? metadata.partsVocalsHarm : 1;
        const modchart = metadata.modchart || 0;
        const previewStart = (metadata.previewStartSec !== undefined ? metadata.previewStartSec : 30) * 1000;
        const loadingPhrase = metadata.loadingPhrase || 'Charted with Chart-Lab Suite';
        const charter = metadata.charter || 'Chart-Lab';

        // Charters per instrument
        const charterGuitar = metadata.charterGuitar || charter;
        const charterProGuitar = metadata.charterProGuitar || charter;
        const charterRhythm = metadata.charterRhythm || charter;
        const charterBass = metadata.charterBass || charter;
        const charterProBass = metadata.charterProBass || charter;
        const charterDrums = metadata.charterDrums || charter;
        const charterKeys = metadata.charterKeys || charter;
        const charterProKeys = metadata.charterProKeys || charter;
        const charterVocals = metadata.charterVocals || charter;
        const charterLowerDiff = metadata.charterLowerDiff || charter;

        // Difficulties as pure integers
        const diffGuitar = parseInt(metadata.diffGuitar) || 3;
        const diffGuitarGhl = parseInt(metadata.diffGuitarGhl) || 0;
        const diffGuitarReal = parseInt(metadata.diffGuitarReal) || 0;
        const diffGuitarReal22 = parseInt(metadata.diffGuitarReal22) || 0;
        const diffGuitarCoop = parseInt(metadata.diffGuitarCoop) || 0;
        const diffGuitarCoopGhl = parseInt(metadata.diffGuitarCoopGhl) || 0;
        const diffRhythm = parseInt(metadata.diffRhythm) || 0;
        const diffRhythmGhl = parseInt(metadata.diffRhythmGhl) || 0;
        const diffBass = parseInt(metadata.diffBass) || 2;
        const diffBassGhl = parseInt(metadata.diffBassGhl) || 0;
        const diffBassReal = parseInt(metadata.diffBassReal) || 0;
        const diffBassReal22 = parseInt(metadata.diffBassReal22) || 0;
        const diffDrums = parseInt(metadata.diffDrums) || 3;
        const diffDrumsReal = parseInt(metadata.diffDrumsReal) || diffDrums;
        const diffEliteDrums = parseInt(metadata.diffEliteDrums) || 0;
        const diffKeys = parseInt(metadata.diffKeys) || 0;
        const diffKeysReal = parseInt(metadata.diffKeysReal) || 0;
        const diffVocals = parseInt(metadata.diffVocals) || 3;
        const diffVocalsHarm = parseInt(metadata.diffVocalsHarm) || 0;
        const diffDance = parseInt(metadata.diffDance) || 0;
        const diffBand = parseInt(metadata.diffBand) || Math.round((diffGuitar + diffBass + diffDrums + (diffKeys || diffGuitar)) / 4) || 2;

        // Engine flags
        const proDrums = metadata.proDrums !== false ? 'True' : 'False';
        const fiveLaneDrums = metadata.fiveLaneDrums ? 'True' : 'False';
        const vocalScrollSpeed = metadata.vocalScrollSpeed || 100;
        const videoStartTime = metadata.videoStartTime || 0;
        const endEvents = metadata.endEvents || 0;

        // Credits
        const creditAlbumArtBy = metadata.creditAlbumArtBy || '';
        const creditComposedBy = metadata.creditComposedBy || '';
        const creditEngineeredBy = metadata.creditEngineeredBy || '';
        const creditLicense = metadata.creditLicense || '';
        const creditMasteredBy = metadata.creditMasteredBy || '';
        const creditMixedBy = metadata.creditMixedBy || '';
        const creditPerformedBy = metadata.creditPerformedBy || '';
        const creditProducedBy = metadata.creditProducedBy || '';
        const creditPublishedBy = metadata.creditPublishedBy || '';
        const creditWrittenBy = metadata.creditWrittenBy || '';

        // Social / External Links
        const linkBandcamp = metadata.linkBandcamp || '';
        const linkBluesky = metadata.linkBluesky || '';
        const linkFacebook = metadata.linkFacebook || '';
        const linkInstagram = metadata.linkInstagram || '';
        const linkNewgrounds = metadata.linkNewgrounds || '';
        const linkSoundcloud = metadata.linkSoundcloud || '';
        const linkSpotify = metadata.linkSpotify || '';
        const linkTiktok = metadata.linkTiktok || '';
        const linkTwitter = metadata.linkTwitter || '';
        const linkYoutube = metadata.linkYoutube || '';
        const linkOther = metadata.linkOther || '';

        let ini = `[song]
name = ${name}
artist = ${artist}
album = ${album}
album_track = ${albumTrack}
year = ${year}
genre = ${genre}
sub_genre = ${subGenre}
tags = ${tags}
location = ${location}
rating = ${rating}
song_length = ${songLength}
icon = ${icon}
playlist = ${playlist}
playlist_track = ${playlistTrack}
parts_vocals_harm = ${partsVocalsHarm}
modchart = ${modchart}
preview_start_time = ${previewStart}
loading_phrase = ${loadingPhrase}
charter = ${charter}
charter_guitar = ${charterGuitar}
charter_pro_guitar = ${charterProGuitar}
charter_rhythm = ${charterRhythm}
charter_bass = ${charterBass}
charter_pro_bass = ${charterProBass}
charter_drums = ${charterDrums}
charter_keys = ${charterKeys}
charter_pro_keys = ${charterProKeys}
charter_vocals = ${charterVocals}
charter_lower_diff = ${charterLowerDiff}
`;

        if (creditAlbumArtBy) ini += `credit_album_art_by = ${creditAlbumArtBy}\n`;
        if (creditComposedBy) ini += `credit_composed_by = ${creditComposedBy}\n`;
        if (creditEngineeredBy) ini += `credit_engineered_by = ${creditEngineeredBy}\n`;
        if (creditLicense) ini += `credit_license = ${creditLicense}\n`;
        if (creditMasteredBy) ini += `credit_mastered_by = ${creditMasteredBy}\n`;
        if (creditMixedBy) ini += `credit_mixed_by = ${creditMixedBy}\n`;
        if (creditPerformedBy) ini += `credit_performed_by = ${creditPerformedBy}\n`;
        if (creditProducedBy) ini += `credit_produced_by = ${creditProducedBy}\n`;
        if (creditPublishedBy) ini += `credit_published_by = ${creditPublishedBy}\n`;
        if (creditWrittenBy) ini += `credit_written_by = ${creditWrittenBy}\n`;

        if (linkBandcamp) ini += `link_bandcamp = ${linkBandcamp}\n`;
        if (linkBluesky) ini += `link_bluesky = ${linkBluesky}\n`;
        if (linkFacebook) ini += `link_facebook = ${linkFacebook}\n`;
        if (linkInstagram) ini += `link_instagram = ${linkInstagram}\n`;
        if (linkNewgrounds) ini += `link_newgrounds = ${linkNewgrounds}\n`;
        if (linkSoundcloud) ini += `link_soundcloud = ${linkSoundcloud}\n`;
        if (linkSpotify) ini += `link_spotify = ${linkSpotify}\n`;
        if (linkTiktok) ini += `link_tiktok = ${linkTiktok}\n`;
        if (linkTwitter) ini += `link_twitter = ${linkTwitter}\n`;
        if (linkYoutube) ini += `link_youtube = ${linkYoutube}\n`;
        if (linkOther) ini += `link_other = ${linkOther}\n`;

        ini += `diff_band = ${diffBand}
diff_guitar = ${diffGuitar}
diff_guitarghl = ${diffGuitarGhl}
diff_guitar_real = ${diffGuitarReal}
diff_guitar_real_22 = ${diffGuitarReal22}
diff_guitar_coop = ${diffGuitarCoop}
diff_guitar_coop_ghl = ${diffGuitarCoopGhl}
diff_rhythm = ${diffRhythm}
diff_rhythm_ghl = ${diffRhythmGhl}
diff_bass = ${diffBass}
diff_bassghl = ${diffBassGhl}
diff_bass_real = ${diffBassReal}
diff_bass_real_22 = ${diffBassReal22}
diff_drums = ${diffDrums}
diff_drums_real = ${diffDrumsReal}
diff_elite_drums = ${diffEliteDrums}
diff_keys = ${diffKeys}
diff_keys_real = ${diffKeysReal}
diff_vocals = ${diffVocals}
diff_vocals_harm = ${diffVocalsHarm}
diff_dance = ${diffDance}
pro_drums = ${proDrums}
five_lane_drums = ${fiveLaneDrums}
vocal_scroll_speed = ${vocalScrollSpeed}
video_start_time = ${videoStartTime}
end_events = ${endEvents}

; --- Metadata & Credits ---
credit_arranged_by = Ey-Liam
credit_courtesy_of = EFHIII
credit_other = Ey-Liam & EFHIII
`;
        return ini;
    }

    /**
     * Generates placeholder album art
     */
    function generatePlaceholderAlbumArt(title, artist) {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 512;
        const ctx = c.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, 512, 512);
        grad.addColorStop(0, '#0a0e17');
        grad.addColorStop(0.5, '#131c2e');
        grad.addColorStop(1, '#080c14');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.strokeRect(16, 16, 480, 480);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title || 'Untitled', 256, 240);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '22px sans-serif';
        ctx.fillText(artist || 'Unknown Artist', 256, 280);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '14px monospace';
        ctx.fillText('CHART-LAB SUITE', 256, 460);

        return new Promise(resolve => c.toBlob(resolve, 'image/png'));
    }

    /**
     * Packages notes.chart, song.ini, album art and audio into a downloadable ZIP
     */
    async function packageZip(chartContent, iniContent, albumArtBlob, stems = {}) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library is required for packaging.');
        }

        const zip = new JSZip();
        zip.file('notes.chart', chartContent);
        zip.file('song.ini', iniContent);

        if (albumArtBlob) {
            zip.file('album.png', albumArtBlob);
        }

        for (let stemName in stems) {
            const blob = stems[stemName];
            if (blob) {
                zip.file(stemName, blob);
            }
        }

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        return zipBlob;
    }

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    return {
        TRACK_HEADER_MAP,
        generateChartFile,
        generateChartString: generateChartFile,
        generateSongIni,
        generatePlaceholderAlbumArt,
        packageZip,
        packageToZip: async (chart, ini, audio, art) => {
            const blob = await packageZip(chart, ini, art, audio);
            return { blob, filename: 'song_package.zip' };
        },
        triggerDownload
    };
}));
