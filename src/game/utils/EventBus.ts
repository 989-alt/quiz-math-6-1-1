import Phaser from 'phaser';

// EventBus for Phaser <-> React communication
export const EventBus = new Phaser.Events.EventEmitter();

// Event types
export const GameEvents = {
  // Level up events
  LEVEL_UP: 'level-up',
  UPGRADE_SELECTED: 'upgrade-selected',
  // 레벨업당 1회 "다시 뽑기": 요청 (React → GameScene) / 결과로 받은 새 카드 (GameScene → React)
  REROLL_UPGRADES: 'reroll-upgrades',
  UPGRADES_REROLLED: 'upgrades-rerolled',

  // Game state events
  PAUSE_GAME: 'pause-game',
  RESUME_GAME: 'resume-game',
  GAME_OVER: 'game-over',
  GAME_FINISHED: 'game-finished',
  // 탭/창 이탈 자동 일시정지 재개 (React "계속하기" → GameScene, 3·2·1 보호 재개 경유)
  RESUME_WITH_PROTECTION: 'resume-with-protection',
  // 탭/창 이탈로 자동 일시정지됨 — 복귀 시 React가 일시정지 오버레이 표시 (GameScene → React)
  AUTO_PAUSE_SHOW: 'auto-pause-show',

  // Quiz events
  SHOW_QUIZ: 'show-quiz',
  QUIZ_RESULT: 'quiz-result',

  // Player state events
  PLAYER_STATE_UPDATE: 'player-state',
  PLAYER_DAMAGE: 'player-damage',
  PLAYER_HEAL: 'player-heal',

  // XP events
  XP_GAINED: 'xp-gained',

  // Monster events
  MONSTER_KILLED: 'monster-killed',

  // Score events
  SCORE_UPDATE: 'score-update',

  // Game ready event
  GAME_READY: 'game-ready',
  GAME_START: 'game-start',
  GAME_QUIT: 'game-quit',

  // 학생이 "그만하기"로 플레이를 중단하고 결과 집계 (React HUD → GameScene)
  STOP_GAME: 'stop-game',
  // 문제은행 전부 소진 — 완주 종료 (React quizStore 감지 → GameScene)
  QUIZ_BANK_EXHAUSTED: 'quiz-bank-exhausted',

  // 브금/효과음 on-off 토글 (React HUD → GameScene)
  SOUND_SETTINGS_CHANGED: 'sound-settings-changed',
} as const;

export type GameEventType = typeof GameEvents[keyof typeof GameEvents];

// Type-safe event payloads
export interface LevelUpPayload {
  level: number;
  availableUpgrades: Array<{
    type: 'weapon' | 'passive';
    id: string;
    name: string;
    description: string;
    icon: string;
    currentLevel: number;
    maxLevel: number;
    isNew: boolean;
    isEvolution?: boolean;
  }>;
}

// 다시 뽑기 결과로 GameScene이 돌려주는 새 업그레이드 3장 (LevelUpPayload와 동일한 카드 shape)
export interface UpgradesRerolledPayload {
  upgrades: Array<{
    type: 'weapon' | 'passive' | 'bonus' | 'pet';
    id: string;
    name: string;
    nameKo: string;
    description: string;
    descriptionKo: string;
    currentLevel: number;
    maxLevel: number;
    isNew: boolean;
    isEvolution?: boolean;
  }>;
}

export interface GameOverPayload {
  score: number;
  level: number;
  survivalTime: number;
  monstersKilled: number;
  // 무기 완성 + 최종 보스 처치로 클리어했는지 (사망/그만하기/완주는 false)
  cleared: boolean;
}

export interface PlayerStatePayload {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  score: number;
}

export interface QuizResultPayload {
  correct: boolean;
  selectedUpgrade?: string;
  // 정답을 빨리 맞힐수록 커지는 추가 점수 (정답일 때만)
  speedBonus?: number;
}

export interface SoundSettingsPayload {
  bgm: boolean;
  sfx: boolean;
}
