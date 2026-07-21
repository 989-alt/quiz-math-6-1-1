# 선택형 리롤(다시 뽑기) 개편 — 설계 + 구현 계획

날짜: 2026-07-21 · 적용 대상: quiz-math-6-1-3 (선행 구현) → quiz-math-6-1-4, quiz-math-6-1-1 (동일 diff 이식)

## 배경

레벨업 시 강화 카드 3장이 표시되고, 현재는 하단의 "🔄 다시 뽑기" 버튼 1개가 3장 전체를 재추첨한다
(`GameScene.handleRerollUpgrades` → `weaponManager.getAvailableUpgrades(3)`).

## 목표 동작 (스펙)

1. 카드 3장 **각각의 하단**에 개별 "다시 뽑기" 버튼을 둔다 (기존 버튼과 같은 룩앤필의 소형 버튼).
2. 버튼을 누르면 **해당 카드 1장만** 새 카드로 교체된다. 나머지 2장은 그대로 유지.
3. 리롤은 **레벨업당 1회**. 사용 즉시 3개 버튼 모두 회색·비활성화(교체된 새 카드도 재리롤 불가).
4. 새 카드는 가능하면 **현재 3장(버린 카드 포함)과 중복되지 않게** 뽑는다.
   후보 풀이 부족하면 단계적 완화: ①버린 카드와의 중복 허용 → ②기존 대체 보상(heal/score/magnet_pulse) 카드.
5. 카드가 1장뿐인 화면(대체 보상)에서는 리롤 버튼을 표시하지 않는다 (기존 `upgrades.length > 1` 조건 유지).
6. 추첨 규칙(운 보정, 진화, 만렙 제외 등)은 기존 WeaponManager 로직을 그대로 통과해야 한다.

## 구현 지점

| 파일 | 변경 |
|---|---|
| `src/game/utils/EventBus.ts` | `REROLL_UPGRADES` 페이로드에 `{ index: number }` 추가 (교체할 슬롯). `UPGRADES_REROLLED`는 기존대로 3장 전체 배열 반환 |
| `src/game/weapons/WeaponManager.ts` | 추첨 시 제외 목록(`exclude: {type,id}[]` 또는 `"type:id"` 키 배열)을 받을 수 있게 확장. 기존 `getAvailableUpgrades(3)` 호출부는 무변경 동작 유지 |
| `src/game/scenes/GameScene.ts` | `handleRerollUpgrades(index)`: 기존 가드(`gameFinished`/`finalBossDefeated`/`!isPaused`) 유지. 현재 3장을 제외하고 1장 뽑아 해당 슬롯만 교체한 배열을 `UPGRADES_REROLLED`로 발행. 현재 표시 중인 3장을 알아야 하므로 `processNextLevelUp`에서 발행한 배열을 필드로 보관 |
| `src/components/student/GameContainer.tsx` | `handleReroll(index)`로 시그니처 변경, `rerollUsed` 상태·레벨업 시 리셋 로직은 유지 |
| `src/components/student/UpgradeSelect.tsx` | 하단 단일 버튼 제거 → 카드별 하단 버튼. `rerollUsed`면 3개 모두 회색(`#52525b` 텍스트, 커서 default)·disabled. 교체된 카드는 `animate-scale-in` 재적용 |

## 추가 스펙: 출제 완전 랜덤화 (2026-07-21 추가 요청)

7. **문제 순서 완전 랜덤**: `quizStore.drawQuiz`의 웨이브 기반 난이도 가중(`difficultyWeights`)을 제거하고,
   셔플된 remaining 풀에서 순서대로(=균등 랜덤) 뽑는다. 무중복 소진·최근 20문 제외 재셔플 로직은 유지.
   (난이도 페이싱 설계 §1.4는 이 요청으로 폐기됨)
8. **보기 순서 랜덤**: 문제를 화면에 낼 때마다 4개 보기를 셔플하고 `correctIndex`를 리매핑한다.
   `drawQuiz`에서 셔플된 사본을 `currentQuiz`로 저장해 QuizOverlay·submitAnswer는 무변경으로 동작하게 한다.
   원본 뱅크 데이터는 변형하지 않는다.

## 검증

- 자동: `npm run lint` + `npm run build` (tsc) 통과. 저장소에 단위테스트 인프라 없음 — 도입하지 않는다(YAGNI).
- 실측(메인 세션 담당): Playwright로 실제 플레이 → 레벨업 → ①특정 카드만 교체되는지 ②나머지 2장 유지되는지 ③사용 후 3버튼 모두 비활성인지 ④다음 레벨업에서 버튼이 복구되는지 ⑤카드 1장 화면에서 버튼이 없는지 확인. 버그 발견 시 수정 루프.

## 이식 순서

1. 6-1-3에서 구현·검증 완료 (이 저장소)
2. 6-1-4에 동일 diff 이식 (로컬 존재)
3. 6-1-1은 `https://github.com/989-alt/quiz-math-6-1-1` 클론 후 이식 (아이스크림 검수 중이나 바로 적용하기로 결정됨)
4. 각 저장소: lint+build+실측 통과 후 `npm run deploy` (gh-pages)

## 작업 분할

- Task 1 (구현, 표준 모델): 6-1-3 선택형 리롤 구현 — 위 5개 파일, 스펙 1~6 충족, lint+build 통과, 커밋
- Task 2 (이식, 표준 모델): 6-1-4 이식 — Task 1 diff 참조, 동일 검증
- Task 3 (이식, 표준 모델): 6-1-1 클론+이식 — 동일 검증
- 각 Task 후: 리뷰 + 메인 세션 Playwright 실측 루프
