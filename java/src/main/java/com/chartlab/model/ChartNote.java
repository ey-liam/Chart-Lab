package com.chartlab.model;

public class ChartNote {
    private long tick;
    private int fret;
    private long sustainTicks;

    public ChartNote(long tick, int fret, long sustainTicks) {
        this.tick = tick;
        this.fret = fret;
        this.sustainTicks = sustainTicks;
    }

    public long getTick() { return tick; }
    public int getFret() { return fret; }
    public long getSustainTicks() { return sustainTicks; }
    public void setSustainTicks(long sustainTicks) { this.sustainTicks = sustainTicks; }

    @Override
    public String toString() {
        return "  " + tick + " = N " + fret + " " + sustainTicks;
    }
}
