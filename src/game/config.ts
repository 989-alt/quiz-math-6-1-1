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
    // 지수의 상한 — 레벨 41부터는 지수를 더 키우지 않고 레벨40 값에 고정해
    // 후반 퀴즈 간격이 계속 팽창하는 꼬리를 억제한다.
    levelCapExponent: 39,
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

// 레벨업에 필요한 XP 계산 — 지수를 levelCapExponent로 캡해 후반(Lv41+) 퀴즈 간격 팽창을 억제한다.
// GameScene.addXp의 xpToNextLevel 공식이 이 헬퍼를 쓰도록 전환 예정 (config.ts 값과 항상 일치 보장).
export function xpRequiredForLevel(level: number): number {
  const exponent = Math.min(level - 1, GAME_CONFIG.xp.levelCapExponent);
  return Math.floor(GAME_CONFIG.xp.baseToLevel * Math.pow(GAME_CONFIG.xp.multiplier, exponent));
}

export const createPhaserConfig = (
  parent: string,
  isMobile: boolean
): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  backgroundColor: '#0a0a0f',
  scale: isMobile
    ? {
        // 모바일/태블릿(터치): 고정 1920×1080 디자인 스테이지. 부모(#game-container)가 CSS
        // transform으로 축소·레터박스되는 고정비 스테이지 안에 있으므로 Phaser는 스케일하지
        // 않는다(NONE). 캔버스는 항상 1920×1080 픽셀로 유지되어 PC와 동일한 월드 범위를 보되,
        // 스프라이트는 상위 스테이지 transform만큼 작아진다.
        mode: Phaser.Scale.NONE,
        width: 1920,
        height: 1080,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      }
    : {
        // PC(비터치): 원본 동작 — 창 크기를 그대로 추종한다. 1 월드 유닛 = 1 CSS 픽셀이라
        // 스프라이트가 원래 크기로 표시된다(확대·레터박스 없음). 카메라 = 창 크기.
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
