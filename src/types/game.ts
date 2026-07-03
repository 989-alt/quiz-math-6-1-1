export interface PlayerState {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  score: number;
  weapons: WeaponInstance[];
  passives: PassiveInstance[];
  isAlive: boolean;
}

export interface WeaponInstance {
  id: string;
  level: number;
  isEvolved: boolean;
}

export interface PassiveInstance {
  id: string;
  level: number;
}

export interface MonsterConfig {
  id: string;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  xpValue: number;
  spriteKey: string;
}

export interface WaveConfig {
  waveNumber: number;
  duration: number;
  monsters: {
    type: string;
    count: number;
    spawnRate: number;
  }[];
}

export interface GameConfig {
  maxLevel: number;
  baseXpToLevel: number;
  xpMultiplier: number;
  playerSpeed: number;
  playerMaxHp: number;
  gemAttractionRange: number;
  invincibilityDuration: number;
}

export interface UpgradeOption {
  type: 'weapon' | 'passive' | 'bonus';
  id: string;
  name: string;
  description: string;
  icon?: string;
  currentLevel: number;
  maxLevel: number;
  isNew: boolean;
  isEvolution?: boolean;
}

export interface GameOverData {
  score: number;
  level: number;
  survivalTime: number;
  monstersKilled: number;
  weapons: WeaponInstance[];
}
