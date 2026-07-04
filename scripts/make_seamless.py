# -*- coding: utf-8 -*-
"""바닥 타일 심리스화 + 자동 검증 (설계 §4).

offset-wrap 경계 블렌딩: 원본을 (h/2, w/2) 롤링한 이미지는 바깥 경계가 wrap
연속(원본 중앙에서 이웃하던 픽셀)이고, 원본은 중앙이 연속이다. 바깥 경계
근처는 롤링본, 중앙은 원본을 쓰고 그 사이를 페이드하면 wrap 경계가 이어진
타일이 된다. 블렌딩으로 생긴 중간색은 마스터 팔레트로 재양자화.

검증: 게임이 실제로 타일링하는 wrap 경계(마지막 열↔첫 열, 마지막 행↔첫 행)의
채널 평균 픽셀 diff가 절대 상한 SEAM_MAX_DIFF 이하면 통과. 실패 시 exit 1.

왜 절대 상한인가:
- 내부 경계 통계(평균·median·백분위) 대비 비교는 tautology 위험이 있다.
  roll_to_quiet_edge가 wrap 을 '전역 최소 경계'로 맞추므로 wrap ≤ 어떤 중심
  통계값도 항상 성립 → 통과가 보장되는 무의미한 게이트가 된다.
- max/median 비율(롤링 불변) 방식은 미세 텍스처엔 되지만, 청키/평탄 블록
  타일에선 median≈0(평탄 블록 내부 diff 0) 이라 정상 블록 엣지 하나에도
  비율이 폭발해 오탐(false fail)한다.
- 절대 상한은 고정 상수라 excludes-the-tested-value 무의미성이 없고, 미세/청키
  타일 모두에 통용된다. make_seamless 는 blend+roll 로 wrap 을 낮추므로 정상
  타일은 여유롭게 통과하고, 이어붙일 수 없는(또는 blend 미적용) 타일은 wrap
  경계 diff 가 상한을 넘겨 fail 분기에 도달한다(도달 가능한 실제 게이트).
  (실측: 미세 심리스 wrap≈1.4, 청키 심리스 wrap≈0.0, 하드 seam 타일 wrap≈40.)
- 미묘한 시각적 이질감(반복 패턴 등)은 2x2 프리뷰로 사람이 최종 확인.

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
SEAM_MAX_DIFF = 8.0   # wrap 경계 채널평균 픽셀 diff 절대 상한 (심리스 <2, 하드 seam >20)


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
    """(wrap 세로(좌우) seam, wrap 가로(상하) seam, 참고 col max/median, row max/median)

    seam_x/seam_y 가 게이트 대상(게임이 타일링하는 실제 wrap 경계 채널평균 diff).
    max/median 비율은 참고 출력만 — 평탄 블록 타일에서 median≈0이라 정상 블록
    엣지에도 폭발해 게이트로는 부적합(청키 타일 오탐).
    """
    f = arr.astype(np.float64)
    seam_x = float(np.abs(f[:, -1, :3] - f[:, 0, :3]).mean())
    seam_y = float(np.abs(f[-1, :, :3] - f[0, :, :3]).mean())
    col, row = _torus_boundaries(f)
    ratio_x = float(col.max() / max(np.median(col), 1.0))
    ratio_y = float(row.max() / max(np.median(row), 1.0))
    return seam_x, seam_y, ratio_x, ratio_y


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

    seam_x, seam_y, ratio_x, ratio_y = seam_metrics(out)
    ok = seam_x <= SEAM_MAX_DIFF and seam_y <= SEAM_MAX_DIFF
    print(f"[seam] wrap boundary diff x={seam_x:.2f}  y={seam_y:.2f}  "
          f"(limit {SEAM_MAX_DIFF})", flush=True)
    print(f"[seam] torus max/median   x={ratio_x:.2f}  y={ratio_y:.2f} (info)", flush=True)

    # 2x2 타일링 프리뷰 (사람 눈 확인용)
    h, w = out.shape[:2]
    tiled = np.tile(out, (2, 2, 1))
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    preview = REVIEW_DIR / f"{path.stem}_2x2.png"
    Image.fromarray(tiled).resize((w, h), Image.NEAREST).save(preview)
    print(f"[seam] preview: {preview}", flush=True)

    if not ok:
        sys.exit(f"SEAM CHECK FAILED: wrap boundary diff exceeds {SEAM_MAX_DIFF} "
                 f"(x={seam_x:.2f}, y={seam_y:.2f}) — visible seam")
    print("seamless check passed", flush=True)


if __name__ == "__main__":
    main()
