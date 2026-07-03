import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

export const GAME_CONFIG = {
  // Player settings
  player: {
    speed: 200,
    maxHp: 100,
    invincibilityDuration: 1000,
    pickupRange: 50,
  },

  // XP settings
  xp: {
    baseToLevel: 25, // L1→2 요구량 25 XP
    multiplier: 1.7, // 레벨당 +70% 가파르게 증가
    gemAttractionRange: 100,
    gemAttractionSpeed: 400,
  },

  // Gem XP values by size — 절반 수준으로 축소
  gems: {
    small: 1,
    medium: 5,
    large: 12,
  },

  // Auto-aim sight range (weapons won't track enemies beyond this)
  combat: {
    autoAimRange: 600,
  },

  // Wave settings
  waves: {
    baseDuration: 30,
    spawnRateMultiplier: 1.1,
  },

  // Game settings
  game: {
    maxLevel: 50,
    maxWeapons: 6,
    maxPassives: 6,
    upgradeChoices: 3,
  },
};

export const createPhaserConfig = (parent: string): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  backgroundColor: '#0a0a0f',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, GameScene],
  render: {
    pixelArt: true,
    antialias: false,
  },
  input: {
    activePointers: 2,
    keyboard: true,
  },
});
