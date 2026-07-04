# -*- coding: utf-8 -*-
"""에셋 자동 품질 검사 (Phase 3A §2.2).

manifest(public/assets/generated/manifest.json) 기준으로 전 에셋을 검사한다.
  - density   : 프레임 native 도트 밀도 (최대변 == native ±1)
  - palette   : 마스터 팔레트(≤48색) 밖 색 비율 0%
  - outline   : 실루엣 엣지 픽셀의 다크 아웃라인 비율
  - transparency : 마젠타 잔여 0 + 반투명 fringe ≤1px
  - alignment : 스트립 프레임 간 발바닥 baseline 편차 ≤2px

사용: python scripts/asset_qa.py            # 전체 검사, 실패 시 exit 1
      python scripts/asset_qa.py --only hero_walk
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GEN_DIR = ROOT / "public" / "assets" / "generated"
WORK_DIR = ROOT / "assets_work"
KEYVISUAL_DIR = ROOT / "docs" / "keyvisuals"
MANIFEST_PATH = GEN_DIR / "manifest.json"
PALETTE_PATH = WORK_DIR / "master_palette.json"
PALETTE_SOURCES = ("B1_pixel_keyvisual.png", "B2_pixel_lineup.png")
PALETTE_SIZE = 48

NATIVE_TOL = 1          # 도트 밀도 허용 오차(px)
BASELINE_TOL = 2        # baseline 편차 허용(px)
DARK_LUMA = 112.0       # 아웃라인 '다크' 판정 휘도
DARK_EDGE_MIN_RATIO = 0.55  # 엣지 픽셀 중 다크 비율 최소값


# ---------------------------------------------------------------- palette

def build_master_palette() -> list[list[int]]:
    """B1+B2에서 median-cut으로 ≤48색 마스터 팔레트 추출 (결정적)."""
    chunks = []
    for name in PALETTE_SOURCES:
        img = Image.open(KEYVISUAL_DIR / name).convert("RGB")
        img = img.resize((256, max(1, round(256 * img.height / img.width))))
        chunks.append(np.asarray(img).reshape(-1, 3))
    px = np.concatenate(chunks)
    rows = len(px) // 256
    sheet = Image.fromarray(px[: rows * 256].reshape(rows, 256, 3), "RGB")
    # MAXCOVERAGE: 키비주얼의 어두운 배경이 대면적이라 MEDIANCUT은 스프라이트의
    # 밝은 색(피부/흰색/노랑)을 다 날린다. 색공간 커버리지 방식이 검증상 압도적.
    q = sheet.quantize(colors=PALETTE_SIZE, method=Image.Quantize.MAXCOVERAGE)
    raw = q.getpalette()[: PALETTE_SIZE * 3]
    colors = [raw[i : i + 3] for i in range(0, len(raw), 3)]
    uniq: list[list[int]] = []
    for c in colors:
        if c not in uniq:
            uniq.append(c)
    return uniq


def load_master_palette() -> np.ndarray:
    """캐시(assets_work/master_palette.json) 로드, 없으면 추출·저장."""
    if PALETTE_PATH.exists():
        colors = json.loads(PALETTE_PATH.read_text(encoding="utf-8"))["colors"]
    else:
        colors = build_master_palette()
        PALETTE_PATH.parent.mkdir(parents=True, exist_ok=True)
        PALETTE_PATH.write_text(
            json.dumps({"sources": list(PALETTE_SOURCES), "colors": colors}, indent=1),
            encoding="utf-8",
        )
    return np.array(colors, dtype=np.int32)


# ---------------------------------------------------------------- helpers

def frame_views(arr: np.ndarray, frames: int, frame_w: int) -> list[np.ndarray]:
    """가로 스트립을 균등 셀로 잘라 프레임 배열 목록 반환."""
    return [arr[:, i * frame_w : (i + 1) * frame_w] for i in range(frames)]


def opaque_bbox(alpha: np.ndarray) -> tuple[int, int, int, int] | None:
    """(x0, y0, x1, y1) exclusive. 불투명 픽셀 없으면 None."""
    ys, xs = np.where(alpha >= 128)
    if len(ys) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _luma(rgb: np.ndarray) -> np.ndarray:
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def _neighbor_or(mask: np.ndarray, fill: bool) -> np.ndarray:
    """4방향 이웃 중 하나라도 True (경계 밖은 fill)."""
    out = np.full(mask.shape, False)
    padded = np.pad(mask, 1, constant_values=fill)
    out |= padded[:-2, 1:-1] | padded[2:, 1:-1] | padded[1:-1, :-2] | padded[1:-1, 2:]
    return out


# ---------------------------------------------------------------- checks
# 각 체크는 (ok: bool, detail: str) 반환. arr는 RGBA uint8.

def check_density(arr: np.ndarray, native: int, frames: int, frame_w: int) -> tuple[bool, str]:
    """프레임 중 최대 스프라이트 변 길이 == native ±1."""
    dims = []
    for f in frame_views(arr, frames, frame_w):
        bb = opaque_bbox(f[..., 3])
        if bb is None:
            return False, "empty frame"
        dims.append(max(bb[2] - bb[0], bb[3] - bb[1]))
    peak = max(dims)
    ok = abs(peak - native) <= NATIVE_TOL
    return ok, f"max sprite dim {peak}px vs native {native}"


def check_palette(arr: np.ndarray, palette: np.ndarray) -> tuple[bool, str]:
    """불투명 픽셀 전부가 마스터 팔레트 색이어야 함 (밖 비율 0%)."""
    opaque = arr[arr[..., 3] >= 128][:, :3].astype(np.int32)
    if len(opaque) == 0:
        return False, "no opaque pixels"
    d = ((opaque[:, None, :] - palette[None, :, :]) ** 2).sum(axis=2)
    off = int((d.min(axis=1) > 0).sum())
    return off == 0, f"{off}/{len(opaque)} pixels outside master palette"


def check_outline(arr: np.ndarray) -> tuple[bool, str]:
    """실루엣 엣지(투명 인접 불투명 픽셀)의 다크 비율로 1px 아웃라인 존재 확인."""
    opaque = arr[..., 3] >= 128
    edge = opaque & _neighbor_or(~opaque, fill=True)
    n = int(edge.sum())
    if n == 0:
        return False, "no edge pixels"
    dark = int((_luma(arr[..., :3].astype(np.float64))[edge] <= DARK_LUMA).sum())
    ratio = dark / n
    return ratio >= DARK_EDGE_MIN_RATIO, f"dark edge ratio {ratio:.2f} (min {DARK_EDGE_MIN_RATIO})"


def check_transparency(arr: np.ndarray) -> tuple[bool, str]:
    """마젠타 잔여 0 + 반투명 픽셀은 불투명 인접 1px fringe만 허용."""
    rgb = arr[..., :3].astype(np.int32)
    a = arr[..., 3]
    opaque = a >= 128
    magenta = (
        opaque
        & (rgb[..., 0] > 180)
        & (rgb[..., 2] > 180)
        & (rgb[..., 1] < 110)
        & (np.abs(rgb[..., 0] - rgb[..., 2]) < 80)
    )
    n_mag = int(magenta.sum())
    semi = (a > 0) & (a < 255)
    stray = semi & ~_neighbor_or(a == 255, fill=False)
    n_stray = int(stray.sum())
    ok = n_mag == 0 and n_stray == 0
    return ok, f"magenta residue {n_mag}, stray semi-alpha {n_stray}"


def check_alignment(arr: np.ndarray, frames: int, frame_w: int) -> tuple[bool, str]:
    """스트립 프레임 간 발바닥(최하단 불투명 행) 편차 ≤2px."""
    bottoms = []
    for f in frame_views(arr, frames, frame_w):
        bb = opaque_bbox(f[..., 3])
        if bb is None:
            return False, "empty frame"
        bottoms.append(bb[3])
    dev = max(bottoms) - min(bottoms)
    return dev <= BASELINE_TOL, f"baseline deviation {dev}px (max {BASELINE_TOL})"


def run_checks(entry: dict, palette: np.ndarray) -> dict[str, tuple[bool, str]]:
    """manifest 엔트리 1건 검사. {check_name: (ok, detail)}

    entry["qa_skip"]에 나열된 체크는 면제한다 (batch config에서 지정, 파이프라인이
    manifest에 기록). 사유: 이펙트는 (a) 글로우/발광 특성상 1px 다크 아웃라인
    기준이 부적합하고 (outline 면제), (b) 발이 없어 baseline 이 아닌 세로 중앙
    정렬(align=center)로 합성되므로 프레임 간 하단 정렬 검사가 성립하지 않는다
    (alignment 면제) — 이 두 항목은 이펙트에서 정상이며 '고치면' 9종 이펙트가
    거짓 실패한다. 홈 키아트·512 바닥 타일 같은 대형 이미지는 캐릭터용 도트밀도·
    아웃라인 기준이 성립하지 않으며, 소프트 섀도 블롭은 반투명 그라데이션이
    본질이라 투명도/팔레트 검사와 양립 불가. 나머지 검사는 그대로 수행.
    """
    path = GEN_DIR / entry["file"]
    if not path.exists():
        return {"exists": (False, f"missing file {path.name}")}
    skip = set(entry.get("qa_skip") or [])
    arr = np.asarray(Image.open(path).convert("RGBA"))
    frames = entry.get("frames", 1)
    frame_w = entry.get("frame_w", arr.shape[1])
    results: dict[str, tuple[bool, str]] = {}
    if "density" not in skip:
        results["density"] = check_density(arr, entry["native"], frames, frame_w)
    if "palette" not in skip:
        results["palette"] = check_palette(arr, palette)
    if "outline" not in skip:
        results["outline"] = check_outline(arr)
    if "transparency" not in skip:
        results["transparency"] = check_transparency(arr)
    if frames > 1 and "alignment" not in skip:
        results["alignment"] = check_alignment(arr, frames, frame_w)
    return results


# ---------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="asset id filter")
    args = ap.parse_args()

    if not MANIFEST_PATH.exists():
        sys.exit(f"manifest not found: {MANIFEST_PATH}")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    palette = load_master_palette()

    entries = [e for e in manifest["assets"] if not args.only or e["id"] == args.only]
    if not entries:
        sys.exit(f"no assets matched --only {args.only}")

    failures = 0
    for entry in entries:
        results = run_checks(entry, palette)
        bad = [k for k, (ok, _) in results.items() if not ok]
        mark = "FAIL" if bad else "PASS"
        print(f"[{mark}] {entry['id']} ({entry['file']})", flush=True)
        for name, (ok, detail) in results.items():
            print(f"    {'ok  ' if ok else 'FAIL'} {name:<12} {detail}", flush=True)
        failures += len(bad)

    print("=" * 48, flush=True)
    if failures:
        print(f"QA FAILED: {failures} check(s) failed", flush=True)
        sys.exit(1)
    print(f"QA passed: {len(entries)} asset(s), all checks green", flush=True)


if __name__ == "__main__":
    main()
