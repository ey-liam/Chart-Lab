/**
 * Chart-Lab - Auditor y Reparador Automatico de Charts
 * Autor: Ey-Liam
 */
class ChartValidator {
    static validateAndRepair(generatedCharts, resolution = 480) {
        let fixesApplied = 0;
        const warnings = [];
        const minGapTicks = Math.max(1, Math.round(resolution / 12));

        Object.entries(generatedCharts).forEach(([instKey, diffsObj]) => {
            Object.entries(diffsObj).forEach(([diffName, trackData]) => {
                if (!trackData || !Array.isArray(trackData.notes)) return;

                // 1. Ordenar estrictamente por tick y luego por traste
                trackData.notes.sort((a, b) => a.tick - b.tick || a.fret - b.fret);

                // 2. Eliminar notas duplicadas en el mismo tick y traste
                const deduped = [];
                const seenKeys = new Set();
                trackData.notes.forEach(n => {
                    const k = `${n.tick}:${n.rawChartFret !== undefined ? n.rawChartFret : n.fret}`;
                    if (seenKeys.has(k)) {
                        fixesApplied++;
                    } else {
                        seenKeys.add(k);
                        deduped.push(n);
                    }
                });

                // 3. Recortar sustains que colisionan con la siguiente nota del mismo carril
                const lastByFret = new Map();
                deduped.forEach(n => {
                    if (lastByFret.has(n.fret)) {
                        const prev = lastByFret.get(n.fret);
                        if (prev.sustainTicks > 0 && (prev.tick + prev.sustainTicks + minGapTicks > n.tick)) {
                            prev.sustainTicks = Math.max(0, n.tick - prev.tick - minGapTicks);
                            fixesApplied++;
                        }
                    }
                    lastByFret.set(n.fret, n);
                });

                trackData.notes = deduped;
            });
        });

        if (fixesApplied > 0) {
            warnings.push(`Se corrigieron automaticamente ${fixesApplied} colisiones o sustains solapados.`);
        }

        return {
            fixesApplied,
            warningsCount: warnings.length,
            messages: warnings
        };
    }
}

window.ChartValidator = ChartValidator;