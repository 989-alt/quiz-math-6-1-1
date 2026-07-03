# -*- coding: utf-8 -*-
"""kie.ai gpt-image-2로 아트 스타일 A/B 키비주얼 생성.

스타일 A: 공책 낙서 (notebook doodle)
스타일 B: 픽셀아트 (pixel art)
각 3장: 전투 키비주얼(16:9) / 캐릭터+몬스터 라인업(3:2) / 바닥 타일(1:1)

사용: python scripts/gen_keyvisuals.py
키: 프로젝트 루트 .env.kie 에서 로드 (커밋 금지)
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs" / "keyvisuals"
CREATE_URL = "https://api.kie.ai/api/v1/jobs/createTask"
QUERY_URL = "https://api.kie.ai/api/v1/jobs/recordInfo"
MODEL = "gpt-image-2-text-to-image"


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


STYLE_A_BASE = (
    "Hand-drawn crayon and colored-pencil doodle style, as if drawn by hand in a "
    "school math notebook. Wobbly imperfect outlines, visible crayon texture, "
    "bright cheerful colors on paper. Absolutely no letters, no words, no numbers. "
    "Kid-friendly, cute, elementary school aesthetic."
)

STYLE_B_BASE = (
    "High-quality 16-bit pixel art, crisp pixel grid, limited palette, "
    "SNES-era JRPG style. Absolutely no letters, no words, no numbers. "
    "Kid-friendly, cute, colorful."
)

JOBS: list[dict[str, str]] = [
    {
        "name": "A1_doodle_keyvisual",
        "aspect_ratio": "16:9",
        "prompt": (
            f"{STYLE_A_BASE} Top-down view of a survival game battle scene set on "
            "squared graph notebook paper. In the center, a cute brave elementary "
            "school student character holding a giant yellow pencil like a sword. "
            "Surrounding the student from all directions, a horde of funny scribble "
            "doodle monsters: round crayon blob monsters with googly eyes, a zigzag "
            "scribble ghost, a triangle-bodied imp, drawn in different crayon colors. "
            "A banana boomerang and a paper airplane fly through the air as projectiles. "
            "Small doodle stars, sparkles and eraser-shaving particles show impacts. "
            "A few faint pencil sketch lines and a coffee stain on the paper background."
        ),
    },
    {
        "name": "A2_doodle_lineup",
        "aspect_ratio": "3:2",
        "prompt": (
            f"{STYLE_A_BASE} Character design sheet on squared graph notebook paper: "
            "a lineup of five separate characters standing in a row, evenly spaced, "
            "full body, facing the viewer. From left to right: (1) a cute elementary "
            "school student hero holding a big pencil, (2) a small round crayon blob "
            "monster with googly eyes, (3) a wobbly zigzag scribble ghost monster, "
            "(4) a spiky triangle doodle imp monster, (5) a large boss monster drawn "
            "as a messy dark scribble tornado with angry eyes. Each character isolated "
            "with clear space around it, consistent doodle style."
        ),
    },
    {
        "name": "A3_doodle_tile",
        "aspect_ratio": "1:1",
        "prompt": (
            "Seamless repeating texture of squared graph notebook paper, light "
            "cream-white paper with soft blue-gray grid lines, subtle paper fiber "
            "texture, a few extremely faint pencil smudges. Perfectly tileable, "
            "uniform lighting, no shadows, no vignette, flat top-down view. "
            "No letters, no words, no numbers, no drawings other than the grid."
        ),
    },
    {
        "name": "B1_pixel_keyvisual",
        "aspect_ratio": "16:9",
        "prompt": (
            f"{STYLE_B_BASE} Top-down view of a survival game battle scene in a "
            "magical night forest. In the center, a cute brave elementary school "
            "student adventurer character with a small red cape, brightly lit. "
            "Surrounding the student from all directions, a horde of cute slime "
            "monsters and small goblin creatures in bright green, purple and red. "
            "A banana boomerang and a yellow pencil fly through the air as glowing "
            "projectiles. Small glowing blue experience gems scattered on the ground. "
            "The forest floor is dark and muted so the bright characters stand out. "
            "Purple mushrooms and glowing plants as decoration."
        ),
    },
    {
        "name": "B2_pixel_lineup",
        "aspect_ratio": "3:2",
        "prompt": (
            f"{STYLE_B_BASE} Pixel art character design sheet on a plain dark "
            "background: a lineup of five separate game sprites standing in a row, "
            "evenly spaced, full body, facing the viewer. From left to right: "
            "(1) a cute elementary school student hero with a red cape holding a big "
            "pencil, (2) a round green slime monster, (3) a purple bat monster, "
            "(4) a small orange goblin monster, (5) a large boss ogre monster. "
            "Each sprite isolated with clear space around it, consistent pixel "
            "resolution and palette across all five."
        ),
    },
    {
        "name": "B3_pixel_tile",
        "aspect_ratio": "1:1",
        "prompt": (
            "Seamless repeating 16-bit pixel art texture of a dark fantasy forest "
            "floor: muted dark green grass with subtle dirt patches and tiny leaves. "
            "Low contrast, no large objects, no landmarks, no rocks, no mushrooms. "
            "Perfectly tileable, uniform lighting, flat top-down view, crisp pixel "
            "grid. No letters, no words, no numbers."
        ),
    },
]


def api_call(url: str, api_key: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def create_task(api_key: str, job: dict[str, str]) -> str:
    body = {
        "model": MODEL,
        "input": {
            "prompt": job["prompt"],
            "aspect_ratio": job["aspect_ratio"],
            "resolution": "1K",
        },
    }
    res = api_call(CREATE_URL, api_key, body)
    if res.get("code") != 200:
        raise RuntimeError(f"createTask failed for {job['name']}: {res}")
    task_id = res["data"]["taskId"]
    print(f"[create] {job['name']} -> {task_id}", flush=True)
    return task_id


def poll_task(api_key: str, name: str, task_id: str, timeout_s: int = 600) -> list[str]:
    start = time.time()
    while time.time() - start < timeout_s:
        res = api_call(f"{QUERY_URL}?taskId={task_id}", api_key)
        state = res.get("data", {}).get("state", "?")
        if state == "success":
            result = json.loads(res["data"]["resultJson"])
            urls = result.get("resultUrls", [])
            print(f"[done ] {name} ({int(time.time() - start)}s)", flush=True)
            return urls
        if state == "fail":
            raise RuntimeError(
                f"{name} failed: {res['data'].get('failCode')} {res['data'].get('failMsg')}"
            )
        time.sleep(6)
    raise TimeoutError(f"{name} timed out after {timeout_s}s")


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        dest.write_bytes(resp.read())
    print(f"[save ] {dest.name} ({dest.stat().st_size // 1024} KB)", flush=True)


def main() -> None:
    api_key = load_api_key()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    tasks: list[tuple[dict[str, str], str]] = []
    for job in JOBS:
        tasks.append((job, create_task(api_key, job)))
        time.sleep(1)

    failures: list[str] = []
    for job, task_id in tasks:
        try:
            urls = poll_task(api_key, job["name"], task_id)
            if urls:
                download(urls[0], OUT_DIR / f"{job['name']}.png")
            else:
                failures.append(f"{job['name']}: empty resultUrls")
        except Exception as exc:  # noqa: BLE001 - 개별 실패는 기록 후 계속
            failures.append(f"{job['name']}: {exc}")
            print(f"[FAIL ] {job['name']}: {exc}", flush=True)

    print("=" * 40, flush=True)
    if failures:
        print(f"completed with {len(failures)} failure(s):", flush=True)
        for f in failures:
            print(f"  - {f}", flush=True)
        sys.exit(1)
    print(f"all {len(tasks)} keyvisuals saved to {OUT_DIR}", flush=True)


if __name__ == "__main__":
    main()
