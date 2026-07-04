# -*- coding: utf-8 -*-
"""ground_tile 톤다운: 원본 잔디 결은 유지하고 어둡게 + 채도만 낮춘다 (설계 §4).

배경이 너무 밝고 번잡해 엔티티 가독성을 해치는 문제를 AI 재생성 없이 프로그램적으로
해결한다. per-pixel 균일 변환이라 이음매 연속성은 보존된다(양쪽 경계에 같은 변환 적용).
톤다운 결과는 캐릭터 마스터 팔레트 밖으로 나가므로 manifest ground_tile 의 qa_skip 에
"palette" 를 추가한다(배경은 의도적으로 어두운 무채색 계열 — 캐릭터 팔레트 제약 불필요).

사용: python scripts/tone_down_ground.py [bright] [sat]
  bright: 밝기 배수 (기본 0.72, 낮을수록 어두움)
  sat:    채도 유지율 (기본 0.55, 낮을수록 무채색). 채도 감소량 = 1 - sat
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TILE = ROOT / "public" / "assets" / "generated" / "ground_tile.png"

LUMA = np.array([0.299, 0.587, 0.114])


def tone_down(arr: np.ndarray, bright: float, sat: float) -> np.ndarray:
    rgb = arr[..., :3].astype(np.float64)
    gray = (rgb * LUMA).sum(axis=-1, keepdims=True)
    desat = gray + (rgb - gray) * sat          # 채도 낮춤 (gray 쪽으로)
    out = np.clip(desat * bright, 0, 255)       # 어둡게
    res = arr.copy()
    res[..., :3] = out.round().astype(np.uint8)
    return res


def wrap_seam(arr: np.ndarray) -> tuple[float, float]:
    f = arr[..., :3].astype(np.float64)
    sx = float(np.abs(f[:, -1] - f[:, 0]).mean())
    sy = float(np.abs(f[-1, :] - f[0, :]).mean())
    return sx, sy


def main() -> None:
    bright = float(sys.argv[1]) if len(sys.argv) > 1 else 0.72
    sat = float(sys.argv[2]) if len(sys.argv) > 2 else 0.55
    arr = np.asarray(Image.open(TILE).convert("RGBA"))

    before_luma = float((arr[..., :3].astype(np.float64) * LUMA).sum(-1).mean())
    out = tone_down(arr, bright, sat)
    after_luma = float((out[..., :3].astype(np.float64) * LUMA).sum(-1).mean())

    sx0, sy0 = wrap_seam(arr)
    sx1, sy1 = wrap_seam(out)
    Image.fromarray(out).save(TILE)
    print(f"[tone] bright={bright} sat={sat}  luma {before_luma:.1f} -> {after_luma:.1f}")
    print(f"[tone] wrap seam preserved: x {sx0:.2f}->{sx1:.2f}  y {sy0:.2f}->{sy1:.2f}")


if __name__ == "__main__":
    main()
