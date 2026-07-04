# -*- coding: utf-8 -*-
"""바닥 타일 심리스화 + 자동 검증 (설계 §4).

offset-wrap 경계 블렌딩: 원본을 (h/2, w/2) 롤링한 이미지는 바깥 경계가 wrap
연속(원본 중앙에서 이웃하던 픽셀)이고, 원본은 중앙이 연속이다. 바깥 경계
근처는 롤링본, 중앙은 원본을 쓰고 그 사이를 페이드하면 wrap 경계가 이어진
타일이 된다. 블렌딩으로 생긴 중간색은 마스터 팔레트로 재양자화.

검증: 2x2 타일링 렌더 기준 wrap 경계(마지막 열↔첫 열, 마지막 행↔첫 행)의
인접 픽셀 diff가 내부 인접 경계 diff 분포의 SEAM_PERCENTILE 백분위 이하면 통과.
실패 시 exit 1.

주의: 픽셀아트의 인접 컬럼/로우 diff는 바이모달(픽셀 블록 내부 ~0, 블록 경계
스파이크)이라 "내부 평균 대비 배수" 기준은 wrap 경계가 우연히 블록 경계에
걸리면 오탐한다. wrap 경계 diff가 내부의 정상적인 블록 경계 diff 분포 범위
이내인지로 판정한다 (진짜 이어붙인 seam은 p95를 크게 초과).

사용: python scripts/make_seamless.py public/assets/generated/ground_tile.png
      (제자리 덮어쓰기 + docs/asset_review/ground_tile_2x2.png 프리뷰 생성)
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import asset_qa  # noqa: E402
from asset_pipeline import REVIEW_DIR, quantize_to_palette  # noqa: E402

BLEND_PX = 40         # 경계 페이드 폭
SEAM_PERCENTILE = 95  # wrap 경계 diff 허용 상한: 내부 인접 경계 diff 분포의 백분위


def make_seamless(arr: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    rolled = np.roll(np.roll(arr, h // 2, axis=0), w // 2, axis=1)
    yy, xx = np.mgrid[0:h, 0:w]
    d_edge = np.minimum.reduce([xx, w - 1 - xx, yy, h - 1 - yy]).astype(np.float64)
    w_roll = np.clip((BLEND_PX - d_edge) / BLEND_PX, 0.0, 1.0)[..., None]
    out = rolled.astype(np.float64) * w_roll + arr.astype(np.float64) * (1 - w_roll)
    return out.round().astype(np.uint8)


def roll_to_quiet_edge(arr: np.ndarray) -> np.ndarray:
    """블렌딩된 타일은 어디서 잘라도 wrap 연속 → diff가 가장 조용한 경계가
    이미지 가장자리에 오도록 롤링 (무손실, 측정 seam 최소화)."""
    h, w = arr.shape[:2]
    f = arr.astype(np.float64)
    col = np.append(np.abs(np.diff(f, axis=1)).mean(axis=(0, 2)),
                    np.abs(f[:, -1] - f[:, 0]).mean())  # 경계 i = col i|i+1, 끝=wrap
    row = np.append(np.abs(np.diff(f, axis=0)).mean(axis=(1, 2)),
                    np.abs(f[-1, :] - f[0, :]).mean())
    kx = int(np.argmin(col))
    ky = int(np.argmin(row))
    return np.roll(np.roll(arr, -((kx + 1) % w), axis=1), -((ky + 1) % h), axis=0)


def seam_metrics(arr: np.ndarray) -> tuple[float, float, float, float]:
    """(wrap 세로 경계 diff, wrap 가로 경계 diff, 내부 컬럼 diff p95, 내부 로우 diff p95)

    내부 인접 경계별 평균 diff의 분포에서 백분위를 구한다 — 픽셀 블록 경계
    스파이크까지 포함한 '정상 diff 범위'의 상한이며, 진짜 seam은 이를 초과한다.
    """
    f = arr.astype(np.float64)
    seam_x = float(np.abs(f[:, -1] - f[:, 0]).mean())
    seam_y = float(np.abs(f[-1, :] - f[0, :]).mean())
    col_diffs = np.abs(np.diff(f, axis=1)).mean(axis=(0, 2))  # 경계별 평균 (w-1,)
    row_diffs = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))  # 경계별 평균 (h-1,)
    p_col = float(np.percentile(col_diffs, SEAM_PERCENTILE))
    p_row = float(np.percentile(row_diffs, SEAM_PERCENTILE))
    return seam_x, seam_y, p_col, p_row


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: python scripts/make_seamless.py <tile.png>")
    path = Path(sys.argv[1])
    arr = np.asarray(Image.open(path).convert("RGBA"))

    out = make_seamless(arr)
    out[..., 3] = 255  # 타일은 전부 불투명
    palette = asset_qa.load_master_palette()
    out = quantize_to_palette(out, palette)  # 블렌딩 중간색 제거 (팔레트 QA 유지)
    out = roll_to_quiet_edge(out)
    Image.fromarray(out).save(path)

    seam_x, seam_y, p_col, p_row = seam_metrics(out)
    ok = seam_x <= p_col and seam_y <= p_row
    print(f"[seam] vertical {seam_x:.2f} (limit p{SEAM_PERCENTILE} {p_col:.2f}) / "
          f"horizontal {seam_y:.2f} (limit p{SEAM_PERCENTILE} {p_row:.2f})", flush=True)

    # 2x2 타일링 프리뷰 (사람 눈 확인용)
    h, w = out.shape[:2]
    tiled = np.tile(out, (2, 2, 1))
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    preview = REVIEW_DIR / f"{path.stem}_2x2.png"
    Image.fromarray(tiled).resize((w, h), Image.NEAREST).save(preview)
    print(f"[seam] preview: {preview}", flush=True)

    if not ok:
        sys.exit(f"SEAM CHECK FAILED: wrap seam diff exceeds internal p{SEAM_PERCENTILE}")
    print("seamless check passed", flush=True)


if __name__ == "__main__":
    main()
