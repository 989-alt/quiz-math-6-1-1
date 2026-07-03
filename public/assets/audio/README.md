# Audio Assets — Quiz Survivor

이 폴더에 아래 파일을 추가하면 게임에서 즉시 작동합니다. 파일이 없으면 게임은 정상 작동하지만 무음입니다.

## 필요한 파일

| 파일명 | 용도 | 추천 길이 | 추천 분위기 |
|---|---|---|---|
| `bgm.mp3` | 배경음악 (loop) | 1~3분 | 웅장한 판타지 오케스트라 / 모험 |
| `monster_hit.mp3` | 몬스터 피격 | 0.1~0.3초 | 짧고 가벼운 타격음 (펀치) |
| `monster_die.mp3` | 몬스터 처치 | 0.3~0.6초 | 짧은 처치 효과음 (퍽/짜악) |
| `player_hit.mp3` | 플레이어 피격 | 0.2~0.4초 | 둔탁한 충격음 (몬스터와 차별화) |
| `levelup.mp3` | 레벨업 (퀴즈 정답) | 0.8~1.5초 | 화려한 승리 효과음 |
| `pickup.mp3` | XP 젬 획득 | 0.1~0.2초 | 얕은 코인/픽업음 |
| `quiz_correct.mp3` | 퀴즈 정답 | 0.5~1초 | 띠링/딩 |
| `quiz_wrong.mp3` | 퀴즈 오답 | 0.3~0.6초 | 부저/실패음 |

## 무료·라이선스 명확한 사이트

| 사이트 | 라이선스 | 비고 |
|---|---|---|
| [Pixabay Music](https://pixabay.com/music/) | Pixabay License (상업적 사용 OK, 출처 표기 불필요) | 가장 추천 |
| [Pixabay SFX](https://pixabay.com/sound-effects/) | Pixabay License | SFX 풍부 |
| [Mixkit](https://mixkit.co/free-sound-effects/) | Mixkit License (상업적 OK) | 다운로드 즉시 |
| [Kenney.nl Audio](https://kenney.nl/assets?q=audio) | CC0 (완전 자유 사용) | 게임 자산 표준 |
| [OpenGameArt](https://opengameart.org/art-search?keys=fantasy) | CC 다양 (필터로 CC0 선택 권장) | |
| [Freesound](https://freesound.org/) | CC 다양 (CC0 필터 사용) | |

## 추천 검색어

### BGM (배경음악)
- "epic fantasy adventure"
- "medieval battle orchestra"
- "dungeon adventure loop"
- "heroic battle theme"
- "fantasy adventure loop"

### 몬스터 피격 / 처치
- "monster hit", "creature grunt"
- "punch impact", "flesh hit"
- "monster death", "enemy defeat"

### 플레이어 피격
- "player damage", "hurt grunt"
- "human pain", "deep impact"
- "armor hit"

### 레벨업 / 퀴즈
- "level up", "achievement"
- "correct answer", "success ding"
- "wrong buzzer", "fail beep"

## 사용 방법

1. 위 사이트에서 mp3 파일을 다운로드
2. 파일명을 위 표에 맞게 변경 (예: `bgm.mp3`)
3. 이 폴더(`public/assets/audio/`)에 복사
4. 브라우저 새로고침 (또는 `npm run dev` 재시작)

파일이 없는 항목은 자동으로 무음 처리됩니다 (콘솔에 [Audio 미설치] 워닝).

## 볼륨 조절

코드 내 기본값:
- BGM: 0.3 (30%)
- 몬스터 피격: 0.22 (보스 0.35)
- 몬스터 처치: 0.30 (보스 0.55)
- 플레이어 피격: 0.50
- 레벨업: 0.50
- 픽업: 0.18
- 퀴즈: 0.45

조정은 `src/game/scenes/GameScene.ts`, `src/game/entities/Monster.ts`, `src/game/entities/Player.ts`의 `playSfx(...)` 호출에서 두 번째 인자 변경.
