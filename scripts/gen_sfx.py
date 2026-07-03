# -*- coding: utf-8 -*-
"""누락 SFX 4종(levelup, pickup, quiz_correct, quiz_wrong) 8-bit 스타일 합성.

외부 라이브러리 없이 stdlib wave 모듈로 생성. 출력: public/assets/audio/*.wav
사용: python scripts/gen_sfx.py
"""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

OUT_DIR = Path(__file__).parent.parent / "public" / "assets" / "audio"
SR = 44100


def square(freq: float, t: float, duty: float = 0.5) -> float:
    """8-bit 느낌의 사각파."""
    phase = (t * freq) % 1.0
    return 1.0 if phase < duty else -1.0


def render(notes: list[tuple[float, float, float]], vol: float = 0.35,
           decay: float = 6.0) -> list[float]:
    """(주파수, 시작초, 길이초) 노트들을 합성. 노트별 지수 감쇠 엔벨로프."""
    total = max(s + d for _, s, d in notes) + 0.05
    n = int(total * SR)
    buf = [0.0] * n
    for freq, start, dur in notes:
        i0 = int(start * SR)
        i1 = min(n, int((start + dur) * SR))
        for i in range(i0, i1):
            t = (i - i0) / SR
            env = math.exp(-decay * t / dur)
            buf[i] += square(freq, i / SR) * env
    peak = max(1e-9, max(abs(v) for v in buf))
    return [v / peak * vol for v in buf]


def write_wav(name: str, samples: list[float]) -> None:
    path = OUT_DIR / name
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in samples
        )
        w.writeframes(frames)
    print(f"[OK] {path.name} ({len(samples) / SR:.2f}s)")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # levelup: 상승 아르페지오 C5-E5-G5-C6
    write_wav("levelup.wav", render([
        (523.25, 0.00, 0.10),
        (659.25, 0.08, 0.10),
        (783.99, 0.16, 0.10),
        (1046.5, 0.24, 0.22),
    ], vol=0.4, decay=4.0))

    # pickup: 짧은 블립 (E6→B6)
    write_wav("pickup.wav", render([
        (1318.5, 0.00, 0.045),
        (1975.5, 0.04, 0.07),
    ], vol=0.3, decay=5.0))

    # quiz_correct: 밝은 2음 딩동 (G5→C6, 여운)
    write_wav("quiz_correct.wav", render([
        (783.99, 0.00, 0.12),
        (1046.5, 0.10, 0.30),
    ], vol=0.4, decay=3.5))

    # quiz_wrong: 하강 버즈 (Eb4→A3, 둔탁)
    write_wav("quiz_wrong.wav", render([
        (311.13, 0.00, 0.16),
        (220.00, 0.14, 0.28),
    ], vol=0.4, decay=3.0))


if __name__ == "__main__":
    main()
