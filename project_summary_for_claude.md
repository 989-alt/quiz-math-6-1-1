# Quiz Survivor - 프로젝트 요약 및 개발 방향

## 프로젝트 개요
교육용 서바이벌 퀴즈 게임. 뱀파이어 서바이버 스타일의 게임플레이 + AI 기반 퀴즈 생성.

## 기술 스택
- **Frontend**: React 18, TypeScript, Vite
- **Game Engine**: Phaser 3
- **Styling**: CSS (Tailwind 제거됨, 커스텀 픽셀 스타일)
- **AI**: Google Gemini API (gemini-2.5-flash)
- **파일 파싱**: pdfjs-dist (PDF), jszip (PPTX)
- **State**: Zustand

## 현재 상태 (claude 3차 리밋 커밋 완료 - UI 개편 & 솔로 모드 완성)

### 완료된 기능
1. **솔로 플레이 모드 (Solo Mode)**
   - **무한 퀴즈 생성**: `SoloQuizGenerator.ts` (수학 1~6학년 알고리즘 생성)
   - **정적 데이터 퀴즈**: `SoloQuizData.ts` (맞춤법, 속담 50+ 문제)
   - **게임 통합**: 로비 없이 즉시 시작, 로컬 상태 관리 (`quizStore` 내장)

2. **UI/UX 전면 개편 (Clean Dot-Based Theme)**
   - **디자인 컨셉**: 깔끔한 픽셀/도트 스타일 + 네온 글로우 효과
   - **폰트**: `Press Start 2P` (타이틀), `Inter/Pretendard` (본문)
   - **주요 컴포넌트 리팩토링**:
     - `PixelButton`: 3D 입체감 픽셀 버튼 (그림자, 누름 효과)
     - `GlassCard`: 글래스모피즘 + 픽셀 테두리
     - `Badge`: 픽셀 아트 스타일 뱃지
     - `ProgressBar`: 레트로 게임 스타일 게이지
   - **반응형 웹**: 모바일/데스크톱 대응 (clamp 활용)

3. **파일 업로드 개선**
   - PDF 한글 텍스트 추출 (pdfjs-dist)
   - PPTX 텍스트 추출 (jszip)
   - 다중 파일 업로드 및 개별 삭제

4. **게임 시스템**
   - Phaser 기반 뱀서라이크 엔진
   - 무기 시스템 (WeaponManager) & 적 스폰/웨이브
   - **무한 맵 시스템 (Infinite Map)**
     - 4000x4000 월드 바운드 확장
     - TileSprite 기반 무한 스크롤 배경
     - 카메라/플레이어 중심 좌표계

## 알려진 이슈 및 해결 필요 사항

### 긴급
1. **PDF.js Worker 오류**: 브라우저 환경에 따라 unpkg CDN 로딩 이슈 가능성 있음 (확인 필요)

### 개선 사항
2. **번들 크기 최적화**: Dynamic Import 적용 필요
3. **Gemini API 예외 처리**: Rate Limit (429) 재시도 로직 강화 필요

## 주요 파일 구조

```
quiz-survivor/
├── src/
│   ├── components/
│   │   ├── teacher/          # 교사용 (업로드, 대시보드)
│   │   ├── student/          # 학생용 (게임, 로비)
│   │   └── shared/           # 공용 (버튼, 카드, 뱃지 등 UI)
│   ├── game/
│   │   ├── scenes/           # Phaser 씬 (Main, Boot)
│   │   └── utils/            # 퀴즈 생성기 (Math, Spelling)
│   ├── hooks/                # usePhaser, useGameLogic
│   └── stores/               # Zustand 스토어
├── index.css                 # 전역 스타일 (커스텀 픽셀 테마)
└── package.json
```

## Git 커밋 히스토리
- `Claude 3차 리밋` (current): UI 전면 개편(도트 테마), 솔로 모드(수학/속담/맞춤법), 컴포넌트 분리
- `solomode`: 솔로 플레이 로직 초안
- `claude 2차 제한`: 파일 업로드 개선, Gemini 2.5
- `claude 1차 제한`: 초기 프로토타입

## 참고 사항
- Tailwind CSS 완전히 제거됨 (Pure CSS Modules/Global Styles)
- 모든 UI는 `src/components/shared` 내부 컴포넌트 재사용 권장
