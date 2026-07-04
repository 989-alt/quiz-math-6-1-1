# -*- coding: utf-8 -*-
"""에셋 생성 + 후처리 파이프라인 (Phase 3A §2.1~§2.5).

흐름: 앵커 업로드(File Upload API) → i2i 생성(gpt-image-2-image-to-image, 앵커 스타일 강제)
      → chroma-key 마젠타 제거 → 균등 셀 분할 → bbox/발바닥 baseline 정렬
      → native 격자 스냅 다운스케일(셀 중앙값) → 마스터 팔레트 양자화
      → 알파 트림+2px 패딩 → 최종 PNG + manifest.json → 콘택트시트 HTML.

인라인 QA(asset_qa)에 실패한 잡은 프롬프트 보정 후 재생성 (최대 max_attempts회).

사용: python scripts/asset_pipeline.py                       # 기본 batch_3a
      python scripts/asset_pipeline.py --config scripts/batches/batch_3a.json
      python scripts/asset_pipeline.py --only weapon_star    # 특정 잡만
      python scripts/asset_pipeline.py --reuse-raw           # 기존 raw 재사용(후처리 디버깅)
키: 프로젝트 루트 .env.kie 에서 로드 (커밋 금지)
"""
from __future__ import annotations

import argparse
import base64
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import asset_qa  # noqa: E402  (공유 체크/팔레트 로직)

ROOT = Path(__file__).resolve().parent.parent
WORK_DIR = ROOT / "assets_work"
RAW_DIR = WORK_DIR / "raw"
KEYED_DIR = WORK_DIR / "keyed"
GEN_DIR = ROOT / "public" / "assets" / "generated"
KEYVISUAL_DIR = ROOT / "docs" / "keyvisuals"
REVIEW_DIR = ROOT / "docs" / "asset_review"
ANCHOR_CACHE = WORK_DIR / "anchors.json"

CREATE_URL = "https://api.kie.ai/api/v1/jobs/createTask"
QUERY_URL = "https://api.kie.ai/api/v1/jobs/recordInfo"
UPLOAD_URL = "https://kieai.redpandaai.co/api/file-base64-upload"
MODEL = "gpt-image-2-image-to-image"
ANCHOR_TTL_S = 48 * 3600  # downloadUrl은 3일 유지 → 48시간 내 재사용

STYLE_CLAUSE = (
    "16-bit SNES-era pixel art, crisp uniform pixel grid, 1px dark outline, "
    "top-left light source, 3/4 top-down view, limited palette matching the "
    "reference images, solid magenta background #FF00FF, single subject centered, "
    "no letters no words no numbers"
)

# QA 실패 항목 → 재생성 프롬프트 보정 문구
RETRY_HINTS = {
    "outline": (
        "Every subject must have a clean continuous 1-pixel very dark outline "
        "around its entire silhouette."
    ),
    "transparency": (
        "The background must be one perfectly flat uniform solid magenta #FF00FF "
        "with no gradient, no glow, no shadow, no vignette."
    ),
    "density": "Draw each subject large so it fills most of its column.",
    "palette": "Use only the exact colors visible in the reference images.",
    "alignment": (
        "All frames must stand on the exact same ground line with feet at the "
        "same height in every column."
    ),
    "pipeline": (
        "Keep every subject fully inside its own column with clear empty magenta "
        "gaps between columns; subjects must never touch or overlap column edges."
    ),
}

PAD = 2  # 최종 스프라이트 투명 패딩(px)


class PipelineError(RuntimeError):
    """후처리 실패 (재생성으로 복구 시도)."""


# 잡 단위로 격리해 재시도할 오류들. urllib은 HTTPError/URLError(OSError 계열),
# 손상 응답은 JSONDecodeError(ValueError)/KeyError, 손상 이미지는
# UnidentifiedImageError(OSError)를 던진다 — 한 잡의 실패가 배치를 죽이면 안 됨.
JOB_ERRORS = (PipelineError, RuntimeError, TimeoutError, OSError, ValueError, KeyError)


# ---------------------------------------------------------------- kie.ai API

def load_api_key() -> str:
    env_path = ROOT / ".env.kie"
    if not env_path.exists():
        sys.exit(f".env.kie not found at {env_path}")
    candidates: dict[str, str] = {}
    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        candidates[name.strip()] = value.strip().strip('"').strip("'")
    for name, value in candidates.items():
        if "KEY" in name.upper() and value:
            return value
    if candidates:
        return next(iter(candidates.values()))
    sys.exit("no KEY=VALUE entries found in .env.kie")


def api_call(url: str, api_key: str, payload: dict | None = None, timeout: int = 120) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            # redpandaai(파일 업로드) 호스트는 UA 없으면 Cloudflare 1010으로 403
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def upload_anchor(api_key: str, path: Path) -> str:
    """키비주얼을 File Upload API로 올려 공개 downloadUrl 확보."""
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    payload = {
        "base64Data": f"data:image/png;base64,{b64}",
        "uploadPath": "images/quiz-survivor-anchors",
        "fileName": path.name,
    }
    res = api_call(UPLOAD_URL, api_key, payload, timeout=180)
    data = res.get("data") or {}
    url = data.get("downloadUrl") or data.get("fileUrl") or data.get("url")
    if not url:
        raise RuntimeError(f"upload response missing url for {path.name}: {res}")
    return url


def ensure_anchor_urls(api_key: str, names: list[str]) -> dict[str, str]:
    """앵커 공개 URL 확보 (48시간 캐시)."""
    cache: dict[str, dict] = {}
    if ANCHOR_CACHE.exists():
        cache = json.loads(ANCHOR_CACHE.read_text(encoding="utf-8"))
    now = time.time()
    urls: dict[str, str] = {}
    for name in names:
        hit = cache.get(name)
        if hit and now - hit["ts"] < ANCHOR_TTL_S:
            urls[name] = hit["url"]
            continue
        url = upload_anchor(api_key, KEYVISUAL_DIR / name)
        cache[name] = {"url": url, "ts": now}
        urls[name] = url
        print(f"[anchor] uploaded {name}", flush=True)
    ANCHOR_CACHE.parent.mkdir(parents=True, exist_ok=True)
    ANCHOR_CACHE.write_text(json.dumps(cache, indent=1), encoding="utf-8")
    return urls


def create_task(api_key: str, job: dict, anchor_urls: list[str], hints: list[str]) -> str:
    # 키아트/타일 같은 풀블리드 이미지는 마젠타/단일 피사체 조항이 오히려 해로움
    # → 잡별 style_clause 오버라이드 허용
    clause = job.get("style_clause", STYLE_CLAUSE)
    prompt = job["prompt"] + ((" " + clause) if clause else "")
    if hints:
        prompt += " IMPORTANT: " + " ".join(hints)
    body = {
        "model": MODEL,
        "input": {
            "prompt": prompt,
            "input_urls": anchor_urls,
            "aspect_ratio": job["aspect_ratio"],
            "resolution": "1K",
        },
    }
    res = api_call(CREATE_URL, api_key, body)
    if res.get("code") != 200:
        raise RuntimeError(f"createTask failed for {job['id']}: {res}")
    task_id = res["data"]["taskId"]
    print(f"[create] {job['id']} -> {task_id}", flush=True)
    return task_id


def ensure_identity_urls(api_key: str, jobs: list[dict]) -> dict[str, list[str]]:
    """잡별 identity 앵커(기존 생성 스프라이트) 업로드 → {job id: [url]}.

    캐릭터/몬스터의 프레임 간 정체성 유지용으로 해당 스프라이트를 추가
    input_urls로 넣는다. 작은 스프라이트는 i2i 참조로 쓰기엔 너무 작아
    nearest ≥256px 확대본을 마젠타 배경에 합성해 올린다 (출력 포맷과 동일한
    형태로 보여줘야 참조 효과가 큼). 캐시 키에 mtime 포함 (재생성 시 stale 방지).
    """
    cache: dict[str, dict] = {}
    if ANCHOR_CACHE.exists():
        cache = json.loads(ANCHOR_CACHE.read_text(encoding="utf-8"))
    now = time.time()
    out: dict[str, list[str]] = {}
    for job in jobs:
        urls: list[str] = []
        for name in job.get("identity_files") or []:
            src = GEN_DIR / name
            key = f"gen:{name}:{int(src.stat().st_mtime)}"
            hit = cache.get(key)
            if hit and now - hit["ts"] < ANCHOR_TTL_S:
                urls.append(hit["url"])
                continue
            img = Image.open(src).convert("RGBA")
            scale = max(1, round(256 / max(img.size)))
            big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
            canvas = Image.new("RGB", big.size, (255, 0, 255))
            canvas.paste(big, mask=big.split()[3])
            tmp = WORK_DIR / f"identity_{name}"
            tmp.parent.mkdir(parents=True, exist_ok=True)
            canvas.save(tmp)
            url = upload_anchor(api_key, tmp)
            cache[key] = {"url": url, "ts": now}
            urls.append(url)
            print(f"[anchor] uploaded identity {name} (x{scale})", flush=True)
        if urls:
            out[job["id"]] = urls
    ANCHOR_CACHE.parent.mkdir(parents=True, exist_ok=True)
    ANCHOR_CACHE.write_text(json.dumps(cache, indent=1), encoding="utf-8")
    return out


def poll_task(api_key: str, name: str, task_id: str, timeout_s: int = 600) -> list[str]:
    start = time.time()
    while time.time() - start < timeout_s:
        res = api_call(f"{QUERY_URL}?taskId={task_id}", api_key)
        state = res.get("data", {}).get("state", "?")
        if state == "success":
            result = json.loads(res["data"]["resultJson"])
            print(f"[done ] {name} ({int(time.time() - start)}s)", flush=True)
            return result.get("resultUrls", [])
        if state == "fail":
            raise RuntimeError(
                f"{name} failed: {res['data'].get('failCode')} {res['data'].get('failMsg')}"
            )
        time.sleep(6)
    raise TimeoutError(f"{name} timed out after {timeout_s}s")


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=180) as resp:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(resp.read())
    print(f"[save ] {dest.name} ({dest.stat().st_size // 1024} KB)", flush=True)


# ---------------------------------------------------------------- post-process

def chroma_key(arr: np.ndarray) -> np.ndarray:
    """마젠타 배경 → alpha 0. (r,b 높고 g 낮은 픽셀)"""
    rgb = arr[..., :3].astype(np.int32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    magenta = (r > 100) & (b > 100) & (g < 0.5 * np.minimum(r, b))
    out = arr.copy()
    out[..., 3] = np.where(magenta, 0, 255).astype(np.uint8)
    return out


def split_cells(arr: np.ndarray, n: int) -> list[np.ndarray]:
    """균등 셀 분할. 경계가 스프라이트를 자르면 근처 투명 컬럼 갭으로 스냅."""
    h, w = arr.shape[:2]
    col_opaque = (arr[..., 3] >= 128).any(axis=0)
    bounds = [0]
    for i in range(1, n):
        ideal = round(i * w / n)
        if not col_opaque[ideal]:
            bounds.append(ideal)
            continue
        tol = max(2, round(0.12 * w / n))
        snapped = None
        for d in range(1, tol + 1):
            for cand in (ideal - d, ideal + d):
                if 0 < cand < w and not col_opaque[cand]:
                    snapped = cand
                    break
            if snapped is not None:
                break
        if snapped is None:
            raise PipelineError(f"cell boundary {i} cuts through sprite (no gap near x={ideal})")
        bounds.append(snapped)
    bounds.append(w)
    return [arr[:, bounds[i] : bounds[i + 1]] for i in range(n)]


def crop_sprite(cell: np.ndarray, job_id: str, idx: int) -> np.ndarray:
    bb = asset_qa.opaque_bbox(cell[..., 3])
    if bb is None:
        raise PipelineError(f"{job_id} cell {idx}: no sprite found after chroma key")
    x0, y0, x1, y1 = bb
    return cell[y0:y1, x0:x1]


def grid_snap_downscale(sprite: np.ndarray, scale: float) -> np.ndarray:
    """격자 스냅 다운스케일: 타깃 픽셀마다 소스 셀 중앙값 샘플링, 알파는 과반 투표."""
    sh, sw = sprite.shape[:2]
    tw = max(1, round(sw * scale))
    th = max(1, round(sh * scale))
    xs = np.linspace(0, sw, tw + 1)
    ys = np.linspace(0, sh, th + 1)
    out = np.zeros((th, tw, 4), dtype=np.uint8)
    alpha = sprite[..., 3] >= 128
    for ty in range(th):
        y0, y1 = int(ys[ty]), max(int(ys[ty]) + 1, int(round(ys[ty + 1])))
        for tx in range(tw):
            x0, x1 = int(xs[tx]), max(int(xs[tx]) + 1, int(round(xs[tx + 1])))
            m = alpha[y0:y1, x0:x1]
            if m.mean() < 0.5:
                continue
            region = sprite[y0:y1, x0:x1, :3][m]
            out[ty, tx, :3] = np.median(region, axis=0).astype(np.uint8)
            out[ty, tx, 3] = 255
    return out


def quantize_to_palette(sprite: np.ndarray, palette: np.ndarray) -> np.ndarray:
    """불투명 픽셀을 마스터 팔레트 최근접 색으로 양자화."""
    out = sprite.copy()
    mask = sprite[..., 3] >= 128
    px = sprite[mask][:, :3].astype(np.int32)
    if len(px) == 0:
        return out
    d = ((px[:, None, :] - palette[None, :, :]) ** 2).sum(axis=2)
    out[mask, :3] = palette[d.argmin(axis=1)].astype(np.uint8)
    return out


def trim(sprite: np.ndarray) -> np.ndarray:
    """알파 트림 (다운스케일 투표로 생긴 투명 테두리 제거)."""
    bb = asset_qa.opaque_bbox(sprite[..., 3])
    if bb is None:
        raise PipelineError("sprite vanished during post-processing")
    x0, y0, x1, y1 = bb
    return sprite[y0:y1, x0:x1]


def trim_pad(sprite: np.ndarray) -> np.ndarray:
    """알파 트림 + 2px 투명 패딩."""
    core = trim(sprite)
    h, w = core.shape[:2]
    out = np.zeros((h + 2 * PAD, w + 2 * PAD, 4), dtype=np.uint8)
    out[PAD : PAD + h, PAD : PAD + w] = core
    return out


def compose_strip(frames: list[np.ndarray], align: str = "bottom") -> tuple[np.ndarray, dict]:
    """프레임들을 균등 셀 스트립으로 합성. 기본은 발바닥 baseline을 셀 하단-2px에
    정렬, 이펙트류(발이 없고 중심에서 퍼짐)는 align="center"로 세로 중앙 정렬."""
    cell_w = max(f.shape[1] for f in frames) + 2 * PAD
    cell_h = max(f.shape[0] for f in frames) + 2 * PAD
    baseline = cell_h - PAD
    strip = np.zeros((cell_h, cell_w * len(frames), 4), dtype=np.uint8)
    for i, f in enumerate(frames):
        h, w = f.shape[:2]
        x = i * cell_w + (cell_w - w) // 2
        y = (cell_h - h) // 2 if align == "center" else baseline - h
        strip[y : y + h, x : x + w] = f
    return strip, {"frame_w": cell_w, "frame_h": cell_h, "baseline_y": baseline}


def proc_generate(job: dict) -> list[dict]:
    """API 없이 코드로 만드는 에셋. soft_shadow: 반투명 타원 그림자 블롭.
    소프트 알파 그라데이션은 §2.2 아웃라인/투명도/팔레트 기준과 양립 불가
    (반투명이 본질) → batch config에서 qa_skip 전체 면제 전제."""
    if job.get("proc") != "soft_shadow":
        raise PipelineError(f"unknown proc {job.get('proc')}")
    w = job["native"]
    h = max(2, w // 2)
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx - (w - 1) / 2) / (w / 2)
    ny = (yy - (h - 1) / 2) / (h / 2)
    r2 = nx ** 2 + ny ** 2
    alpha = np.clip((1.0 - r2) * 130, 0, 130).astype(np.uint8)
    arr = np.zeros((h, w, 4), dtype=np.uint8)
    arr[..., 3] = alpha
    out = job["outputs"][0]
    GEN_DIR.mkdir(parents=True, exist_ok=True)
    Image.fromarray(arr).save(GEN_DIR / out)
    return [{"id": job["id"], "file": out, "kind": "single", "native": w,
             "frames": 1, "frame_w": w, "frame_h": h}]


def postprocess(job: dict, raw_path: Path, palette: np.ndarray) -> list[dict]:
    """raw 생성물 → 최종 PNG(들) 저장. manifest 엔트리 목록 반환."""
    kind = job["kind"]
    GEN_DIR.mkdir(parents=True, exist_ok=True)

    def finish(entries: list[dict]) -> list[dict]:
        # 잡 단위 QA 면제를 엔트리에 남겨 인라인 QA와 독립 실행(asset_qa) 모두 적용
        if job.get("qa_skip"):
            for e in entries:
                e["qa_skip"] = job["qa_skip"]
        return entries

    if kind == "procedural":
        return finish(proc_generate(job))

    if kind == "image":
        # 대형 이미지(홈 키아트/바닥 타일): 크로마키·격자 스냅 다운스케일 없이
        # 그대로 사용. 도트밀도/아웃라인 등 캐릭터용 §2.2 기준이 부적합하므로
        # batch config의 qa_skip으로 항목별 면제하고 필요한 검사만 남긴다.
        img = Image.open(raw_path).convert("RGBA")
        if job.get("resize_to"):
            s = job["resize_to"]
            img = img.resize((s, s), Image.NEAREST)
        arr = np.asarray(img)
        if job.get("quantize"):
            arr = quantize_to_palette(arr, palette)
        out = job["outputs"][0]
        Image.fromarray(arr).save(GEN_DIR / out)
        return finish([{"id": job["id"], "file": out, "kind": "image",
                        "native": arr.shape[1], "frames": 1,
                        "frame_w": arr.shape[1], "frame_h": arr.shape[0]}])

    arr = np.asarray(Image.open(raw_path).convert("RGBA"))
    keyed = chroma_key(arr)
    KEYED_DIR.mkdir(parents=True, exist_ok=True)
    Image.fromarray(keyed).save(KEYED_DIR / raw_path.name)

    cells = split_cells(keyed, job["cells"])
    sprites = [crop_sprite(c, job["id"], i) for i, c in enumerate(cells)]
    native = job["native"]
    entries: list[dict] = []

    if kind == "strip":
        # 프레임 간 캐릭터 크기 유지: 전 프레임 공통 스케일
        scale = native / max(max(s.shape[:2]) for s in sprites)
        frames = [trim(quantize_to_palette(grid_snap_downscale(s, scale), palette))
                  for s in sprites]
        strip, meta = compose_strip(frames, job.get("align", "bottom"))
        out = job["outputs"][0]
        Image.fromarray(strip).save(GEN_DIR / out)
        entry = {"id": job["id"], "file": out, "kind": "strip",
                 "native": native, "frames": job["cells"], **meta}
        if job.get("group"):  # 보스 개별 파트 스트립이 그룹에 소속되도록(선택)
            entry["group"] = job["group"]
        entries.append(entry)
    elif kind == "multi":
        # 한 번의 생성(1xN 시트)에서 여러 산출물(idle/walk 스트립 + 단일 프레임)로
        # 분배 — 보스처럼 여러 애니메이션이 같은 개체여야 할 때 정체성/크기 일관성
        # 보장. 전 셀 공통 스케일이라 파트별 최대 변은 job native보다 약간 작을 수
        # 있으므로 엔트리 native는 해당 파트의 실측 최대 변으로 기록한다
        # (도트밀도 QA는 그룹 전체로는 job native, 파트별로는 실측치로 정합).
        scale = native / max(max(s.shape[:2]) for s in sprites)
        frames_all = [trim(quantize_to_palette(grid_snap_downscale(s, scale), palette))
                      for s in sprites]
        for part in job["parts"]:
            sel = [frames_all[i] for i in part["cells"]]
            peak = max(max(f.shape[:2]) for f in sel)
            out = part["output"]
            if len(sel) == 1:
                final = trim_pad(sel[0])
                Image.fromarray(final).save(GEN_DIR / out)
                entries.append({"id": f"{job['id']}_{part['id']}", "group": job["id"],
                                "file": out, "kind": "single", "native": peak,
                                "frames": 1, "frame_w": final.shape[1],
                                "frame_h": final.shape[0]})
            else:
                strip, meta = compose_strip(sel, job.get("align", "bottom"))
                Image.fromarray(strip).save(GEN_DIR / out)
                entries.append({"id": f"{job['id']}_{part['id']}", "group": job["id"],
                                "file": out, "kind": "strip", "native": peak,
                                "frames": len(sel), **meta})
    else:  # family / single: 스프라이트별 독립 스케일 → 개별 파일
        # natives: 시트 내 산출물별 native가 다를 때(수집물/데코) 지정
        natives = job.get("natives") or [native] * len(job["outputs"])
        for i, (sprite, out) in enumerate(zip(sprites, job["outputs"])):
            scale = natives[i] / max(sprite.shape[:2])
            final = trim_pad(quantize_to_palette(grid_snap_downscale(sprite, scale), palette))
            Image.fromarray(final).save(GEN_DIR / out)
            entries.append({"id": f"{job['id']}_{i}" if job["kind"] == "family" else job["id"],
                            "group": job["id"], "file": out, "kind": job["kind"],
                            "native": natives[i], "frames": 1,
                            "frame_w": final.shape[1], "frame_h": final.shape[0]})
    return finish(entries)


# ---------------------------------------------------------------- QA / retry

def qa_entries(entries: list[dict], palette: np.ndarray) -> list[str]:
    """엔트리들 인라인 QA. 실패한 체크 이름 목록 반환(중복 제거)."""
    failed: list[str] = []
    for entry in entries:
        for name, (ok, detail) in asset_qa.run_checks(entry, palette).items():
            print(f"    {'ok  ' if ok else 'FAIL'} {entry['file']:<22} {name:<12} {detail}",
                  flush=True)
            if not ok and name not in failed:
                failed.append(name)
    return failed


# ---------------------------------------------------------------- contact sheet

def build_contact_sheet(manifest: dict, batch: str) -> Path:
    """docs/asset_review/batch-{batch}.html 생성 (상대경로 참조, self-contained)."""
    rel_gen = "../../public/assets/generated"
    rel_kv = "../keyvisuals"
    rows = []
    anim_css = []
    for e in manifest["assets"]:
        src = f"{rel_gen}/{e['file']}"
        img = Image.open(GEN_DIR / e["file"])
        w, h = img.size
        if e.get("kind") == "image":
            # 키아트/타일 같은 대형 이미지는 1x/2x/3x 확대가 무의미 → 축소 1장만
            rows.append(
                f'<section><h2>{e["id"]} <small>{e["file"]} · {w}x{h}'
                f' · attempts {e.get("attempts", "?")} · QA {e.get("qa", "?")}</small></h2>'
                f'<div class="row"><div class="cell"><img src="{src}"'
                f' style="max-width:640px" alt=""></div></div></section>'
            )
            continue
        scales = "".join(
            f'<div class="cell tile"><img src="{src}" style="width:{w*s}px" alt=""></div>'
            for s in (1, 2, 3)
        )
        anim = ""
        if e.get("frames", 1) > 1:
            fw, fh, n = e["frame_w"], e["frame_h"], e["frames"]
            anim_css.append(
                f".anim-{e['id']}{{width:{fw*3}px;height:{fh*3}px;"
                f"background:url('{src}') 0 0/{w*3}px {h*3}px no-repeat;"
                f"animation:walk-{e['id']} 0.6s steps({n}) infinite}}"
                f"@keyframes walk-{e['id']}{{to{{background-position:-{w*3}px 0}}}}"
            )
            anim = f'<div class="cell tile"><div class="anim-{e["id"]}"></div></div>'
        rows.append(
            f'<section><h2>{e["id"]} <small>{e["file"]} · native {e["native"]}px'
            f' · {w}x{h} · attempts {e.get("attempts", "?")} · QA {e.get("qa", "?")}'
            f"</small></h2><div class=\"row\">{scales}{anim}</div></section>"
        )
    html = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<title>Quiz Survivor - Asset Review batch-{batch}</title>
<style>
body{{background:#14141c;color:#e8e8f0;font-family:system-ui,sans-serif;margin:24px}}
h1{{font-size:20px}} h2{{font-size:15px;margin:8px 0}} small{{color:#9a9ab0;font-weight:400}}
section{{margin-bottom:28px}}
.row{{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}}
.cell{{padding:12px;border-radius:6px}}
.tile{{background:url('{rel_kv}/B3_pixel_tile.png') center/256px}}
img,.row div{{image-rendering:pixelated}}
.kv{{display:flex;gap:12px;flex-wrap:wrap}} .kv img{{width:31%;min-width:280px}}
{''.join(anim_css)}
</style></head><body>
<h1>Batch {batch} 콘택트시트 — 1x/2x/3x + 인게임 타일(B3) 배경{' + 애니메이션' if anim_css else ''}</h1>
<p>생성 {manifest['generated_at']} · 팔레트 {manifest['palette_size']}색 (B1+B2 추출) · 앵커 {', '.join(manifest['style_anchors'])}</p>
{''.join(rows)}
<section><h2>스타일 앵커 (키비주얼과 나란히 비교)</h2><div class="kv">
<img src="{rel_kv}/B1_pixel_keyvisual.png" alt="B1">
<img src="{rel_kv}/B2_pixel_lineup.png" alt="B2">
<img src="{rel_kv}/B3_pixel_tile.png" alt="B3">
</div></section>
</body></html>
"""
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    out = REVIEW_DIR / f"batch-{batch}.html"
    out.write_text(html, encoding="utf-8")
    return out


# ---------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=str(ROOT / "scripts" / "batches" / "batch_3a.json"))
    ap.add_argument("--only", help="job id filter")
    ap.add_argument("--reuse-raw", action="store_true",
                    help="attempt 1 raw가 있으면 생성 생략(후처리 디버깅용)")
    args = ap.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    jobs = [j for j in config["jobs"] if not args.only or j["id"] == args.only]
    if not jobs:
        sys.exit(f"no jobs matched --only {args.only}")
    max_attempts = config.get("max_attempts", 3)

    api_key = load_api_key()
    palette = asset_qa.load_master_palette()
    print(f"[palette] {len(palette)} colors (cache: {asset_qa.PALETTE_PATH.name})", flush=True)
    anchor_urls = ensure_anchor_urls(api_key, config["anchors"])
    anchors = [anchor_urls[n] for n in config["anchors"]]
    identity = ensure_identity_urls(api_key, jobs)

    results: dict[str, dict] = {}  # job id -> {"entries": [...], "attempts": n, "qa": str}
    pending: list[dict] = list(jobs)
    hints: dict[str, list[str]] = {j["id"]: [] for j in jobs}

    for attempt in range(1, max_attempts + 1):
        if not pending:
            break
        print(f"--- attempt {attempt}: {[j['id'] for j in pending]}", flush=True)
        # (job, task_id, create_err): reuse-raw면 task_id=None,
        # createTask 실패도 잡 단위 실패로 격리 (배치 전체 중단 금지)
        tasks: list[tuple[dict, str | None, Exception | None]] = []
        for job in pending:
            if job["kind"] == "procedural":  # 로컬 생성 — API 불필요
                tasks.append((job, None, None))
                continue
            raw = RAW_DIR / f"{job['id']}_a{attempt}.png"
            if args.reuse_raw and raw.exists():
                tasks.append((job, None, None))
                continue
            try:
                job_anchors = anchors + identity.get(job["id"], [])
                tasks.append((job, create_task(api_key, job, job_anchors, hints[job["id"]]), None))
            except JOB_ERRORS as exc:
                tasks.append((job, None, exc))
            time.sleep(1)

        still_failing: list[dict] = []
        for job, task_id, create_err in tasks:
            raw = RAW_DIR / f"{job['id']}_a{attempt}.png"
            try:
                if create_err is not None:
                    raise PipelineError(f"createTask: {create_err}")
                if task_id is not None:
                    urls = poll_task(api_key, job["id"], task_id)
                    if not urls:
                        raise RuntimeError("empty resultUrls")
                    download(urls[0], raw)
                entries = postprocess(job, raw, palette)
                failed = qa_entries(entries, palette)
            except JOB_ERRORS as exc:
                print(f"[FAIL ] {job['id']} attempt {attempt}: {exc}", flush=True)
                entries, failed = [], ["pipeline"]
            if failed:
                hints[job["id"]] = [RETRY_HINTS[f] for f in failed if f in RETRY_HINTS]
                still_failing.append(job)
            results[job["id"]] = {
                "entries": entries, "attempts": attempt,
                "qa": "pass" if not failed else "fail:" + ",".join(failed),
            }
        pending = still_failing

    # manifest — 전 배치 누적 (Phase 3C가 이 매니페스트로 게임에 로드).
    # 이번 실행에서 성공한 잡의 기존 엔트리만 교체하고, 실패(SKIPPED) 잡의
    # 이전 성공 엔트리는 보존한다.
    assets = []
    for job in jobs:
        r = results[job["id"]]
        for e in r["entries"]:
            assets.append({**e, "attempts": r["attempts"], "qa": r["qa"]})
    manifest_path = GEN_DIR / "manifest.json"
    prev_assets: list[dict] = []
    prev_batches: list[str] = []
    if manifest_path.exists():
        prev = json.loads(manifest_path.read_text(encoding="utf-8"))
        prev_assets = prev.get("assets", [])
        prev_batches = prev.get("batches") or ([prev["batch"]] if prev.get("batch") else [])
    succeeded = {jid for jid, r in results.items() if r["entries"]}
    new_files = {e["file"] for e in assets}
    kept = [e for e in prev_assets
            if e["file"] not in new_files
            and e.get("group", e["id"]) not in succeeded and e["id"] not in succeeded]
    batches = prev_batches + ([config["batch"]] if config["batch"] not in prev_batches else [])
    manifest = {
        "batch": config["batch"],
        "batches": batches,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "style_anchors": config["anchors"],
        "palette_size": len(palette),
        "assets": kept + assets,
    }
    GEN_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    # 콘택트시트는 서브배치 단위 리뷰용 → 이번 배치 산출물만 담는다
    sheet = build_contact_sheet({**manifest, "assets": assets}, config["batch"])
    print(f"[sheet] {sheet}", flush=True)

    bad = {jid: r["qa"] for jid, r in results.items() if r["qa"] != "pass"}
    print("=" * 48, flush=True)
    if bad:
        print(f"pipeline finished with failures after {max_attempts} attempts: {bad}", flush=True)
        sys.exit(1)
    print(f"pipeline complete: {len(jobs)} job(s), {len(assets)} asset file(s) all pass", flush=True)


if __name__ == "__main__":
    main()
