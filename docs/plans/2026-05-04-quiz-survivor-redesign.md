# Quiz Survivor — 단원 기반 솔로 + 통합 랭킹 리디자인

날짜: 2026-05-04
대상: `quiz-survivor` (React 19 + Vite + Phaser 3)

## 목표

1. AI 퀴즈 생성·교사 모드·실시간 멀티 인프라를 모두 제거하고 **순수 솔로 게임**으로 단순화한다.
2. **학년 → 학기 → 단원 → 닉네임** 흐름으로 단원 특화 문제를 제공한다.
3. **Firestore 기반 통합 온라인 랭킹**(닉네임 + 익명 인증)을 단원별로 분리해 노출한다.

## 스코프

| 항목 | 결정값 |
|---|---|
| 콘텐츠 출처 | 정적 큐레이션 (TS 데이터 파일, 리포에 커밋) |
| 대상 학년 | **5·6학년** (1·2학기 분리 노출) |
| 단원 기준 | 22개정 교육과정 / **아이스크림미디어** 수학 교과서 단원 |
| 학기당 단원 수 | 6단원 |
| 단원당 문제 수 | 20문제 (4지선다) |
| 총 문제 수 | 약 240문제 |
| 백엔드 | **Firestore + signInAnonymously** |
| 정렬 점수 | `score + survivalTime × 10 + level × 100` |
| 랭킹 분리 기준 | 단원별 (`grade-semester-unitId`) |
| 멀티 인프라 | Ably·교사 대시보드·QRLobby **완전 제거** |
| AI 생성 | Gemini SDK·PDF/PPTX 파서 **완전 제거** |

## 화면 흐름

```
[홈]
 ├─ [시작하기] ──► 학년(5/6) ─► 학기(1/2) ─► 단원(6개 카드) ─► 닉네임 입력 ─► 게임
 │                                                                          ▼
 │                                              게임오버: 점수자동등록 → 단원 랭킹 노출
 │
 └─ [랭킹] ────► 학년/학기/단원 필터 ► Top 100 + 내 등수 강조
```

닉네임은 첫 입력 후 `localStorage('sqb:nickname')`에 보존하여 다음 판부터 자동 입력(편집 가능).

## 데이터 구조

### 단원 메타데이터

`src/data/units/grade5-1.ts`, `grade5-2.ts`, `grade6-1.ts`, `grade6-2.ts` (각 6단원).

```ts
// src/data/units/types.ts
export interface UnitMeta {
  grade: 5 | 6;
  semester: 1 | 2;
  unitId: string;          // 'g5-1-3' 형식
  unitNumber: number;      // 1..6
  title: string;           // '약수와 배수'
  description: string;
}

export interface UnitQuiz {
  id: string;              // 'g5-1-3-q01'
  question: string;
  options: [string, string, string, string];  // 4지선다 고정
  correctIndex: 0 | 1 | 2 | 3;
  explanation?: string;
}

export interface Unit extends UnitMeta {
  quizzes: UnitQuiz[];
}
```

### 단원 ID 규칙

`g{grade}-{semester}-{unitNumber}` (예: `g5-1-3` = 5학년 1학기 3단원)

### 디렉터리

```
src/data/units/
  index.ts                    # ALL_UNITS, getUnit(id), getUnitsByGradeSemester
  types.ts
  grade5-1.ts                 # 단원 6개
  grade5-2.ts
  grade6-1.ts
  grade6-2.ts
```

기존 `src/data/curriculum/grade1~6.ts`는 향후 저학년 알고리즘 폴백 옵션을 위해 보관(현재 라우팅에서는 사용 안 함).

## Firestore 스키마

### 컬렉션 경로

```
/leaderboards/{unitId}/scores/{scoreId}
```

### Score 도큐먼트

```ts
{
  nickname: string;          // max 12 char
  unitId: string;            // 'g5-1-3'
  grade: 5 | 6;
  semester: 1 | 2;
  score: number;             // 게임 내 누적 점수
  survivalTime: number;      // 초
  level: number;
  kills: number;
  weightedScore: number;     // = score + survivalTime*10 + level*100 (서버 정렬용)
  createdAt: Timestamp;
  authUid: string;           // 익명 UID
}
```

### Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboards/{unitId}/scores/{scoreId} {
      allow read: if true;
      allow create: if request.auth != null
        && request.resource.data.nickname is string
        && request.resource.data.nickname.size() > 0
        && request.resource.data.nickname.size() <= 12
        && request.resource.data.score is number
        && request.resource.data.score >= 0
        && request.resource.data.score <= 1000000
        && request.resource.data.survivalTime is number
        && request.resource.data.survivalTime <= 7200
        && request.resource.data.weightedScore is number
        && request.resource.data.authUid == request.auth.uid;
      allow update, delete: if false;
    }
  }
}
```

### 쿼리

- 단원 Top 100: `collection('leaderboards/{unitId}/scores').orderBy('weightedScore', 'desc').limit(100)`
- 내 기록 best: 같은 컬렉션 + `where('authUid', '==', uid).orderBy('weightedScore', 'desc').limit(1)`

## 코드 변경 요약

### 신규

- `src/data/units/{types.ts, index.ts, grade5-1.ts, grade5-2.ts, grade6-1.ts, grade6-2.ts}`
- `src/services/firebase.ts` — initializeApp + signInAnonymously + submit/fetch
- `src/components/leaderboard/LeaderboardView.tsx` — 필터 + 랭킹 리스트
- `src/components/student/PostGameOverlay.tsx` — 게임오버 후 점수 등록 + 랭킹 진입 버튼
- `src/components/student/UnitSelect.tsx` — 학년/학기/단원 카드 선택
- `firestore.rules` (배포용)
- `.env.local.example` — `VITE_FIREBASE_*` 키 7개 템플릿

### 수정

- `src/App.tsx` — `/teacher` 제거, `/play`(단원선택→게임) + `/leaderboard` 추가
- `src/components/student/JoinRoom.tsx` — 새 흐름으로 재작성 (또는 `UnitSelect`+`NicknameInput` 두 컴포넌트로 분리)
- `src/components/student/GameContainer.tsx` — `soloConfig` 타입을 `{unitId}` 단일 필드로 변경, 게임오버시 PostGameOverlay 띄움
- `src/stores/quizStore.ts` — `generateSoloQuizSet` 제거, `loadUnitQuizzes(unitId)` 추가 (단원 풀 셔플 후 currentQuizSet에 주입)
- `src/types/quiz.ts` — `QuizGenerationRequest`, `FileParseResult`, `QuizGenerationResponse` 등 AI 관련 타입 제거
- `src/game/scenes/GameOverScene.ts` — 내부 버튼 대신 React 오버레이로 위임 (또는 EventBus로 점수 emit)

### 삭제

- `src/components/teacher/` 전체 (Dashboard, FileUpload, QuizEditor, QRLobby, Leaderboard)
- `src/services/gemini.ts`, `src/services/fileParser.ts`, `src/services/ably.ts`
- `src/stores/roomStore.ts`
- `src/game/utils/SoloQuizGenerator.ts`, `src/game/utils/SoloQuizData.ts`
- `package.json`: `@google/generative-ai`, `ably`, `qrcode.react`, `pdfjs-dist`, `jszip`, `@types/jszip`, `@types/pdf-parse`
- `index.html`의 Gemini/PDF.js 워커 관련 스크립트 (있다면)

## 가중치 점수 산정

```ts
function weightedScore(score: number, survivalTime: number, level: number): number {
  return score + Math.floor(survivalTime) * 10 + level * 100;
}
```

서버 정렬에 사용하므로 클라이언트에서 계산해 그대로 저장. Rules에서 `weightedScore` 자체를 검증하지는 않지만 score/time/level 상한으로 어뷰징을 1차 차단.

## 어뷰징 방어 (1차)

- 익명 인증 필수 (`request.auth != null`)
- 점수 상한: score ≤ 1,000,000, survivalTime ≤ 7200초(2시간)
- 도큐먼트 update/delete 금지 → 자기 기록 덮어쓰기 불가, 모든 시도가 별도 row로 적재되고 정렬 시 best만 노출
- 닉네임 길이 1~12자

## 단계적 구현 순서

1. 단원 타입/데이터 스캐폴딩 + 샘플 문제 5개씩 (나머지는 TODO 주석)
2. quizStore 단원 셀렉터 교체
3. JoinRoom → UnitSelect + NicknameInput 분리 재작성
4. GameContainer를 새 unitId 인터페이스로 연결
5. Firebase 서비스 + .env 템플릿
6. PostGameOverlay + LeaderboardView
7. 교사·AI·실시간 코드 일괄 삭제 + package.json 정리
8. App.tsx 라우팅 재구성
9. `tsc -b && vite build` 통과 확인

## 마무리 후 사용자 작업

- (1) 240문제 본 큐레이션 (단원당 15문제씩 추가 작성, TODO 주석 자리에 채움)
- (2) Firebase 콘솔에서 프로젝트 생성 + Firestore 활성화 + 익명 인증 활성화 + Rules 배포
- (3) `.env.local`에 키 7개 채움
- (4) Vercel 배포 시 동일 환경변수 설정
