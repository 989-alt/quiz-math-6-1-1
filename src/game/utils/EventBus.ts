import Phaser from 'phaser';

// EventBus for Phaser <-> React communication
export const EventBus = new Phaser.Events.EventEmitter();

// Event types
export const GameEvents = {
  // Level up events
  LEVEL_UP: 'level-up',
  UPGRADE_SELECTED: 'upgrade-selected',

  // Game state events
  PAUSE_GAME: 'pause-game',
  RESUME_GAME: 'resume-game',
  GAME_OVER: 'game-over',
  GAME_FINISHED: 'game-finished',

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

export interface GameOverPayload {
  score: number;
  level: number;
  survivalTime: number;
  monstersKilled: number;
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
}
