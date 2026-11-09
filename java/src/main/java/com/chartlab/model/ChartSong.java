package com.chartlab.model;

import java.util.*;

public class ChartSong {
    public String name = "Untitled";
    public String artist = "Unknown Artist";
    public String album = "Unknown Album";
    public String year = "2024";
    public String charter = "Chart-Lab Team & EFHIII";
    public int resolution = 480;
    public float offset = 0.0f;

    public List<String> syncTrack = new ArrayList<>();
    public List<String> events = new ArrayList<>();
    public Map<String, List<ChartNote>> trackSections = new LinkedHashMap<>();

    public String toChartString() {
        StringBuilder sb = new StringBuilder();
        sb.append("[Song]\n{\n");
        sb.append("  Name = \"").append(name).append("\"\n");
        sb.append("  Artist = \"").append(artist).append("\"\n");
        sb.append("  Charter = \"").append(charter).append("\"\n");
        sb.append("  Album = \"").append(album).append("\"\n");
        sb.append("  Year = \", ").append(year).append("\"\n");
        sb.append("  Offset = ").append(String.format(Locale.US, "%.3f", offset)).append("\n");
        sb.append("  Resolution = ").append(resolution).append("\n");
        sb.append("  Player2 = \"bass\"\n");
        sb.append("  Difficulty = 0\n");
        sb.append("  PreviewStart = 45\n");
        sb.append("  PreviewEnd = 75\n");
        sb.append("  Genre = \"Rock\"\n");
        sb.append("  MediaType = \"cd\"\n");
        sb.append("  MusicStream = \"song.ogg\"\n");
        sb.append("}\n");

        sb.append("[SyncTrack]\n{\n");
        for (String s : syncTrack) sb.append(s).append("\n");
        sb.append("}\n");

        sb.append("[Events]\n{\n");
        for (String e : events) sb.append(e).append("\n");
        sb.append("}\n");

        for (Map.Entry<String, List<ChartNote>> entry : trackSections.entrySet()) {
            sb.append("[").append(entry.getKey()).append("]\n{\n");
            for (ChartNote n : entry.getValue()) {
                sb.append(n.toString()).append("\n");
            }
            sb.append("}\n");
        }

        return sb.toString();
    }
}
