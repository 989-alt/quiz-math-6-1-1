import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { GameScene } from '../scenes/GameScene';
import { GAME_CONFIG } from '../config';

export interface WeaponStats {
  damage: number;
  cooldown: number;
  area: number;
  speed: number;
  duration: number;
  amount: number;
  pierce: number;
  knockback: number;
}

export interface WeaponLevelData {
  damage?: number;
  cooldown?: number;
  area?: number;
  speed?: number;
  duration?: number;
  amount?: number;
  pierce?: number;
  knockback?: number;
}

export abstract class WeaponBase {
  abstract id: string;
  abstract name: string;
  abstract nameKo: string;
  abstract description: string;
  abstract descriptionKo: string;
  abstract maxLevel: number;
  evolutionPair?: string;
  evolvedForm?: string;

  protected scene: GameScene;
  protected player: Player;
  protected level: number = 1;
  protected cooldownTimer: number = 0;
  protected isEvolved: boolean = false;

  protected baseStats: WeaponStats = {
    damage: 10,
    cooldown: 1000,
    area: 1,
    speed: 200,
    duration: 1000,
    amount: 1,
    pierce: 1,
    knockback: 0,
  };

  protected levelUpgrades: WeaponLevelData[] = [];

  constructor(scene: GameScene, player: Player) {
    this.scene = scene;
    this.player = player;
  }

  abstract attack(): void;

  update(delta: number): void {
    this.cooldownTimer -= delta;

    if (this.cooldownTimer <= 0) {
      this.attack();
      this.cooldownTimer = this.getCooldown();
    }
  }

  upgrade(): void {
    if (this.level < this.maxLevel) {
      this.level++;
    }
  }

  evolve(): void {
    this.isEvolved = true;
  }

  // 무기가 그룹 밖에서 직접 들고 있는 리소스(예: RobotToy의 로봇 스프라이트) 정리 훅.
  // 게임 리셋 시 WeaponManager.destroyAll()에서 호출. 필요한 무기만 override.
  destroy(): void {}

  getLevel(): number {
    return this.level;
  }

  isMaxLevel(): boolean {
    return this.level >= this.maxLevel;
  }

  canEvolve(): boolean {
    return !this.isEvolved && this.isMaxLevel() && !!this.evolutionPair;
  }

  // Get current stats with all modifiers
  protected getDamage(): number {
    let damage = this.baseStats.damage;
    for (let i = 0; i < this.level - 1 && i < this.levelUpgrades.length; i++) {
      if (this.levelUpgrades[i].damage) {
        damage += this.levelUpgrades[i].damage!;
      }
    }
    return Math.floor(damage * this.player.damageMultiplier);
  }

  protected getCooldown(): number {
    let cooldown = this.baseStats.cooldown;
    for (let i = 0; i < this.level - 1 && i < this.levelUpgrades.length; i++) {
      if (this.levelUpgrades[i].cooldown) {
        cooldown += this.levelUpgrades[i].cooldown!;
      }
    }
    return Math.max(100, cooldown * this.player.cooldownMultiplier);
  }

  protected getArea(): number {
    let area = this.baseStats.area;
    for (let i = 0; i < this.level - 1 && i < this.levelUpgrades.length; i++) {
      if (this.levelUpgrades[i].area) {
        area += this.levelUpgrades[i].area!;
      }
    }
    return area * this.player.areaMultiplier;
  }

  protected getSpeed(): number {
    let speed = this.baseStats.speed;
    for (let i = 0; i < this.level - 1 && i < this.levelUpgrades.length; i++) {
      if (this.levelUpgrades[i].speed) {
        speed += this.levelUpgrades[i].speed!;
      }
    }
    return speed * this.player.projectileSpeedMultiplier;
  }

  protected getDuration(): number {
    let duration = this.baseStats.duration;
    for (let i = 0; i < this.level - 1 && i < this.levelUpgrades.length; i++) {
      if (this.levelUpgrades[i].duration) {
        duration += this.levelUpgrades[i].duration!;
      }
    }
    return duration * this.player.durationMultiplier;
  }

  protected getAmount(): number {
    let amount = this.baseStats.amount;
    for (let i = 0; i < this.level - 1 && i < this.levelUpgrades.length; i++) {
      if (this.levelUpgrades[i].amount) {
        amount += this.levelUpgrades[i].amount!;
      }
    }
    return amount + this.player.amountBonus;
  }

  protected getPierce(): number {
    let pierce = this.baseStats.pierce;
    for (let i = 0; i < this.level - 1 && i < this.levelUpgrades.length; i++) {
      if (this.levelUpgrades[i].pierce) {
        pierce += this.levelUpgrades[i].pierce!;
      }
    }
    return pierce;
  }

  protected getKnockback(): number {
    let knockback = this.baseStats.knockback;
    for (let i = 0; i < this.level - 1 && i < this.levelUpgrades.length; i++) {
      if (this.levelUpgrades[i].knockback) {
        knockback += this.levelUpgrades[i].knockback!;
      }
    }
    return knockback;
  }

  // Helper to create projectile
  protected createProjectile(
    x: number,
    y: number,
    texture: string,
    velocityX: number,
    velocityY: number,
    options: {
      scale?: number;
      rotation?: number;
      lifespan?: number;
      onHit?: (projectile: Phaser.Physics.Arcade.Sprite, monster: Phaser.Physics.Arcade.Sprite) => void;
    } = {}
  ): Phaser.Physics.Arcade.Sprite {
    const projectile = this.scene.physics.add.sprite(x, y, texture);
    projectile.setVelocity(velocityX, velocityY);
    projectile.setDepth(8);

    const targetScale = options.scale ? options.scale * this.getArea() : this.getArea();
    projectile.setScale(targetScale * 0.7);
    this.scene.tweens.add({
      targets: projectile,
      scale: targetScale,
      duration: 80,
      ease: 'Sine.easeOut',
    });

    if (options.rotation !== undefined) {
      projectile.setRotation(options.rotation);
    } else {
      projectile.setRotation(Math.atan2(velocityY, velocityX));
    }

    // Store pierce count and damage - use direct properties for collision detection
    (projectile as any).pierce = this.getPierce();
    (projectile as any).damage = this.getDamage();

    // Auto destroy after duration
    const lifespan = options.lifespan ?? this.getDuration();
    this.scene.time.delayedCall(lifespan, () => {
      if (projectile.active) {
        projectile.destroy();
      }
    });

    // Add to projectiles group
    this.scene.addProjectile(projectile);

    return projectile;
  }

  // Helper to play impact effect on hit (kind: 'hit_small' | 'hit_large' | 'poof' | 'explosion' | 'splash' | 'burn' | 'levelup' | 'heal' | 'collect')
  protected playImpact(x: number, y: number, kind: string): void {
    if (kind === 'hit_small') {
      this.scene.fx.hit(x, y, 'small');
    } else if (kind === 'hit_large') {
      this.scene.fx.hit(x, y, 'large');
    } else if (kind === 'poof') {
      this.scene.fx.poof(x, y);
    } else {
      this.scene.fx.burst(kind, x, y);
    }
  }

  // Helper to find closest enemy within auto-aim range (off-screen monsters ignored)
  protected findClosestEnemy(maxRange?: number): Phaser.Physics.Arcade.Sprite | null {
    const monsters = this.scene.getMonsters();
    const range = maxRange ?? GAME_CONFIG.combat.autoAimRange;
    let closest: Phaser.Physics.Arcade.Sprite | null = null;
    let closestDist = Infinity;

    monsters.getChildren().forEach((monster) => {
      const m = monster as Phaser.Physics.Arcade.Sprite;
      if (!m.active) return;

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
      if (dist <= range && dist < closestDist) {
        closestDist = dist;
        closest = m;
      }
    });

    return closest;
  }

  // Helper to find random enemy in range
  protected findRandomEnemyInRange(range: number): Phaser.Physics.Arcade.Sprite | null {
    const monsters = this.scene.getMonsters();
    const inRange: Phaser.Physics.Arcade.Sprite[] = [];

    monsters.getChildren().forEach((monster) => {
      const m = monster as Phaser.Physics.Arcade.Sprite;
      if (!m.active) return;

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
      if (dist <= range) {
        inRange.push(m);
      }
    });

    if (inRange.length === 0) return null;
    return inRange[Math.floor(Math.random() * inRange.length)];
  }

  getInfo(): { id: string; name: string; nameKo: string; description: string; descriptionKo: string; level: number; maxLevel: number; evolutionPair?: string } {
    return {
      id: this.id,
      name: this.name,
      nameKo: this.nameKo,
      description: this.description,
      descriptionKo: this.descriptionKo,
      level: this.level,
      maxLevel: this.maxLevel,
      evolutionPair: this.evolutionPair,
    };
  }
}
