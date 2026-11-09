/**
 * Chart-Lab - Zero-Error Chart Validator for Web Studio
 * Performs mathematical validation on all charts to prevent game crashes,
 * overlapping sustains, and fret misalignments.
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

        for (let inst in allCharts) {
            for (let diff in allCharts[inst]) {
                const trackName = `${diff}${inst}`;
                const notes = allCharts[inst][diff];
                if (!notes || notes.length === 0) continue;

                // 1. Check tick monotonicity
                let sorted = true;
                for (let i = 1; i < notes.length; i++) {
                    if (notes[i].tick < notes[i - 1].tick) {
                        sorted = false;
                        report.errors.push(`${trackName}: Nota en tick ${notes[i].tick} está desordenada.`);
                        break;
                    }
                }
                if (!sorted) {
                    notes.sort((a, b) => a.tick - b.tick);
                    report.fixesApplied++;
                }

                // 2. Check sustain overlap per fret
                const lastFretNote = {};
                const gapTicks = Math.max(10, Math.round(ppq / 8));

                for (let i = 0; i < notes.length; i++) {
                    const n = notes[i];
                    const f = n.fret;

                    if (lastFretNote[f] !== undefined) {
                        const prev = lastFretNote[f];
                        if (prev.sustain && (prev.tick + prev.sustain) >= n.tick) {
                            report.warnings.push(`${trackName}: Sustain en tick ${prev.tick} colisionaba con nota en ${n.tick} (traste ${f}).`);
                            prev.sustain = Math.max(0, (n.tick - prev.tick) - gapTicks);
                            report.fixesApplied++;
                        }
                    }

                    // Bounds check
                    if (n.fret < 0 || (n.fret > 4 && n.fret !== 7 && n.fret !== 64 && n.fret !== 65 && n.fret !== 66)) {
                        report.errors.push(`${trackName}: Traste inválido ${n.fret} en tick ${n.tick}.`);
                        n.fret = Math.max(0, Math.min(4, n.fret));
                        report.fixesApplied++;
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
