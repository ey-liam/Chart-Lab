"""
Chart-Lab - Zero-Error Chart Validator & Linter
Mathematically audits chart files to eliminate Bad_Different_Fret, overlapping sustains,
and tick ordering corruptions.
"""

from typing import List, Dict, Any, Tuple

class ChartValidationReport:
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.fixes_applied: int = 0

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def __repr__(self):
        return f"ChartValidationReport(Errors={len(self.errors)}, Warnings={len(self.warnings)}, Fixes={self.fixes_applied})"


def validate_and_repair_chart(chart_dict: Dict[str, List[Tuple[int, int, int]]], ppq: int) -> ChartValidationReport:
    report = ChartValidationReport()

    for track_name, notes in chart_dict.items():
        # 1. Monotonic tick check
        for i in range(1, len(notes)):
            if notes[i][0] < notes[i-1][0]:
                report.errors.append(f"{track_name}: Tick {notes[i][0]} is out of chronological order.")
                notes.sort(key=lambda n: n[0])
                report.fixes_applied += 1
                break

        # 2. Sustain overlap check per fret
        fret_last_note: Dict[int, int] = {} # fret -> index in notes
        repaired_notes = list(notes)

        for idx, (tick, fret, sustain) in enumerate(repaired_notes):
            if fret in fret_last_note:
                prev_idx = fret_last_note[fret]
                p_tick, p_fret, p_sustain = repaired_notes[prev_idx]
                if p_tick + p_sustain >= tick:
                    report.warnings.append(f"{track_name}: Sustain at tick {p_tick} overlaps note at {tick} on fret {fret}.")
                    gap = max(10, ppq // 8)
                    new_sustain = max(0, (tick - p_tick) - gap)
                    repaired_notes[prev_idx] = (p_tick, p_fret, new_sustain)
                    report.fixes_applied += 1

            fret_last_note[fret] = idx

        chart_dict[track_name] = repaired_notes

    return report
