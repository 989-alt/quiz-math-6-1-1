# -*- coding: utf-8 -*-
"""몬스터 러시 이벤트용 오디오 2종 합성 (Task 7).

- rush_bgm.wav      : 급박한 8-bit 칩튠 루프 (~176 BPM, A단조 아르페지오 + 드라이브 퍼커션, 심리스 루프)
- rush_warning.wav  : 짧게 상승하는 사이렌/경보음 (~1s)

gen_sfx.py의 관례(stdlib wave 라이터, mono, 지수 감쇠 엔벨로프)를 따르되,
파형 합성은 numpy로 벡터화한다. 출력: public/assets/audio/*.wav
사용: PYTHONIOENCODING=utf-8 python scripts/gen_rush_audio.py

심리스 루프 원리: 모든 사운드 이벤트(아르페지오/베이스/드럼)를 pluck 엔벨로프
(빠른 attack → 스텝 안에서 ~0으로 감쇠)로 만들어 버퍼 양 끝이 자연스럽게 0에 가깝다.
추가로 양 끝 3ms 페이드로 zero-cross를 보장(클릭 제거).
"""
from __future__ import annotations

import wave
from pathlib import Path

import numpy as np

OUT_DIR = Path(__file__).parent.parent / "public" / "assets" / "audio"
SR = 22050  # mono 22050Hz — 파일 크기 절약(설계 허용)


# ---- 파형 헬퍼 (numpy 벡터화) ----
def _phase(freq: float, n: int) -> np.ndarray:
    return np.arange(n) * (freq / SR)


def square(freq: float, n: int, duty: float = 0.5) -> np.ndarray:
    ph = _phase(freq, n) % 1.0
    return np.where(ph < duty, 1.0, -1.0)


def saw(freq: float, n: int) -> np.ndarray:
    ph = _phase(freq, n) % 1.0
    return 2.0 * ph - 1.0


def sine(freq: float, n: int) -> np.ndarray:
    return np.sin(2.0 * np.pi * _phase(freq, n))


def pluck_env(n: int, decay: float = 18.0, attack_ms: float = 2.0) -> np.ndarray:
    """빠른 attack 후 지수 감쇠 → 스텝 안에서 ~0으로 떨어지는 pluck 엔벨로프."""
    t = np.arange(n) / SR
    env = np.exp(-decay * t)
    a = max(1, int(SR * attack_ms / 1000))
    if a < n:
        env[:a] *= np.linspace(0.0, 1.0, a)
    return env


def _add(buf: np.ndarray, start: int, sig: np.ndarray) -> None:
    end = min(len(buf), start + len(sig))
    if start < len(buf) and end > start:
        buf[start:end] += sig[: end - start]


def _edge_fade(buf: np.ndarray, ms: float = 3.0) -> np.ndarray:
    """양 끝 짧은 페이드 → 루프 이음매 zero-cross 보장."""
    a = max(1, int(SR * ms / 1000))
    if 2 * a < len(buf):
        buf[:a] *= np.linspace(0.0, 1.0, a)
        buf[-a:] *= np.linspace(1.0, 0.0, a)
    return buf


# ---- 드럼 합성 ----
def kick(n: int) -> np.ndarray:
    t = np.arange(n) / SR
    # 60Hz→40Hz 피치 드롭 + 빠른 감쇠
    fsweep = 90.0 * np.exp(-t * 30.0) + 42.0
    ph = np.cumsum(2.0 * np.pi * fsweep / SR)
    return np.sin(ph) * np.exp(-t * 22.0)


def hat(n: int) -> np.ndarray:
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    return rng.uniform(-1.0, 1.0, n) * np.exp(-t * 90.0)


def snare(n: int) -> np.ndarray:
    t = np.arange(n) / SR
    rng = np.random.default_rng(13)
    noise = rng.uniform(-1.0, 1.0, n) * np.exp(-t * 30.0)
    tone = np.sin(2.0 * np.pi * 190.0 * t) * np.exp(-t * 26.0)
    return 0.7 * noise + 0.4 * tone


# ---- rush_bgm ----
def build_rush_bgm() -> np.ndarray:
    bpm = 176.0
    step_dur = 60.0 / bpm / 4.0  # 16분음표 길이(초)
    steps = 112                  # 7마디 × 16스텝 = 9.55s (심리스: 16의 배수)
    step_n = int(round(step_dur * SR))
    total = steps * step_n
    buf = np.zeros(total, dtype=np.float64)

    # A단조 아르페지오 16스텝 패턴(Hz) — 상승/하강 반복으로 급박함
    A3, C4, E4, A4, B4, C5, E5 = 220.0, 261.63, 329.63, 440.0, 493.88, 523.25, 659.25
    arp = [A3, E4, A4, C5, E4, A4, C5, E5, A4, C5, E5, C5, A4, E4, C4, A3]
    # 마디별 베이스 루트(A단조 진행)
    bass_roots = [110.0, 110.0, 87.31, 98.0, 110.0, 87.31, 82.41]  # A2 A2 F2 G2 A2 F2 E2

    for s in range(steps):
        start = s * step_n
        step_in_bar = s % 16
        bar = s // 16

        # 아르페지오 (사각파 pluck)
        f = arp[step_in_bar]
        note = square(f, step_n, duty=0.45) * pluck_env(step_n, decay=16.0) * 0.34
        _add(buf, start, note)

        # 베이스 (매 박=4스텝, 낮은 사각파)
        if step_in_bar % 4 == 0:
            bf = bass_roots[bar % len(bass_roots)]
            bn = square(bf, step_n * 2, duty=0.5) * pluck_env(step_n * 2, decay=9.0) * 0.40
            _add(buf, start, bn)

        # 킥 (four-on-the-floor)
        if step_in_bar % 4 == 0:
            _add(buf, start, kick(step_n) * 0.9)
        # 스네어 (2,4박)
        if step_in_bar in (4, 12):
            _add(buf, start, snare(step_n) * 0.55)
        # 하이햇 (오프비트 8분)
        if step_in_bar % 2 == 1:
            _add(buf, start, hat(step_n) * 0.22)

    # 정규화 (헤드룸 확보 → 클리핑 방지)
    peak = float(np.max(np.abs(buf))) or 1.0
    buf = buf / peak * 0.82
    return _edge_fade(buf, ms=3.0)


# ---- rush_warning ----
def build_rush_warning() -> np.ndarray:
    dur = 1.0
    n = int(dur * SR)
    t = np.arange(n) / SR
    # 400Hz→1200Hz 상승 스윕 + 사이렌 와블(6Hz 트레몰로 느낌의 미세 비브라토)
    base = 400.0 + 800.0 * (t / dur)
    vib = 1.0 + 0.04 * np.sin(2.0 * np.pi * 6.0 * t)
    ph = np.cumsum(2.0 * np.pi * base * vib / SR)
    tone = 0.6 * np.sin(ph) + 0.4 * np.sign(np.sin(ph))  # 사인 + 사각 하모닉(경보 질감)
    # 진폭도 상승(긴박감) — 초반 조용 → 후반 강함
    amp = 0.35 + 0.6 * (t / dur)
    buf = tone * amp
    peak = float(np.max(np.abs(buf))) or 1.0
    buf = buf / peak * 0.85
    return _edge_fade(buf, ms=6.0)


# ---- WAV 라이터 (gen_sfx.py 스타일: struct + wave) ----
def write_wav(name: str, samples: np.ndarray) -> None:
    path = OUT_DIR / name
    clipped = np.clip(samples, -1.0, 1.0)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        ints = (clipped * 32767.0).astype("<i2")
        w.writeframes(ints.tobytes())
    print(f"[OK] {path.name} ({len(samples) / SR:.2f}s, {path.stat().st_size // 1024}KB)")


def verify(name: str, samples: np.ndarray, loop: bool) -> None:
    """파형 sanity 수치 검증: 비침묵 RMS / 무클리핑 / 이음매 zero-cross."""
    rms = float(np.sqrt(np.mean(samples ** 2)))
    peak = float(np.max(np.abs(samples)))
    head = float(np.max(np.abs(samples[:8])))   # 실제 시작 이음매 샘플
    tail = float(np.max(np.abs(samples[-8:])))   # 실제 끝 이음매 샘플
    seam = float(abs(samples[0] - samples[-1]))  # 끝→처음 연속성(클릭 = 큰 점프)
    assert rms > 0.05, f"{name}: RMS 너무 낮음(침묵) {rms:.4f}"
    assert peak < 0.99, f"{name}: 클리핑 {peak:.4f}"
    if loop:
        # 루프 이음매(끝→처음) 연속성: 양 끝 진폭이 0에 가깝고 점프가 작아야 클릭 없음
        assert head < 0.02 and tail < 0.02, f"{name}: 이음매 진폭 과대 head={head:.4f} tail={tail:.4f}"
        assert seam < 0.02, f"{name}: 이음매 점프 과대 {seam:.4f}"
    print(f"[CHECK] {name}: RMS={rms:.3f} peak={peak:.3f} head={head:.4f} tail={tail:.4f} seam={seam:.4f} -> PASS")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    bgm = build_rush_bgm()
    verify("rush_bgm.wav", bgm, loop=True)
    write_wav("rush_bgm.wav", bgm)

    warn = build_rush_warning()
    verify("rush_warning.wav", warn, loop=False)
    write_wav("rush_warning.wav", warn)


if __name__ == "__main__":
    main()
