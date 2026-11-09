"""
Chart-Lab - Lyrics Phonetic Syllable Aligner
Auto-aligns text lyrics to vocal melody notes for Clone Hero & YARG.
"""

import re
from typing import List, Dict, Any

def syllabify_word(word: str) -> List[str]:
    if not word or len(word) <= 3 or '-' in word:
        return word.split('-') if '-' in word else [word]

    vowels = "aeiouyáéíóúü"
    indices = [i for i, c in enumerate(word.lower()) if c in vowels]
    if len(indices) <= 1:
        return [word]

    syllables = []
    last_idx = 0
    for i in range(len(indices) - 1):
        v1, v2 = indices[i], indices[i+1]
        consonants = v2 - v1 - 1
        split_at = v1 + 1 if consonants <= 1 else v1 + 1 + consonants // 2
        syllables.append(word[last_idx:split_at])
        last_idx = split_at
    syllables.append(word[last_idx:])
    return syllables

def parse_text_lyrics(raw_text: str) -> List[Dict[str, Any]]:
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    result = []
    for line_idx, line in enumerate(lines):
        words = line.split()
        for w_idx, w in enumerate(words):
            is_end_of_line = (w_idx == len(words) - 1)
            sylls = syllabify_word(w)
            for s_idx, s in enumerate(sylls):
                is_last = (s_idx == len(sylls) - 1)
                text = (s + ' ') if is_last else (s + '-')
                result.append({
                    'text': text,
                    'is_end_line': is_last and is_end_of_line,
                    'line': line_idx
                })
    return result

def align_lyrics(syllables: List[Dict[str, Any]], vocal_notes: List[Any], ppq: int) -> List[Tuple[int, str]]:
    if not syllables or not vocal_notes:
        return []

    sorted_notes = sorted(vocal_notes, key=lambda n: n.tick)
    pause_threshold = int(ppq * 1.75)
    events = []
    in_phrase = False

    for i, note in enumerate(sorted_notes):
        if i >= len(syllables):
            break
        syl = syllables[i]
        prev_n = sorted_notes[i-1] if i > 0 else None
        next_n = sorted_notes[i+1] if i + 1 < len(sorted_notes) else None

        is_long_rest = prev_n and (note.tick - (prev_n.tick + prev_n.duration_ticks)) >= pause_threshold
        if not in_phrase or is_long_rest:
            if in_phrase and prev_n:
                events.append((prev_n.tick + prev_n.duration_ticks, 'phrase_end'))
            events.append((note.tick, 'phrase_start'))
            in_phrase = True

        events.append((note.tick, f"lyric {syl['text']}"))

        if syl['is_end_line'] or (next_n and (next_n.tick - (note.tick + note.duration_ticks)) >= pause_threshold):
            events.append((note.tick + note.duration_ticks, 'phrase_end'))
            in_phrase = False

    return sorted(events, key=lambda e: e[0])
