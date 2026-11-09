package com.chartlab.engine;

import com.chartlab.model.ChartNote;
import com.chartlab.parser.MidiReader;
import java.util.*;

public class ChartBuilder {

    public static List<ChartNote> buildFrettedTrack(
            List<MidiReader.RawMidiNote> rawNotes,
            int resolution,
            int maxFrets,
            int maxChordSize,
            int quantizeDivisor) {

        List<ChartNote> output = new ArrayList<>();
        if (rawNotes == null || rawNotes.isEmpty()) return output;

        // Agrupar notas por tick cuantizado
        long grid = Math.max(1, resolution / quantizeDivisor);
        TreeMap<Long, List<MidiReader.RawMidiNote>> grouped = new TreeMap<>();
        for (MidiReader.RawMidiNote n : rawNotes) {
            long qTick = Math.round((double) n.tick / grid) * grid;
            grouped.computeIfAbsent(qTick, k -> new ArrayList<>()).add(n);
        }

        List<Long> ticks = new ArrayList<>(grouped.keySet());
        long sustainGapTicks = Math.max(1, resolution / 6); // Margen de ~70ms

        int prevPitch = -1;
        int prevFret = 1;

        for (int i = 0; i < ticks.size(); i++) {
            long tick = ticks.get(i);
            long nextTick = (i + 1 < ticks.size()) ? ticks.get(i + 1) : Long.MAX_VALUE;

            List<MidiReader.RawMidiNote> chord = grouped.get(tick);
            chord.sort(Comparator.comparingInt(a -> a.pitch));

            // Calcular ventana local de +-16 eventos para posicionar la mano naturalmente
            int winStart = Math.max(0, i - 8);
            int winEnd = Math.min(ticks.size() - 1, i + 8);
            int localMin = Integer.MAX_VALUE;
            int localMax = Integer.MIN_VALUE;
            for (int w = winStart; w <= winEnd; w++) {
                for (MidiReader.RawMidiNote wn : grouped.get(ticks.get(w))) {
                    if (wn.pitch < localMin) localMin = wn.pitch;
                    if (wn.pitch > localMax) localMax = wn.pitch;
                }
            }
            int span = Math.max(4, localMax - localMin);

            int notesToEmit = Math.min(maxChordSize, Math.min(maxFrets, chord.size()));
            Set<Integer> usedFrets = new HashSet<>();

            for (int c = 0; c < notesToEmit; c++) {
                MidiReader.RawMidiNote note = chord.get(c);
                int targetFret = Math.round(((float) (note.pitch - localMin) / span) * (maxFrets - 1));

                // Conservar dirección melódica respecto a la nota anterior
                if (c == 0 && prevPitch != -1) {
                    if (note.pitch > prevPitch && targetFret < prevFret) {
                        targetFret = Math.min(maxFrets - 1, prevFret + 1);
                    } else if (note.pitch < prevPitch && targetFret > prevFret) {
                        targetFret = Math.max(0, prevFret - 1);
                    }
                }

                targetFret = Math.max(0, Math.min(maxFrets - 1, targetFret));
                while (usedFrets.contains(targetFret)) {
                    targetFret = (targetFret + 1) % maxFrets;
                }
                usedFrets.add(targetFret);

                long maxAllowedSustain = Math.max(0, (nextTick - tick) - sustainGapTicks);
                long rawSustain = note.durationTicks >= (resolution / 2) ? note.durationTicks : 0;
                long finalSustain = Math.min(rawSustain, maxAllowedSustain);

                output.add(new ChartNote(tick, targetFret, finalSustain));

                if (c == 0) {
                    prevPitch = note.pitch;
                    prevFret = targetFret;
                }
            }
        }

        output.sort(Comparator.comparingLong(ChartNote::getTick).thenComparingInt(ChartNote::getFret));
        return output;
    }

    public static List<ChartNote> buildProDrumsTrack(List<MidiReader.RawMidiNote> rawNotes, int resolution, boolean doubleKick) {
        List<ChartNote> output = new ArrayList<>();
        if (rawNotes == null || rawNotes.isEmpty()) return output;

        Set<String> seen = new HashSet<>();
        for (MidiReader.RawMidiNote n : rawNotes) {
            int lane;
            int cymbalFlag = -1;

            switch (n.pitch) {
                case 35:
                case 36:
                    lane = (doubleKick && n.pitch == 35) ? 32 : 0; // Kick / Expert+ Double Kick
                    break;
                case 38:
                case 40:
                    lane = 1; // Snare (Red)
                    break;
                case 42:
                case 44:
                case 46:
                    lane = 2; // Hi-Hat (Yellow Cymbal)
                    cymbalFlag = 66;
                    break;
                case 48:
                case 50:
                    lane = 2; // High Tom (Yellow Pad)
                    break;
                case 51:
                case 53:
                case 59:
                    lane = 3; // Ride (Blue Cymbal)
                    cymbalFlag = 67;
                    break;
                case 45:
                case 47:
                    lane = 3; // Mid Tom (Blue Pad)
                    break;
                case 49:
                case 52:
                case 55:
                case 57:
                    lane = 4; // Crash (Green Cymbal)
                    cymbalFlag = 68;
                    break;
                default:
                    lane = 4; // Floor Tom (Green Pad)
                    break;
            }

            String key = n.tick + ":" + lane;
            if (seen.add(key)) {
                output.add(new ChartNote(n.tick, lane, 0));
                if (cymbalFlag != -1) {
                    output.add(new ChartNote(n.tick, cymbalFlag, 0));
                }
            }
        }

        output.sort(Comparator.comparingLong(ChartNote::getTick).thenComparingInt(ChartNote::getFret));
        return output;
    }
}