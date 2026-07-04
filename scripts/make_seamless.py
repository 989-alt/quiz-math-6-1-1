# -*- coding: utf-8 -*-
"""바닥 타일 심리스화 + 자동 검증 (설계 §4).

offset-wrap 경계 블렌딩: 원본을 (h/2, w/2) 롤링한 이미지는 바깥 경계가 wrap
연속(원본 중앙에서 이웃하던 픽셀)이고, 원본은 중앙이 연속이다. 바깥 경계
근처는 롤링본, 중앙은 원본을 쓰고 그 사이를 페이드하면 wrap 경계가 이어진
타일이 된다. 블렌딩으로 생긴 중간색은 마스터 팔레트로 재양자화.

검증: 타일을 토러스(상하/좌우가 이어진 원환)로 보고, 축별 인접 경계 diff
집합(내부 경계 전부 + wrap 경계)에서 max/median 비율이 SEAM_MAX_RATIO 이하면
통과. 실패 시 exit 1.

왜 wrap 경계 diff를 직접 임계와 비교하지 않는가: roll_to_quiet_edge가 wrap
경계를 '가장 조용한 경계(전역 최소)'로 맞추므로, wrap-seam 을 내부 경계 통계와
비교하면 최소값은 언제나 그 분포 이하 → 항상 통과하는 무의미한 게이트가 된다
(tautology). 대신 토러스 전체에서 '가장 거친 경계'가 텍스처 고유 거칠기(median)
대비 비정상적으로 튀는지를 본다. 이 지표는 롤링(토러스 회전)에 불변이라
roll_to_quiet_edge로 우회할 수 없고, 이어붙인 seam은 그것이 wrap이든 내부든
max 를 끌어올려 비율을 초과시킨다 → 진짜로 실패할 수 있는 게이트.
(실측: 심리스 타일 max/median≈2.6, 하드 seam 타일 ≈6.2.)

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

BLEND_PX = 40          # 경계 페이드 폭
SEAM_MAX_RATIO = 3.0   # 토러스 경계 diff 의 max/median 허용 상한 (심리스≈2.6, seam≈6.2)


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


def _torus_boundaries(f: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """축별 인접 경계 diff (내부 경계 전부 + wrap 경계). RGB만 사용."""
    rgb = f[..., :3]
    col = np.append(np.abs(np.diff(rgb, axis=1)).mean(axis=(0, 2)),  # (w-1,) 내부
                    np.abs(rgb[:, -1] - rgb[:, 0]).mean())            # + wrap
    row = np.append(np.abs(np.diff(rgb, axis=0)).mean(axis=(1, 2)),  # (h-1,) 내부
                    np.abs(rgb[-1, :] - rgb[0, :]).mean())            # + wrap
    return col, row


def seam_metrics(arr: np.ndarray) -> tuple[float, float, float, float]:
    """(가로축 max/median 비율, 세로축 max/median 비율, wrap 세로 seam, wrap 가로 seam)

    비율은 롤링에 불변이라 게이트를 우회할 수 없다. wrap seam 은 참고용 출력.
    """
    f = arr.astype(np.float64)
    col, row = _torus_boundaries(f)
    # 0~255 diff 스케일 기준 floor 1.0 — 평탄/저변동 타일에서 median≈0일 때
    # 1e-6 floor면 비율이 폭발해 오탐(항상 FAIL)하므로 스케일에 맞춘 값 사용
    ratio_x = float(col.max() / max(np.median(col), 1.0))
    ratio_y = float(row.max() / max(np.median(row), 1.0))
    seam_x = float(np.abs(f[:, -1, :3] - f[:, 0, :3]).mean())
    seam_y = float(np.abs(f[-1, :, :3] - f[0, :, :3]).mean())
    return ratio_x, ratio_y, seam_x, seam_y


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

    ratio_x, ratio_y, seam_x, seam_y = seam_metrics(out)
    ok = ratio_x <= SEAM_MAX_RATIO and ratio_y <= SEAM_MAX_RATIO
    print(f"[seam] torus max/median  x={ratio_x:.2f}  y={ratio_y:.2f}  "
          f"(limit {SEAM_MAX_RATIO})", flush=True)
    print(f"[seam] wrap boundary diff x={seam_x:.2f}  y={seam_y:.2f} (info)", flush=True)

    # 2x2 타일링 프리뷰 (사람 눈 확인용)
    h, w = out.shape[:2]
    tiled = np.tile(out, (2, 2, 1))
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    preview = REVIEW_DIR / f"{path.stem}_2x2.png"
    Image.fromarray(tiled).resize((w, h), Image.NEAREST).save(preview)
    print(f"[seam] preview: {preview}", flush=True)

    if not ok:
        sys.exit(f"SEAM CHECK FAILED: torus max/median exceeds {SEAM_MAX_RATIO} "
                 f"(x={ratio_x:.2f}, y={ratio_y:.2f}) — visible seam")
    print("seamless check passed", flush=True)


if __name__ == "__main__":
    main()
