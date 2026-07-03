import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

export type GemType = 'xp_small' | 'xp_medium' | 'xp_large' | 'health' | 'magnet';
export type GemSize = 'small' | 'medium' | 'large';

export interface GemConfig {
  type: GemType;
  value: number;
  spriteKey: string;
  scale: number;
}

// Get gem size based on wave number — 보수적 분포 (레벨업 속도 제어)
export function getGemSizeForWave(wave: number): GemSize {
  if (wave <= 8) {
    // 웨이브 1-8: small only (1 XP)
    return 'small';
  } else if (wave <= 14) {
    // 웨이브 9-14: small 80% / medium 20%
    return Math.random() < 0.8 ? 'small' : 'medium';
  } else if (wave <= 20) {
    // 웨이브 15-20: small 40% / medium 60%
    return Math.random() < 0.4 ? 'small' : 'medium';
  } else if (wave <= 26) {
    // 웨이브 21-26: medium 80% / large 20%
    return Math.random() < 0.8 ? 'medium' : 'large';
  } else {
    // 웨이브 27+: medium 50% / large 50%
    return Math.random() < 0.5 ? 'medium' : 'large';
  }
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
      spriteKey: 'gem_large',
      scale: 0.08,
    };
  } else if (size === 'medium') {
    return {
      type: 'xp_medium',
      value: xpValue,
      spriteKey: 'gem_middle',
      scale: 0.06,
    };
  } else {
    return {
      type: 'xp_small',
      value: xpValue,
      spriteKey: 'gem_small',
      scale: 0.05,
    };
  }
}

// Legacy function for backwards compatibility
function getGemConfig(xpValue: number): GemConfig {
  if (xpValue >= GAME_CONFIG.gems.large) {
    return {
      type: 'xp_large',
      value: xpValue,
      spriteKey: 'gem_large',
      scale: 0.08,
    };
  } else if (xpValue >= GAME_CONFIG.gems.medium) {
    return {
      type: 'xp_medium',
      value: xpValue,
      spriteKey: 'gem_middle',
      scale: 0.06,
    };
  } else {
    return {
      type: 'xp_small',
      value: xpValue,
      spriteKey: 'gem_small',
      scale: 0.05,
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

    // Floating animation
    scene.tweens.add({
      targets: this,
      y: y - 5,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
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
    super(scene, x, y, 'gem_health');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.healValue = healValue;
    this.setScale(0.06);
    this.setDepth(2);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.displayWidth * 0.8, this.displayHeight * 0.8);

    // Spawn animation
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: 0.06,
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
    super(scene, x, y, 'gem_magnet');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(0.06);
    this.setDepth(2);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.displayWidth * 0.8, this.displayHeight * 0.8);

    // Spawn animation
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: 0.06,
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
