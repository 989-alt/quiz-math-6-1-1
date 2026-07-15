// 게임 모드 단일 소스 — 모험(엔드리스) / 10분 챌린지. difficulty.ts와 동일한 패턴
// (registry에 심어 GameScene이 create()/resetGame()에서 읽음)으로 threading한다.

export type GameMode = 'adventure' | 'timeAttack';

export interface GameModeConfig {
  label: string;
  emoji: string;
  badgeColor: string;
  description: string; // 선택 화면 한 줄 설명 (난이도 카드와 동일하게 간결히)
}

export const GAME_MODE_ORDER: GameMode[] = ['adventure', 'timeAttack'];

export const GAME_MODE_CONFIG: Record<GameMode, GameModeConfig> = {
  adventure: {
    label: '모험 모드',
    emoji: '🗺️',
    badgeColor: '#a5b4fc',
    description: '무기를 모두 강화하고 최종 보스를 잡으면 클리어',
  },
  timeAttack: {
    label: '10분 챌린지',
    emoji: '⏱',
    badgeColor: '#22d3ee',
    description: '10분 생존 시 자동 클리어',
  },
};

/** 10분 챌린지 목표 생존 시간(초) */
export const TIME_ATTACK_DURATION_SEC = 600;
