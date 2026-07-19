# 로컬 전용 랭킹 전환 설계 (개인 최고기록)

- 날짜: 2026-07-19
- 배경: 공모전 피드백 — "별도 랭킹 DB 없이 사용자 로컬 환경에 점수·기록을 누적하는 방식으로 개발 부담을 줄일 수 있는지 검토 요청"

## 결론

랭킹의 목적은 **개인 최고기록 갱신용**으로 확정. 따라서 localStorage가 정답이고 Firebase는 과잉 설비다.
단, 코드에는 이미 **로컬 우선(local-first) fallback**이 구현돼 있어(`saveLocalScore` → Firebase 시도 → 실패 시 로컬),
"새 시스템 구축"이 아니라 **Firebase 계층 비활성화 + 로컬을 정상 상태로 표시**하는 작업이다.

## 핵심 관찰

- `src/services/firebase.ts`는 모든 점수를 무조건 localStorage에 먼저 저장하고, Firebase는 부가 계층.
  `isFirebaseConfigured()`가 false면 자동으로 로컬 전용으로 동작한다.
- 함정: 현재 UI는 로컬 저장을 "오프라인 = 원격 실패 = 임시 상태"로 취급한다.
  Firebase를 영구히 끄면 아래 부정적 신호가 **항상** 노출된다.
  - `PostGameOverlay.tsx:176` — "기기에 저장됨 - 인터넷 연결 시 다시 시도해주세요" + [다시 시도] 버튼
  - `LeaderboardView.tsx:164` — "오프라인 기록" 배지
- `getLocalScores`/`saveLocalScore`는 플레이마다 배열에 무한 append (정리 로직 없음).

## 작업 범위

### 1. Firebase 비활성화
- `.env.local`에서 `VITE_FIREBASE_*` 키 제거 → `isFirebaseConfigured()` false → 로컬 전용 자동 동작.
- `firebase.ts` / `firestore.rules` 코드는 **그대로 방치**(사용자 결정). 추후 키만 넣으면 전국 랭킹 부활 가능.
- 검증: 키 제거 후 게임 완료 시 점수가 localStorage에만 저장되고 랭킹판에 정상 노출되는지 확인.

### 2. 로컬을 "정상 상태"로 표시 (de-error UX)
- `PostGameOverlay`: `offline` 상태 문구를 성공 표현(예: "🏆 기록 저장 완료!")으로, [다시 시도] 버튼 숨김.
  - Firebase 미설정 시엔 재시도가 무의미하므로, `isFirebaseConfigured()` 기준으로 분기.
- `LeaderboardView`: "오프라인 기록" 배지 제거(또는 "내 기록"). 랭킹판 카피를 개인기록 목적에 맞게 정리.
- 검증: 게임 완료 → 저장 완료 문구만 뜨고 오류/재시도 UI 없음. 랭킹판에 "오프라인" 뉘앙스 없음.

### 3. 상위 N개만 유지 (명예의 전당형 정리)
- 보관 정책: `(difficulty, mode)` 그룹별 **weightedScore 상위 10개**만 유지.
  - 구기록 호환: `difficulty ?? 'easy'`, `mode ?? 'adventure'`로 분류.
- 적용 지점: `saveLocalScore`에서 append 후 그룹별 top-10으로 잘라 저장.
- 상수: `const LOCAL_TOP_N = 10;`
- 검증: 같은 난이도/모드로 12판 플레이 → localStorage에 최고 10개만 남는지 확인.

## 유지되는 것 / 하지 않는 것 (YAGNI)

- Firebase 코드·규칙 파일: 방치(삭제 안 함).
- 서버·인증·비용·개인정보 처리: 전부 불필요 → 제거 대상.
- 크로스 기기 랭킹(같은 반 비교, 전국 랭킹): 이번 목적 아님 → 하지 않음.

## 리스크

- 프라이빗 브라우징/용량 초과 시 localStorage 실패 가능 → 기존 try/catch가 이미 방어. 실패 시 이번 판 기록만 유실(치명적 아님).
- 브라우저 캐시 삭제 시 기록 소실 — 개인 최고기록 특성상 허용 가능한 트레이드오프.
