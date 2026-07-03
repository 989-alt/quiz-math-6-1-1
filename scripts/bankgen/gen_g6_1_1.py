# -*- coding: utf-8 -*-
"""수학 6-1-1 「분수의 나눗셈」 계산형 문항 결정적 생성기.

차시 유형: T1 (자÷자, 몫<1) / T2 (자÷자, 몫>1) / T3 (분수÷자) /
T4 (곱셈으로 나타내기) / T5 (대분수÷자) / T7t (옳은 계산 고르기 등 템플릿형)
총 205문. 시드 고정 → 재현 가능. 출력: scripts/bankgen/out/template_items.json

사용: python scripts/bankgen/gen_g6_1_1.py
"""
from __future__ import annotations

import json
import random
from fractions import Fraction
from itertools import product
from math import gcd
from pathlib import Path

OUT = Path(__file__).parent / "out" / "template_items.json"
rng = random.Random(20260702)


# ---------- 분수 마크업 포매터 ----------

def frac_str(fr: Fraction) -> str:
    """가분수/진분수 마크업. 정수면 그냥 숫자."""
    if fr.denominator == 1:
        return str(fr.numerator)
    return f"{{{fr.numerator}/{fr.denominator}}}"


def mixed_str(fr: Fraction) -> str:
    """대분수 마크업. 1 미만이면 진분수, 정수면 숫자."""
    if fr.denominator == 1:
        return str(fr.numerator)
    w, r = divmod(fr.numerator, fr.denominator)
    if w == 0:
        return f"{{{r}/{fr.denominator}}}"
    return f"{{{w} {r}/{fr.denominator}}}"


_FINAL_CONSONANT_DIGITS = {"0", "1", "3", "6", "7", "8"}  # 영일삼육칠팔 = 받침 O


def eul(n: int) -> str:
    """숫자 뒤 목적격 조사: 을/를."""
    return "을" if str(n)[-1] in _FINAL_CONSONANT_DIGITS else "를"


def i_ga(n: int) -> str:
    """숫자 뒤 주격 조사: 이/가."""
    return "이" if str(n)[-1] in _FINAL_CONSONANT_DIGITS else "가"


def raw_mixed(w: int, r: int, b: int) -> str:
    """검증 없이 대분수 문자열 생성 (오답 보기용)."""
    if r == 0:
        return str(w)
    if w == 0:
        return f"{{{r}/{b}}}"
    return f"{{{w} {r}/{b}}}"


# ---------- 문항 빌더 ----------

items: list[dict] = []
_seq: dict[str, int] = {}


def add_item(t: str, difficulty: int, question: str, correct: str,
             distractors: list[str], explanation: str, meta: dict | None = None) -> None:
    """보기 중복 제거 후 셔플, 문항 추가. 중복 값 보기가 있으면 예외."""
    opts = [correct] + distractors
    if len(set(opts)) != 4:
        raise ValueError(f"duplicate options: {opts} @ {question}")
    order = list(range(4))
    rng.shuffle(order)
    shuffled = [opts[i] for i in order]
    correct_index = shuffled.index(correct)
    _seq[t] = _seq.get(t, 0) + 1
    items.append({
        "id": f"g6-1-1-{t}-{_seq[t]:03d}",
        "type": "calc",
        "difficulty": difficulty,
        "question": question,
        "options": shuffled,
        "correctIndex": correct_index,
        "explanation": explanation,
        "meta": meta or {},
    })


def distinct_values(cands: list[tuple[str, Fraction | None]], correct_value: Fraction | None,
                    correct_str: str, need: int = 3) -> list[str]:
    """정답과 값·문자열이 모두 다른 오답 need개 선별."""
    out: list[str] = []
    seen_vals = {correct_value} if correct_value is not None else set()
    seen_strs = {correct_str}
    for s, v in cands:
        if s in seen_strs:
            continue
        if v is not None and v in seen_vals:
            continue
        out.append(s)
        seen_strs.add(s)
        if v is not None:
            seen_vals.add(v)
        if len(out) == need:
            return out
    raise ValueError(f"not enough distractors for {correct_str}")


# ---------- T1: (자연수)÷(자연수), 몫 < 1 (40문) ----------

def gen_t1() -> None:
    pool = [(a, b) for a, b in product(range(1, 6), range(3, 13))
            if a < b and gcd(a, b) == 1]
    picks = rng.sample(pool, 16)
    for a, b in picks:  # d1: 몫을 분수로 (16)
        correct = frac_str(Fraction(a, b))
        cands = [
            (frac_str(Fraction(b, a)), Fraction(b, a)),          # 뒤집기
            (frac_str(Fraction(a, b + 1)), Fraction(a, b + 1)),  # 분모 실수
            (frac_str(Fraction(a + 1, b)), Fraction(a + 1, b)),  # 분자 실수
            (frac_str(Fraction(max(1, b - a), b)), Fraction(max(1, b - a), b)),
        ]
        ds = distinct_values(cands, Fraction(a, b), correct)
        add_item("t1", 1, f"{a}÷{b}의 몫을 분수로 나타내면?", correct, ds,
                 f"(자연수)÷(자연수)의 몫은 나누어지는 수를 분자, 나누는 수를 분모로 하는 분수로 나타낼 수 있습니다. {a}÷{b}={frac_str(Fraction(a, b))}",
                 {"dividend": str(a), "divisor": str(b)})

    # d2: 몫이 1보다 작은 나눗셈 고르기 (8) — 보기는 나눗셈식
    small_pool = [(a, b) for a, b in product(range(1, 8), range(2, 13)) if a < b and gcd(a, b) == 1]
    big_pool = [(a, b) for a, b in product(range(3, 20), range(2, 9)) if a > b]
    used: set[tuple] = set()
    for _ in range(8):
        while True:
            sa, sb = rng.choice(small_pool)
            bigs = rng.sample(big_pool, 3)
            key = (sa, sb, tuple(bigs))
            if key not in used:
                used.add(key)
                break
        correct = f"{sa}÷{sb}"
        ds = [f"{a}÷{b}" for a, b in bigs]
        if len(set([correct] + ds)) != 4:
            continue
        add_item("t1", 2, "몫이 1보다 작은 나눗셈은 어느 것일까요?", correct, ds,
                 f"나누어지는 수가 나누는 수보다 작으면 몫이 1보다 작습니다. {sa}<{sb}이므로 {correct}의 몫은 1보다 작습니다.")

    # d2 추가: 옳게 나타낸 식 고르기 (8)
    picks2 = rng.sample([p for p in pool if p not in picks], 8)
    for a, b in picks2:
        correct = f"{a}÷{b}={frac_str(Fraction(a, b))}"
        ds = [
            f"{a}÷{b}={frac_str(Fraction(b, a))}",
            f"{b}÷{a}={frac_str(Fraction(a, b))}",
            f"{a}÷{b}={frac_str(Fraction(a, a + b))}",
        ]
        add_item("t1", 2, "나눗셈의 몫을 분수로 옳게 나타낸 것은?", correct, ds,
                 f"나누어지는 수 {a}가 분자, 나누는 수 {b}가 분모가 됩니다. {a}÷{b}={frac_str(Fraction(a, b))}")

    # d3: ▢÷b = a/b 역산 (8)
    picks3 = rng.sample(pool, 8)
    for a, b in picks3:
        correct = str(a)
        ds = distinct_values(
            [(str(b), Fraction(b)), (str(a + b), Fraction(a + b)), (str(b - a), Fraction(b - a)),
             (str(a + 1), Fraction(a + 1))],
            Fraction(a), correct)
        add_item("t1", 3, f"▢÷{b}의 몫이 {frac_str(Fraction(a, b))}일 때, ▢에 알맞은 수는?",
                 correct, ds,
                 f"몫 {frac_str(Fraction(a, b))}에서 분자 {a}{i_ga(a)} 나누어지는 수입니다. {a}÷{b}={frac_str(Fraction(a, b))}")


# ---------- T2: (자연수)÷(자연수), 몫 > 1 (40문) ----------

def gen_t2() -> None:
    pool = [(a, b) for a, b in product(range(3, 26), range(2, 10))
            if a > b and a % b != 0 and gcd(a, b) == 1]
    picks = rng.sample(pool, 16)
    for a, b in picks:  # d1: 가분수로 (16)
        correct = frac_str(Fraction(a, b))
        cands = [
            (frac_str(Fraction(b, a)), Fraction(b, a)),
            (frac_str(Fraction(a + 1, b)), Fraction(a + 1, b)),
            (frac_str(Fraction(a, b + 1)), Fraction(a, b + 1)),
            (frac_str(Fraction(a - 1, b)), Fraction(a - 1, b)),
        ]
        ds = distinct_values(cands, Fraction(a, b), correct)
        add_item("t2", 1, f"{a}÷{b}의 몫을 가분수로 나타내면?", correct, ds,
                 f"나누어지는 수 {a}를 분자, 나누는 수 {b}를 분모로 하면 {a}÷{b}={correct}입니다.",
                 {"dividend": str(a), "divisor": str(b)})

    picks2 = rng.sample([p for p in pool if p not in picks], 16)
    for a, b in picks2:  # d2: 대분수로 (16)
        fr = Fraction(a, b)
        w, r = divmod(a, b)
        correct = mixed_str(fr)
        cand_strs = []
        if r + 1 <= b - 1:
            cand_strs.append(raw_mixed(w, r + 1, b))
        if r - 1 >= 1:
            cand_strs.append(raw_mixed(w, r - 1, b))
        cand_strs.append(raw_mixed(w + 1, r, b))
        if w - 1 >= 1:
            cand_strs.append(raw_mixed(w - 1, r, b))
        cand_strs.append(raw_mixed(w, r, b + 1))
        cand_strs.append(frac_str(Fraction(b, a)))
        cands = [(s, None) for s in cand_strs]
        ds = distinct_values(cands, None, correct)
        add_item("t2", 2, f"{a}÷{b}의 몫을 대분수로 나타내면?", correct, ds,
                 f"{a}÷{b}={frac_str(fr)}이고, {a}={b}×{w}+{r}이므로 대분수로 나타내면 {correct}입니다.",
                 {"dividend": str(a), "divisor": str(b)})

    # d3: 몫 크기 비교 (4)
    used: set[tuple] = set()
    cnt = 0
    while cnt < 4:
        (a, b), (c, d) = rng.sample(pool, 2)
        if Fraction(a, b) == Fraction(c, d) or (a, b, c, d) in used:
            continue
        used.add((a, b, c, d))
        bigger = f"{a}÷{b}" if Fraction(a, b) > Fraction(c, d) else f"{c}÷{d}"
        smaller = f"{c}÷{d}" if bigger == f"{a}÷{b}" else f"{a}÷{b}"
        add_item("t2", 3, f"{a}÷{b}와 {c}÷{d} 중 몫이 더 큰 나눗셈은?", bigger,
                 [smaller, "두 몫이 같다", "비교할 수 없다"],
                 f"{a}÷{b}={mixed_str(Fraction(a, b))}, {c}÷{d}={mixed_str(Fraction(c, d))}이므로 {bigger}의 몫이 더 큽니다.")
        cnt += 1

    # d3: ▢ 역산 (4)
    picks3 = rng.sample(pool, 4)
    for a, b in picks3:
        correct = str(b)
        ds = distinct_values(
            [(str(n2), Fraction(n2)) for n2 in [a, b + 1, b - 1, b + 2, a - b, a + b] if n2 >= 1],
            Fraction(b), correct)
        add_item("t2", 3, f"{a}÷▢의 몫이 {mixed_str(Fraction(a, b))}일 때, ▢에 알맞은 수는?",
                 correct, ds,
                 f"{mixed_str(Fraction(a, b))}={frac_str(Fraction(a, b))}이므로 나누는 수는 분모인 {b}입니다.")


# ---------- T3: (분수)÷(자연수) (40문) ----------

def gen_t3() -> None:
    # d1: 분자가 나누어떨어지는 경우 (16)
    pool_a = []
    for k, c, b in product(range(1, 6), range(2, 6), range(5, 16)):
        a = k * c
        if a < b and gcd(a, b) == 1 and gcd(k, b) == 1 and k >= 1:
            pool_a.append((a, b, c, k))
    picks = rng.sample(pool_a, 16)
    for a, b, c, k in picks:
        q_fr = Fraction(a, b)
        ans = Fraction(k, b)
        correct = frac_str(ans)
        cands = [
            (frac_str(Fraction(a * c, b)), Fraction(a * c, b)),      # 곱한 실수
            (frac_str(Fraction(k, b * c)), Fraction(k, b * c)),      # 분모까지 나눔
            (frac_str(Fraction(a, b)), Fraction(a, b)),              # 그대로
            (frac_str(Fraction(b, a * c)), Fraction(b, a * c)),      # 뒤집기
        ]
        ds = distinct_values(cands, ans, correct)
        add_item("t3", 1, f"{frac_str(q_fr)}÷{c}{eul(c)} 계산하면?", correct, ds,
                 f"분자가 자연수로 나누어떨어지면 분자만 나눕니다. {a}÷{c}={k}이므로 {frac_str(q_fr)}÷{c}={correct}",
                 {"dividend": frac_str(q_fr), "divisor": str(c)})

    # d2: 나누어떨어지지 않는 경우 (16)
    pool_b = []
    for a, b, c in product(range(1, 10), range(2, 12), range(2, 7)):
        if a < b and gcd(a, b) == 1 and a % c != 0 and gcd(a, c) == 1 and gcd(a, b * c) == 1 and b * c <= 60:
            pool_b.append((a, b, c))
    picks2 = rng.sample(pool_b, 16)
    for a, b, c in picks2:
        q_fr = Fraction(a, b)
        ans = Fraction(a, b * c)
        correct = frac_str(ans)
        cands = [
            (frac_str(Fraction(a * c, b)), Fraction(a * c, b)),
            (frac_str(Fraction(a, b)), Fraction(a, b)),
            (frac_str(Fraction(b, a * c)), Fraction(b, a * c)),
            (frac_str(Fraction(a, b + c)), Fraction(a, b + c)),
        ]
        ds = distinct_values(cands, ans, correct)
        add_item("t3", 2, f"{frac_str(q_fr)}÷{c}{eul(c)} 계산하면?", correct, ds,
                 f"{frac_str(q_fr)}÷{c}={frac_str(q_fr)}×{{1/{c}}}={correct}입니다.",
                 {"dividend": frac_str(q_fr), "divisor": str(c)})

    # d3: ▢ 역산 (8)
    picks3 = rng.sample(pool_b, 8)
    for a, b, c in picks3:
        correct = str(c)
        ds = distinct_values(
            [(str(n2), Fraction(n2)) for n2 in [b, c + 1, c - 1, c + 2, b * c, b + c] if n2 >= 1],
            Fraction(c), correct)
        add_item("t3", 3,
                 f"{frac_str(Fraction(a, b))}÷▢={frac_str(Fraction(a, b * c))}일 때, ▢에 알맞은 수는?",
                 correct, ds,
                 f"분모가 {b}에서 {b * c}가 되었으므로 {b}×▢={b * c}, ▢={c}입니다.")


# ---------- T4: 분수의 곱셈으로 나타내기 (30문) ----------

def gen_t4() -> None:
    pool = [(a, b, c) for a, b, c in product(range(1, 10), range(2, 12), range(2, 8))
            if a < b and gcd(a, b) == 1]
    picks = rng.sample(pool, 12)
    for a, b, c in picks:  # d1: 곱셈식 고르기 (12)
        f = frac_str(Fraction(a, b))
        correct = f"{f}×{{1/{c}}}"
        ds = [f"{f}×{c}", f"{frac_str(Fraction(b, a))}×{{1/{c}}}", f"{f}÷{{1/{c}}}"]
        add_item("t4", 1, f"{f}÷{c}{eul(c)} 곱셈식으로 바르게 나타낸 것은?", correct, ds,
                 f"(분수)÷(자연수)는 자연수를 {{1/{c}}}로 바꾸어 곱합니다. {f}÷{c}={correct}")

    # d2: 곱셈으로 나타내어 계산 (12)
    pool2 = [(a, b, c) for a, b, c in product(range(1, 10), range(2, 12), range(2, 7))
             if a < b and gcd(a, b) == 1 and gcd(a, c) == 1 and gcd(a, b * c) == 1 and b * c <= 60]
    picks2 = rng.sample(pool2, 12)
    for a, b, c in picks2:
        f = frac_str(Fraction(a, b))
        ans = Fraction(a, b * c)
        correct = frac_str(ans)
        cands = [
            (frac_str(Fraction(a * c, b)), Fraction(a * c, b)),
            (frac_str(Fraction(a, b)), Fraction(a, b)),
            (frac_str(Fraction(c * a, b * c)), Fraction(c * a, b * c)),
            (frac_str(Fraction(a, b + c)), Fraction(a, b + c)),
        ]
        ds = distinct_values(cands, ans, correct)
        add_item("t4", 2, f"{f}÷{c}{eul(c)} 곱셈으로 나타내어 계산하면?", correct, ds,
                 f"{f}÷{c}={f}×{{1/{c}}}={correct}",
                 {"dividend": f, "divisor": str(c)})

    # d3: 잘못 나타낸 것 고르기 (6)
    picks3 = rng.sample(pool, 6)
    for a, b, c in picks3:
        f = frac_str(Fraction(a, b))
        wrong = f"{f}÷{c}={f}×{c}"
        others_pool = [p for p in pool if p != (a, b, c)]
        o = rng.sample(others_pool, 3)
        ds = [f"{frac_str(Fraction(x, y))}÷{z}={frac_str(Fraction(x, y))}×{{1/{z}}}" for x, y, z in o]
        add_item("t4", 3, "나눗셈을 곱셈으로 잘못 나타낸 것은?", wrong, ds,
                 f"(분수)÷(자연수)는 자연수의 역수 {{1/{c}}}를 곱해야 합니다. {f}×{c}는 잘못된 표현입니다.")


# ---------- T5: (대분수)÷(자연수) (40문) ----------

def gen_t5() -> None:
    # 파라미터: 대분수 w r/b, 나누는 수 c
    pool = []
    for w, b, r, c in product(range(1, 5), range(2, 9), range(1, 8), range(2, 6)):
        if r >= b or gcd(r, b) != 1:
            continue
        n = w * b + r
        if gcd(n, b * c) != 1 or b * c > 48:
            continue
        pool.append((w, r, b, c, n))

    # d1: 결과가 진분수 (16)
    d1_pool = [p for p in pool if p[4] < p[2] * p[3]]
    picks = rng.sample(d1_pool, 16)
    for w, r, b, c, n in picks:
        q = raw_mixed(w, r, b)
        ans = Fraction(n, b * c)
        correct = frac_str(ans)
        wrong_split = f"{{{w} {r}/{b * c}}}" if w > 0 else frac_str(Fraction(r, b * c))  # 자연수부 방치 실수
        cands = [
            (frac_str(Fraction(n, b)), Fraction(n, b)),        # ÷c 잊음
            (frac_str(Fraction(n * c, b)), Fraction(n * c, b)),  # 곱한 실수
            (wrong_split, None),
            (frac_str(Fraction(b * c, n)), Fraction(b * c, n)),  # 뒤집기
        ]
        ds = distinct_values(cands, ans, correct)
        add_item("t5", 1, f"{q}÷{c}{eul(c)} 계산하면?", correct, ds,
                 f"대분수를 가분수로 바꾸면 {q}={frac_str(Fraction(n, b))}입니다. {frac_str(Fraction(n, b))}÷{c}={frac_str(Fraction(n, b))}×{{1/{c}}}={correct}",
                 {"dividend": q, "divisor": str(c)})

    # d2: 결과가 1보다 큼 → 대분수로 (16)
    d2_pool = [p for p in pool if p[4] > p[2] * p[3] and p[4] % (p[2] * p[3]) != 0]
    picks2 = rng.sample(d2_pool, 16)
    for w, r, b, c, n in picks2:
        q = raw_mixed(w, r, b)
        ans = Fraction(n, b * c)
        correct = mixed_str(ans)
        aw, ar = divmod(ans.numerator, ans.denominator)
        ab = ans.denominator
        cand_strs = []
        if ar + 1 <= ab - 1:
            cand_strs.append(raw_mixed(aw, ar + 1, ab))
        if ar - 1 >= 1:
            cand_strs.append(raw_mixed(aw, ar - 1, ab))
        cand_strs.append(raw_mixed(aw + 1, ar, ab))
        if aw - 1 >= 1:
            cand_strs.append(raw_mixed(aw - 1, ar, ab))
        cand_strs.append(frac_str(Fraction(n, b)))
        cand_strs.append(raw_mixed(aw, ar, ab + 1))
        cands = [(s, None) for s in cand_strs]
        ds = distinct_values(cands, None, correct)
        add_item("t5", 2, f"{q}÷{c}의 몫을 대분수로 나타내면?", correct, ds,
                 f"{q}={frac_str(Fraction(n, b))}이므로 {frac_str(Fraction(n, b))}÷{c}={frac_str(ans)}={correct}입니다.",
                 {"dividend": q, "divisor": str(c)})

    # d3: ▢ 역산 (4) + 비교 (4)
    picks3 = rng.sample(d1_pool, 4)
    for w, r, b, c, n in picks3:
        q = raw_mixed(w, r, b)
        correct = str(c)
        ds = distinct_values(
            [(str(n2), Fraction(n2)) for n2 in [b, c + 1, c - 1, c + 2, b * c, b + c] if n2 >= 1],
            Fraction(c), correct)
        add_item("t5", 3, f"{q}÷▢={frac_str(Fraction(n, b * c))}일 때, ▢에 알맞은 수는?",
                 correct, ds,
                 f"{q}={frac_str(Fraction(n, b))}이고 분모가 {b}에서 {b * c}가 되었으므로 ▢={c}입니다.")

    used: set[tuple] = set()
    cnt = 0
    while cnt < 4:
        p1, p2 = rng.sample(pool, 2)
        v1 = Fraction(p1[4], p1[2] * p1[3])
        v2 = Fraction(p2[4], p2[2] * p2[3])
        if v1 == v2 or (p1, p2) in used:
            continue
        used.add((p1, p2))
        e1 = f"{raw_mixed(p1[0], p1[1], p1[2])}÷{p1[3]}"
        e2 = f"{raw_mixed(p2[0], p2[1], p2[2])}÷{p2[3]}"
        bigger = e1 if v1 > v2 else e2
        smaller = e2 if bigger == e1 else e1
        add_item("t5", 3, f"{e1}과 {e2} 중 몫이 더 큰 것은?", bigger,
                 [smaller, "두 몫이 같다", "비교할 수 없다"],
                 f"{e1}={frac_str(v1)}, {e2}={frac_str(v2)}이므로 {bigger}의 몫이 더 큽니다.")
        cnt += 1


# ---------- T7t: 옳은 계산 고르기 (15문, d2) ----------

def gen_t7t() -> None:
    # 옳은 식 1개 + 틀린 식 3개
    correct_pool = []
    for a, b, c in product(range(1, 8), range(2, 10), range(2, 6)):
        if a < b and gcd(a, b) == 1 and gcd(a, c) == 1 and gcd(a, b * c) == 1 and b * c <= 40:
            correct_pool.append((a, b, c))
    wrong_makers = [
        lambda a, b, c: f"{frac_str(Fraction(a, b))}÷{c}={frac_str(Fraction(a * c, b))}",
        lambda a, b, c: f"{a}÷{b}={frac_str(Fraction(b, a)) if a > 1 else str(b)}",
        lambda a, b, c: f"{frac_str(Fraction(a, b))}÷{c}={frac_str(Fraction(a, b))}",
    ]
    picks = rng.sample(correct_pool, 15)
    for i, (a, b, c) in enumerate(picks):
        correct = f"{frac_str(Fraction(a, b))}÷{c}={frac_str(Fraction(a, b * c))}"
        others = rng.sample(correct_pool, 3)
        ds = [wrong_makers[j % 3]((others[j][0]), others[j][1], others[j][2]) for j in range(3)]
        if len(set([correct] + ds)) != 4:
            continue
        add_item("t7t", 2, "다음 중 계산 결과가 옳은 것은?", correct, ds,
                 f"{frac_str(Fraction(a, b))}÷{c}={frac_str(Fraction(a, b))}×{{1/{c}}}={frac_str(Fraction(a, b * c))}이 옳습니다. 나머지는 계산이 잘못되었습니다.")


def main() -> None:
    gen_t1()
    gen_t2()
    gen_t3()
    gen_t4()
    gen_t5()
    gen_t7t()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(items, ensure_ascii=True, indent=1), encoding="utf-8")
    from collections import Counter
    by_type = Counter(i["id"].split("-")[3] for i in items)
    by_diff = Counter(i["difficulty"] for i in items)
    by_ci = Counter(i["correctIndex"] for i in items)
    print(f"total: {len(items)}")
    print("by_type:", dict(by_type))
    print("by_diff:", dict(by_diff))
    print("correctIndex:", dict(sorted(by_ci.items())))


if __name__ == "__main__":
    main()
