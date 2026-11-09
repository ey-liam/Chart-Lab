package com.chartlab;

import com.chartlab.engine.ChartBuilder;
import com.chartlab.model.ChartNote;
import com.chartlab.model.ChartSong;
import com.chartlab.parser.MidiReader;

import java.io.File;
import java.io.FileWriter;
import java.util.List;

public class Main {

    private static void generateFourDifficulties(
            ChartSong song,
            String instrumentSuffix,
            List<MidiReader.RawMidiNote> notes,
            int res) {

        song.trackSections.put("Expert" + instrumentSuffix,
                ChartBuilder.buildFrettedTrack(notes, res, 5, 3, 16));
        song.trackSections.put("Hard" + instrumentSuffix,
                ChartBuilder.buildFrettedTrack(notes, res, 5, 2, 8));
        song.trackSections.put("Medium" + instrumentSuffix,
                ChartBuilder.buildFrettedTrack(notes, res, 4, 2, 4));
        song.trackSections.put("Easy" + instrumentSuffix,
                ChartBuilder.buildFrettedTrack(notes, res, 3, 1, 2));
    }

    public static void main(String[] args) {
        if (args.length == 0) {
            System.out.println("Chart-Lab Java Core CLI");
            System.out.println("Uso: java -jar chart-lab-core.jar <archivo.mid> [directorio-salida]");
            return;
        }

        try {
            File midiFile = new File(args[0]);
            String outDir = args.length > 1 ? args[1] : "./output";

            MidiReader.ParsedMidi midi = MidiReader.parse(midiFile);
            ChartSong song = new ChartSong();
            song.name = midiFile.getName().replaceFirst("[.][^.]+$", "").replace("_", " ");
            song.resolution = midi.resolution;
            song.syncTrack = midi.syncEvents;
            song.events.add("  0 = E \"section Intro\"");

            for (MidiReader.TrackInfo trk : midi.tracks) {
                if (trk.notes.isEmpty()) continue;
                String name = trk.name.toLowerCase();

                if (name.contains("drum") || name.contains("perc")) {
                    song.trackSections.put("ExpertDrums",
                            ChartBuilder.buildProDrumsTrack(trk.notes, midi.resolution, true));
                } else if (name.contains("bass")) {
                    generateFourDifficulties(song, "DoubleBass", trk.notes, midi.resolution);
                } else if (name.contains("rhythm")) {
                    generateFourDifficulties(song, "DoubleRhythm", trk.notes, midi.resolution);
                } else if (name.contains("key") || name.contains("piano") || name.contains("synth")) {
                    generateFourDifficulties(song, "Keyboard", trk.notes, midi.resolution);
                } else if (!song.trackSections.containsKey("ExpertSingle")) {
                    generateFourDifficulties(song, "Single", trk.notes, midi.resolution);
                }
            }

            File outFolder = new File(outDir, song.name);
            outFolder.mkdirs();
            File chartOut = new File(outFolder, "notes.chart");

            try (FileWriter fw = new FileWriter(chartOut)) {
                fw.write(song.toChartString());
            }

            System.out.println("Chart generado en: " + chartOut.getAbsolutePath());
        } catch (Exception e) {
            System.err.println("Error al procesar el archivo MIDI: " + e.getMessage());
        }
    }
}