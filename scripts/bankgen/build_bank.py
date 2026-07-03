# -*- coding: utf-8 -*-
"""문제은행 병합 + 전수 검증 + 최종 JSON 빌드.

입력: out/template_items.json (계산형 205) + out/authored_items.json (문장제·개념 95)
검증: 스키마 / 보기 4개·중복 없음 / 정답 재계산(meta) / 기약분수 / 범위 가드 /
      문항 중복 / correctIndex 재균형(4방향 균등)
출력: src/data/banks/math/g6-1-1.json (ensure_ascii)

사용: python scripts/bankgen/build_bank.py
"""
from __future__ import annotations

import json
import random
import re
import sys
from fractions import Fraction
from math import gcd
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
TEMPLATE = HERE / "out" / "template_items.json"
AUTHORED = HERE / "out" / "authored_items.json"
FINAL = ROOT / "src" / "data" / "banks" / "math" / "g6-1-1.json"

UNIT_META = {
    "unitId": "g6-1-1",
    "subject": "math",
    "grade": 6,
    "semester": 1,
    "unitNumber": 1,
    "title": "분수의 나눗셈",
}

MIXED_RE = re.compile(r"^\{(\d+) (\d+)/(\d+)\}$")
FRAC_RE = re.compile(r"^\{(\d+)/(\d+)\}$")
INT_RE = re.compile(r"^\d+$")
INLINE_FRAC_RE = re.compile(r"\{(\d+)(?: (\d+))?/(\d+)\}")

errors: list[str] = []
warnings: list[str] = []


def parse_value(s: str) -> Fraction | None:
    """보기 문자열 → 수치 (분수 마크업/정수만). 그 외 텍스트는 None."""
    s = s.strip()
    m = MIXED_RE.match(s)
    if m:
        w, r, b = int(m[1]), int(m[2]), int(m[3])
        if b == 0:
            return None
        return Fraction(w * b + r, b)
    m = FRAC_RE.match(s)
    if m:
        a, b = int(m[1]), int(m[2])
        if b == 0:
            return None
        return Fraction(a, b)
    if INT_RE.match(s):
        return Fraction(int(s))
    return None


def check_reduced(s: str, item_id: str) -> None:
    """분수 마크업 정답이 기약·정규형인지."""
    m = MIXED_RE.match(s.strip())
    if m:
        w, r, b = int(m[1]), int(m[2]), int(m[3])
        if r >= b:
            errors.append(f"{item_id}: 대분수 분수부가 가분수 {s}")
        if gcd(r, b) != 1:
            errors.append(f"{item_id}: 대분수 분수부 미약분 {s}")
        return
    m = FRAC_RE.match(s.strip())
    if m:
        a, b = int(m[1]), int(m[2])
        if gcd(a, b) != 1:
            errors.append(f"{item_id}: 미약분 분수 {s}")


def validate_markup(text: str, item_id: str, where: str) -> None:
    """중괄호 마크업 문법 오류 탐지 (홀수 중괄호, 잘못된 형식)."""
    if text.count("{") != text.count("}"):
        errors.append(f"{item_id}: {where} 중괄호 불일치: {text[:60]}")
    for m in re.finditer(r"\{[^}]*\}", text):
        tok = m.group(0)
        if not (FRAC_RE.match(tok) or MIXED_RE.match(tok)):
            errors.append(f"{item_id}: {where} 잘못된 분수 마크업 {tok}")


def validate_item(it: dict) -> bool:
    iid = it.get("id", "<no-id>")
    ok = True
    for field in ("id", "type", "difficulty", "question", "options", "correctIndex", "explanation"):
        if field not in it or it[field] in (None, ""):
            errors.append(f"{iid}: 필드 누락 {field}")
            ok = False
    if not ok:
        return False
    if it["type"] not in ("calc", "word", "concept"):
        errors.append(f"{iid}: type 오류 {it['type']}")
    if it["difficulty"] not in (1, 2, 3):
        errors.append(f"{iid}: difficulty 오류")
    opts = it["options"]
    if len(opts) != 4 or len(set(opts)) != 4:
        errors.append(f"{iid}: 보기 4개/중복 오류 {opts}")
        return False
    if not (0 <= it["correctIndex"] <= 3):
        errors.append(f"{iid}: correctIndex 범위 오류")
        return False

    validate_markup(it["question"], iid, "question")
    for o in opts:
        validate_markup(o, iid, "option")
    validate_markup(it["explanation"], iid, "explanation")

    # 값 중복 (서로 다른 표기의 동치 보기 → 정답 2개 해석 위험)
    vals = [parse_value(o) for o in opts]
    parsed = [v for v in vals if v is not None]
    if len(parsed) >= 2 and len(set(parsed)) != len(parsed):
        errors.append(f"{iid}: 동치 보기 존재 {opts}")

    # 정답 기약분수
    check_reduced(opts[it["correctIndex"]], iid)

    # meta 재계산
    meta = it.get("meta") or {}
    if meta.get("dividend") and meta.get("divisor"):
        dv = parse_value(str(meta["dividend"]))
        ds = parse_value(str(meta["divisor"]))
        cv = parse_value(opts[it["correctIndex"]])
        if dv is None or ds is None or ds == 0:
            errors.append(f"{iid}: meta 파싱 실패 {meta}")
        elif cv is None:
            # 정답이 수치가 아닌 문항(식 고르기 등)은 재계산 생략
            warnings.append(f"{iid}: 정답이 수치가 아니라 meta 재계산 생략")
        elif dv / ds != cv:
            errors.append(f"{iid}: 정답 재계산 불일치 {meta} → {dv / ds} ≠ {cv}")

    # 범위 가드: 소수/분수÷분수 금지
    if re.search(r"\d\.\d", it["question"]):
        errors.append(f"{iid}: 소수 등장(범위 밖)")
    if meta.get("divisor") and not INT_RE.match(str(meta["divisor"]).strip()):
        errors.append(f"{iid}: 제수가 자연수가 아님(범위 밖) {meta}")

    return True


def rebalance_correct_index(items: list[dict]) -> None:
    """correctIndex 4방향 균등 재배치 (보기 순서 재셔플)."""
    rng = random.Random(6111)
    counts = [0, 0, 0, 0]
    for it in items:
        correct = it["options"][it["correctIndex"]]
        others = [o for i, o in enumerate(it["options"]) if i != it["correctIndex"]]
        rng.shuffle(others)
        target = counts.index(min(counts))
        new_opts = others[:target] + [correct] + others[target:]
        it["options"] = new_opts
        it["correctIndex"] = target
        counts[target] += 1


def main() -> None:
    template = json.loads(TEMPLATE.read_text(encoding="utf-8"))
    authored = []
    if AUTHORED.exists():
        authored = json.loads(AUTHORED.read_text(encoding="utf-8"))
    else:
        warnings.append("authored_items.json 없음 — 템플릿 문항만으로 빌드")

    all_items = template + authored

    # 개별 검증
    for it in all_items:
        validate_item(it)

    # id/문항 중복
    ids = [it["id"] for it in all_items]
    if len(set(ids)) != len(ids):
        dupes = {i for i in ids if ids.count(i) > 1}
        errors.append(f"id 중복: {dupes}")
    qkeys: dict[str, str] = {}
    for it in all_items:
        key = re.sub(r"\s+", "", it["question"]) + "|" + "|".join(sorted(it["options"]))
        if key in qkeys:
            errors.append(f"문항 중복: {it['id']} == {qkeys[key]}")
        else:
            qkeys[key] = it["id"]

    # 재균형 (검증 통과 후 순서 조작)
    rebalance_correct_index(all_items)

    # 리포트
    from collections import Counter
    n = len(all_items)
    by_diff = Counter(it["difficulty"] for it in all_items)
    by_type = Counter(it["type"] for it in all_items)
    by_ci = Counter(it["correctIndex"] for it in all_items)
    print(f"items: {n} (template {len(template)} + authored {len(authored)})")
    print(f"difficulty: {dict(sorted(by_diff.items()))}")
    print(f"type: {dict(by_type)}")
    print(f"correctIndex: {dict(sorted(by_ci.items()))}")
    for w in warnings[:10]:
        print(f"[warn] {w}")
    if len(warnings) > 10:
        print(f"[warn] ... 외 {len(warnings) - 10}건")
    if errors:
        print(f"\n[FAIL] {len(errors)} error(s):")
        for e in errors[:30]:
            print(f"  - {e}")
        if len(errors) > 30:
            print(f"  ... 외 {len(errors) - 30}건")
        sys.exit(1)

    if n != 300:
        print(f"[warn] 문항 수 {n} ≠ 300")

    # 최종 출력 (meta 제거, ensure_ascii)
    quizzes = [{k: it[k] for k in
                ("id", "type", "difficulty", "question", "options", "correctIndex", "explanation")}
               for it in all_items]
    bank = dict(UNIT_META)
    bank["quizCount"] = n
    bank["quizzes"] = quizzes
    FINAL.parent.mkdir(parents=True, exist_ok=True)
    FINAL.write_text(json.dumps(bank, ensure_ascii=True, separators=(",", ":")), encoding="utf-8")
    print(f"\n[OK] wrote {FINAL} ({FINAL.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
