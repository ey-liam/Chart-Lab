package com.chartlab.engine;

import com.chartlab.model.ChartNote;
import com.chartlab.parser.MidiReader;
import java.util.*;

public class ChartBuilder {
    public static List<ChartNote> buildFrettedTrack(List<MidiReader.RawMidiNote> notes, int resolution, int maxFrets) {
        List<ChartNote> result = new ArrayList<>();
        if (notes == null || notes.isEmpty()) return result;

        int minPitch = Integer.MAX_VALUE;
        int maxPitch = Integer.MIN_VALUE;
        for (MidiReader.RawMidiNote n : notes) {
            if (n.pitch < minPitch) minPitch = n.pitch;
            if (n.pitch > maxPitch) maxPitch = n.pitch;
        }
        int pitchRange = Math.max(1, maxPitch - minPitch);

        for (MidiReader.RawMidiNote n : notes) {
            int fret = Math.round(((float)(n.pitch - minPitch) / pitchRange) * (maxFrets - 1));
            fret = Math.max(0, Math.min(maxFrets - 1, fret));
            long sustain = n.durationTicks > resolution * 0.4 ? n.durationTicks - resolution / 8 : 0;
            result.add(new ChartNote(n.tick, fret, sustain));
        }

        result.sort(Comparator.comparingLong(ChartNote::getTick));
        return result;
    }
}
