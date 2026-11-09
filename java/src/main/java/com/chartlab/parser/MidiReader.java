package com.chartlab.parser;

import javax.sound.midi.*;
import java.io.File;
import java.util.*;

public class MidiReader {
    public static class RawMidiNote {
        public int pitch;
        public int velocity;
        public long tick;
        public long durationTicks;

        public RawMidiNote(int pitch, int velocity, long tick, long durationTicks) {
            this.pitch = pitch;
            this.velocity = velocity;
            this.tick = tick;
            this.durationTicks = durationTicks;
        }
    }

    public static class TrackInfo {
        public int id;
        public String name = "";
        public boolean isPercussion = false;
        public List<RawMidiNote> notes = new ArrayList<>();
    }

    public static class ParsedMidi {
        public int resolution;
        public List<TrackInfo> tracks = new ArrayList<>();
        public List<String> syncEvents = new ArrayList<>();
    }

    public static ParsedMidi parse(File midiFile) throws Exception {
        Sequence seq = MidiSystem.getSequence(midiFile);
        ParsedMidi parsed = new ParsedMidi();
        parsed.resolution = seq.getResolution();

        parsed.syncEvents.add("  0 = TS 4");
        parsed.syncEvents.add("  0 = B 120000");

        Track[] tracks = seq.getTracks();
        for (int t = 0; t < tracks.length; t++) {
            Track track = tracks[t];
            TrackInfo info = new TrackInfo();
            info.id = t;
            info.name = "Track " + (t + 1);

            Map<Integer, Long> openNotes = new HashMap<>();

            for (int i = 0; i < track.size(); i++) {
                MidiEvent event = track.get(i);
                MidiMessage msg = event.getMessage();
                long tick = event.getTick();

                if (msg instanceof ShortMessage) {
                    ShortMessage sm = (ShortMessage) msg;
                    int command = sm.getCommand();
                    int chan = sm.getChannel();
                    if (chan == 9) info.isPercussion = true;

                    if (command == ShortMessage.NOTE_ON && sm.getData2() > 0) {
                        openNotes.put(sm.getData1(), tick);
                    } else if (command == ShortMessage.NOTE_OFF || (command == ShortMessage.NOTE_ON && sm.getData2() == 0)) {
                        if (openNotes.containsKey(sm.getData1())) {
                            long sTick = openNotes.remove(sm.getData1());
                            long dur = Math.max(1, tick - sTick);
                            info.notes.add(new RawMidiNote(sm.getData1(), sm.getData2(), sTick, dur));
                        }
                    }
                } else if (msg instanceof MetaMessage) {
                    MetaMessage mm = (MetaMessage) msg;
                    byte[] data = mm.getData();
                    if (mm.getType() == 0x03) {
                        info.name = new String(data).trim();
                    } else if (mm.getType() == 0x51 && data.length == 3) {
                        int us = ((data[0] & 0xFF) << 16) | ((data[1] & 0xFF) << 8) | (data[2] & 0xFF);
                        double bpm = 60000000.0 / us;
                        parsed.syncEvents.add("  " + tick + " = B " + Math.round(bpm * 1000));
                    }
                }
            }
            info.notes.sort(Comparator.comparingLong(n -> n.tick));
            parsed.tracks.add(info);
        }

        return parsed;
    }
}
