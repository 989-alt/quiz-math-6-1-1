# 게임 배경 이미지

## 기본 동작
파일이 없으면 코드가 자동으로 **procedural 픽셀 판타지 배경**을 그립니다 (어두운 보라 그라데이션 + 픽셀 별 + 글로우 + 마법 룬). 파일 추가 없이도 즉시 작동합니다.

## 외부 이미지로 교체하려면

이 폴더에 `fantasy_pixel.png` 한 장을 추가하면 됩니다. tileSprite로 무한 반복되므로 **타일링 가능한 seamless 이미지**여야 자연스럽습니다.

### 권장 사양
- **해상도**: 256×256 ~ 1024×1024 (정사각, 2의 거듭제곱 권장)
- **형식**: PNG (투명도 불필요)
- **스타일**: 어두운 톤 + 픽셀 아트 + seamless tile
- **분위기**: 판타지 던전 / 별이 빛나는 밤하늘 / 마법 격자

### 무료 픽셀 아트 자산 사이트

| 사이트 | 라이선스 | 추천 검색어 |
|---|---|---|
| [itch.io free assets](https://itch.io/game-assets/free/tag-pixel-art/tag-tileset) | 자산별 명시 (CC0/CC-BY 다수) | "fantasy tile", "dungeon", "starfield seamless" |
| [OpenGameArt](https://opengameart.org/art-search?keys=pixel+fantasy+tileable) | CC0/CC-BY (필터 사용) | "tileable fantasy", "pixel night sky" |
| [Kenney.nl](https://kenney.nl/assets?q=tile) | CC0 (전부 자유 사용) | 픽셀 타일셋 |
| [Craftpix](https://craftpix.net/freebies/) | freebies 무료 | 게임용 타일 |
| [pixilart.com](https://www.pixilart.com/) | 작가별 명시 | 직접 만들기 가능 |

### 설치 방법
1. 위 사이트에서 PNG 한 장 다운로드 (seamless tile 권장)
2. 파일명을 `fantasy_pixel.png`로 변경
3. 이 폴더(`public/assets/background/`)에 저장
4. 브라우저 새로고침 → 자동 적용

## 색감 매칭 팁
게임 UI는 보라(`#6366f1` `#8b5cf6`)·시안(`#22d3ee`)·금빛(`#fbbf24`)을 사용합니다. 비슷한 톤의 배경이면 통일감이 좋습니다.
