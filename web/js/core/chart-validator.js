/**
 * Chart-Lab - Zero-Defect Chart Validator & Linter
 * Performs mathematical audits compliant with EnChor.us, Custom Songs Central (CSC),
 * and Clone Hero/YARG standards:
 * - Tick monotonicity
 * - 70ms sustain gap enforcement & overlap trimming
 * - Difficulty boundary enforcement (No Orange on Medium, No Blue/Orange on Easy, No Open on Hard/Med/Easy)
 * - Drum cymbal marker validation
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ChartValidator = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    function validateAndRepair(allCharts, ppq = 480) {
        const report = {
            errors: [],
            warnings: [],
            fixesApplied: 0,
            isValid: true
        };

        const sustainGapTicks = Math.max(10, Math.round(ppq * 0.14)); // ~70ms gap

        for (let inst in allCharts) {
            const isGHL = inst.includes('ghl');
            const isDrums = inst.includes('drum');
            const isDance = inst === 'dance';

            for (let diff in allCharts[inst]) {
                const trackName = `${diff}${inst}`;
                const notes = allCharts[inst][diff];
                if (!notes || notes.length === 0) continue;

                // 1. Check tick monotonicity
                let sorted = true;
                for (let i = 1; i < notes.length; i++) {
                    if (notes[i].tick < notes[i - 1].tick) {
                        sorted = false;
                        report.errors.push(`${trackName}: Nota desordenada en tick ${notes[i].tick}.`);
                        break;
                    }
                }
                if (!sorted) {
                    notes.sort((a, b) => a.tick - b.tick);
                    report.fixesApplied++;
                }

                // 2. Difficulty Fret Boundaries (CSC & Wagsii rules)
                for (let i = 0; i < notes.length; i++) {
                    const n = notes[i];
                    if (isGHL) {
                        const validGhl = [0, 1, 2, 3, 4, 7, 8];
                        if (!validGhl.includes(n.fret)) {
                            n.fret = 1;
                            report.fixesApplied++;
                        }
                    } else if (isDrums) {
                        const validDrums = [0, 1, 2, 3, 4, 5, 64, 65, 66];
                        if (!validDrums.includes(n.fret)) {
                            n.fret = 1;
                            report.fixesApplied++;
                        }
                    } else if (isDance) {
                        if (n.fret < 0 || n.fret > 3) {
                            n.fret = Math.max(0, Math.min(3, n.fret));
                            report.fixesApplied++;
                        }
                    } else {
                        // Standard 5-lane fretted
                        if (diff === 'Easy') {
                            // No Open, No Blue (3), No Orange (4)
                            if (n.fret > 2 || n.fret === 7) {
                                n.fret = Math.min(2, n.fret === 7 ? 0 : n.fret);
                                report.fixesApplied++;
                            }
                        } else if (diff === 'Medium') {
                            // No Open, No Orange (4)
                            if (n.fret > 3 || n.fret === 7) {
                                n.fret = Math.min(3, n.fret === 7 ? 0 : n.fret);
                                report.fixesApplied++;
                            }
                        } else if (diff === 'Hard') {
                            // No Open
                            if (n.fret === 7) {
                                n.fret = 0;
                                report.fixesApplied++;
                            }
                        }
                    }
                }

                // 3. Sustain Overlap & 70ms Gap
                const lastFretNote = {};
                for (let i = 0; i < notes.length; i++) {
                    const n = notes[i];
                    const f = n.fret;

                    if (lastFretNote[f] !== undefined) {
                        const prev = lastFretNote[f];
                        if (prev.sustain && (prev.tick + prev.sustain) >= n.tick) {
                            prev.sustain = Math.max(0, (n.tick - prev.tick) - sustainGapTicks);
                            report.fixesApplied++;
                        }
                    }

                    lastFretNote[f] = n;
                }
            }
        }

        report.isValid = report.errors.length === 0;
        return report;
    }

    return {
        validateAndRepair
    };
}));
