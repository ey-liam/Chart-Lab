package com.chartlab;

import com.chartlab.engine.ChartBuilder;
import com.chartlab.model.ChartNote;
import com.chartlab.model.ChartSong;
import com.chartlab.parser.MidiReader;

import java.io.File;
import java.io.FileWriter;
import java.util.List;

public class Main {
    public static void main(String[] args) {
        if (args.length == 0) {
            System.out.println("Chart-Lab Java Core CLI");
            System.out.println("Usage: java -jar chart-lab-core.jar <midi-file> [output-dir]");
            return;
        }

        try {
            File midiFile = new File(args[0]);
            String outDir = args.length > 1 ? args[1] : "./output";
            System.out.println("[Java] Parsing: " + midiFile.getName());

            MidiReader.ParsedMidi midi = MidiReader.parse(midiFile);
            ChartSong song = new ChartSong();
            song.name = midiFile.getName().replace(".mid", "").replace("_", " ");
            song.resolution = midi.resolution;
            song.syncTrack = midi.syncEvents;
            song.events.add("  0 = E \"section Intro\"");

            for (MidiReader.TrackInfo trk : midi.tracks) {
                if (trk.notes.isEmpty()) continue;
                String trackLower = trk.name.toLowerCase();

                if (trackLower.contains("guitar") || trackLower.contains("lead")) {
                    List<ChartNote> expert = ChartBuilder.buildFrettedTrack(trk.notes, midi.resolution, 5);
                    song.trackSections.put("ExpertSingle", expert);
                    song.trackSections.put("HardSingle", ChartBuilder.buildFrettedTrack(trk.notes, midi.resolution, 4));
                } else if (trackLower.contains("bass")) {
                    song.trackSections.put("ExpertDoubleBass", ChartBuilder.buildFrettedTrack(trk.notes, midi.resolution, 5));
                } else if (trackLower.contains("key") || trackLower.contains("piano")) {
                    song.trackSections.put("ExpertKeyboard", ChartBuilder.buildFrettedTrack(trk.notes, midi.resolution, 5));
                }
            }

            File outFolder = new File(outDir, song.name);
            outFolder.mkdirs();
            File chartOut = new File(outFolder, "notes.chart");

            try (FileWriter fw = new FileWriter(chartOut)) {
                fw.write(song.toChartString());
            }

            System.out.println("[Java] Chart generated successfully at: " + chartOut.getAbsolutePath());

        } catch (Exception e) {
            System.err.println("Error processing MIDI: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
