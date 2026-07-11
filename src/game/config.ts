import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

export const GAME_CONFIG = {
  // Player settings
  player: {
    speed: 200,
    maxHp: 100,
    invincibilityDuration: 1000,
    pickupRange: 70,
  },

  // XP settings
  xp: {
    baseToLevel: 20, // L1→2 요구량 20 XP (= xpToNextLevel 공식의 L1 값)
    // 레벨당 +8.5%의 "완만한 지수" — 소득(kills/min × 젬값)이 게임 전체에서 약 40배 상승하므로
    // 1.085^49 ≈ 54배로 그 상승폭을 추종 → 퀴즈(레벨업) 간격이 25~75초 밴드에 머문다.
    // (기존 1.7은 Lv7→8=603, Lv15→16=42,094 XP로 폭증해 퀴즈가 사실상 사라졌음 — 시뮬레이션 xp_sim.py 참고)
    multiplier: 1.085,
    gemAttractionRange: 130,
    gemAttractionSpeed: 400,
  },

  // Gem XP values by tier — 값별 색 티어 (파랑1·초록3·노랑8·빨강15·무지개30).
  // red/rainbow는 후반(wave26+/wave36+) 희귀 잭팟. 확률표는 XPGem.getGemSizeForWave 참고.
  gems: {
    small: 1,
    medium: 3,
    large: 8,
    red: 15,
    rainbow: 30,
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
    maxPets: 2,
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
