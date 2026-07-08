import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { GEM_KEYS } from '../assetKeys';

export type GemType = 'xp_small' | 'xp_medium' | 'xp_large' | 'health' | 'magnet';
export type GemSize = 'small' | 'medium' | 'large';

export interface GemConfig {
  type: GemType;
  value: number;
  spriteKey: string;
  scale: number;
}

// Get gem size based on wave number — 웨이브별 (small, medium, large) 확률 분포.
// 완만한 지수형 XP 곡선(config.xp: 20 × 1.085^)에 맞춰 기대 젬 XP가 웨이브당 ~6~9%씩만
// 오르도록 설계했다(= 소득 점프를 없애 퀴즈 간격을 25~75초 밴드에 유지). kills/min은
// 스폰 간격 하한(200ms) 때문에 wave16까지 오르므로, 그 전에는 small 위주로 두어 소득이
// "사냥 속도"만으로 완만히 오르게 하고, wave16 이후 medium→large로 젬값을 이어서 올린다.
// (튜닝 근거·시뮬레이션: scratchpad/xp_sim.py, final_sim.py)
export function getGemSizeForWave(wave: number): GemSize {
  let ps: number; // small 확률
  let pm: number; // medium 확률 (large = 1 - ps - pm)
  if (wave <= 15)      { ps = 1.00; pm = 0.00; } // E≈1.0
  else if (wave <= 20) { ps = 0.90; pm = 0.10; } // E≈1.2
  else if (wave <= 25) { ps = 0.75; pm = 0.25; } // E≈1.5
  else if (wave <= 30) { ps = 0.55; pm = 0.45; } // E≈1.9
  else if (wave <= 35) { ps = 0.35; pm = 0.65; } // E≈2.3
  else if (wave <= 40) { ps = 0.15; pm = 0.85; } // E≈2.7
  else if (wave <= 45) { ps = 0.00; pm = 0.90; } // E≈3.5 (large 10%)
  else if (wave <= 50) { ps = 0.00; pm = 0.65; } // E≈4.75 (large 35%)
  else if (wave <= 55) { ps = 0.00; pm = 0.40; } // E≈6.0 (large 60%)
  else                 { ps = 0.00; pm = 0.15; } // E≈7.25 (large 85%)

  const r = Math.random();
  if (r < ps) return 'small';
  if (r < ps + pm) return 'medium';
  return 'large';
}

// Get XP value for gem size
export function getXPForGemSize(size: GemSize): number {
  return GAME_CONFIG.gems[size];
}

// Get gem config based on gem size
function getGemConfigBySize(size: GemSize): GemConfig {
  const xpValue = getXPForGemSize(size);

  if (size === 'large') {
    return {
      type: 'xp_large',
      value: xpValue,
      spriteKey: GEM_KEYS.large,
      scale: 1.4,
    };
  } else if (size === 'medium') {
    return {
      type: 'xp_medium',
      value: xpValue,
      spriteKey: GEM_KEYS.medium,
      scale: 1.3,
    };
  } else {
    return {
      type: 'xp_small',
      value: xpValue,
      spriteKey: GEM_KEYS.small,
      scale: 1.2,
    };
  }
}

// Legacy function for backwards compatibility
function getGemConfig(xpValue: number): GemConfig {
  if (xpValue >= GAME_CONFIG.gems.large) {
    return {
      type: 'xp_large',
      value: xpValue,
      spriteKey: GEM_KEYS.large,
      scale: 1.4,
    };
  } else if (xpValue >= GAME_CONFIG.gems.medium) {
    return {
      type: 'xp_medium',
      value: xpValue,
      spriteKey: GEM_KEYS.medium,
      scale: 1.3,
    };
  } else {
    return {
      type: 'xp_small',
      value: xpValue,
      spriteKey: GEM_KEYS.small,
      scale: 1.2,
    };
  }
}

export class XPGem extends Phaser.Physics.Arcade.Sprite {
  public xpValue: number;
  public gemType: GemType;
  private isBeingCollected: boolean = false;
  private collectTarget: Phaser.Physics.Arcade.Sprite | null = null;
  private targetScale: number;

  constructor(scene: Phaser.Scene, x: number, y: number, xpValue: number = 1) {
    const config = getGemConfig(xpValue);
    super(scene, x, y, config.spriteKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.xpValue = xpValue;
    this.gemType = config.type;
    this.targetScale = config.scale;

    // Set scale for actual sprite
    this.setScale(config.scale);

    // Set physics body size to match full sprite for reliable collection
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.width, this.height);
    body.setOffset(0, 0);

    this.setDepth(2);

    // Spawn animation
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: config.scale,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // 사망 지점에서 살짝 튕겨 나가는 포물선 낙하 (설계 §3.2) — 안착 후 기존 부유 애니메이션 시작
    const tossX = x + (Math.random() - 0.5) * 50;
    const tossPeakY = y - 24 - Math.random() * 16;
    scene.tweens.add({
      targets: this,
      x: tossX,
      y: tossPeakY,
      duration: 160,
      ease: 'Sine.easeOut',
      onComplete: () => {
        scene.tweens.add({
          targets: this,
          y,
          duration: 160,
          ease: 'Sine.easeIn',
          onComplete: () => {
            // Floating animation
            scene.tweens.add({
              targets: this,
              y: y - 5,
              duration: 1000,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
          },
        });
      },
    });
  }

  update(): void {
    if (this.isBeingCollected && this.collectTarget && this.collectTarget.active) {
      // Move towards target
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.collectTarget.x, this.collectTarget.y);
      const speed = 400;
      this.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
    }
  }

  startCollection(target: Phaser.Physics.Arcade.Sprite): void {
    if (this.isBeingCollected) return;

    this.isBeingCollected = true;
    this.collectTarget = target;

    // Speed up animation when being collected
    this.scene.tweens.killTweensOf(this);
  }

  collect(): number {
    if (!this.active) return 0;
    // 즉시 비활성화 — 100ms 축소 트윈 동안 overlap이 매 프레임 재발화해
    // 젬 1개가 XP를 6~7회 지급하던 버그 차단 (핸들러의 active 가드가 재진입을 막는다)
    this.setActive(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;

    const value = this.xpValue;

    // Collection effect
    this.scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      duration: 100,
      onComplete: () => {
        this.destroy();
      }
    });

    return value;
  }

  isCollecting(): boolean {
    return this.isBeingCollected;
  }

  // Factory method for wave-based gem creation
  static createForWave(scene: Phaser.Scene, x: number, y: number, wave: number): XPGem {
    const size = getGemSizeForWave(wave);
    const xpValue = getXPForGemSize(size);
    return new XPGem(scene, x, y, xpValue);
  }
}

// Special gem types for drops
export class HealthGem extends Phaser.Physics.Arcade.Sprite {
  public healValue: number;
  private isBeingCollected: boolean = false;
  private collectTarget: Phaser.Physics.Arcade.Sprite | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, healValue: number = 10) {
    super(scene, x, y, GEM_KEYS.health);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.healValue = healValue;
    this.setScale(1.3);
    this.setDepth(2);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.displayWidth * 0.8, this.displayHeight * 0.8);

    // Spawn animation
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: 1.3,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Pulsing animation (health gems pulse red)
    scene.tweens.add({
      targets: this,
      alpha: 0.7,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  startCollection(target: Phaser.Physics.Arcade.Sprite): void {
    if (this.isBeingCollected) return;
    this.isBeingCollected = true;
    this.collectTarget = target;
    this.scene.tweens.killTweensOf(this);
  }

  update(): void {
    if (this.isBeingCollected && this.collectTarget && this.collectTarget.active) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.collectTarget.x, this.collectTarget.y);
      this.setVelocity(Math.cos(angle) * 400, Math.sin(angle) * 400);
    }
  }

  collect(): number {
    if (!this.active) return 0;
    // XPGem.collect와 동일 — 축소 트윈 동안 재발화 방지
    this.setActive(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    const value = this.healValue;
    this.scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      duration: 100,
      onComplete: () => this.destroy()
    });
    return value;
  }

  isCollecting(): boolean {
    return this.isBeingCollected;
  }
}

export class MagnetGem extends Phaser.Physics.Arcade.Sprite {
  private isBeingCollected: boolean = false;
  private collectTarget: Phaser.Physics.Arcade.Sprite | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, GEM_KEYS.magnet);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(1.3);
    this.setDepth(2);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.displayWidth * 0.8, this.displayHeight * 0.8);

    // Spawn animation
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: 1.3,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Rotating animation (magnet gems spin)
    scene.tweens.add({
      targets: this,
      rotation: Math.PI * 2,
      duration: 2000,
      repeat: -1,
    });
  }

  startCollection(target: Phaser.Physics.Arcade.Sprite): void {
    if (this.isBeingCollected) return;
    this.isBeingCollected = true;
    this.collectTarget = target;
    this.scene.tweens.killTweensOf(this);
  }

  update(): void {
    if (this.isBeingCollected && this.collectTarget && this.collectTarget.active) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.collectTarget.x, this.collectTarget.y);
      this.setVelocity(Math.cos(angle) * 400, Math.sin(angle) * 400);
    }
  }

  // Magnet effect: collect all XP gems on screen
  collect(): void {
    if (!this.active) return;
    // 축소 트윈 동안 재발화 방지 (자석 효과 중복 발동 차단)
    this.setActive(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      duration: 100,
      onComplete: () => this.destroy()
    });
  }

  isCollecting(): boolean {
    return this.isBeingCollected;
  }
}
