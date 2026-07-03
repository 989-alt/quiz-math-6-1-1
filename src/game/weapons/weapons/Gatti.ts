import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Gatti extends WeaponBase {
  id = 'gatti';
  name = 'Gatti Amari';
  nameKo = '가티 아마리';
  description = 'Summons cat companions';
  descriptionKo = '고양이 동료를 소환합니다';
  maxLevel = 8;

  private cats: Phaser.GameObjects.Arc[] = [];

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 8,
      cooldown: 2000,
      area: 1,
      speed: 150,
      duration: 5000,
      amount: 1,
      pierce: 3,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 3 },
      { amount: 1 },
      { damage: 3 },
      { amount: 1 },
      { damage: 5 },
      { amount: 1 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();
    const speed = this.getSpeed();
    const duration = this.getDuration();

    // Clean up old cats
    this.cats = this.cats.filter(c => c.active);

    for (let i = 0; i < amount; i++) {
      if (this.cats.length >= amount * 2) break;
      this.summonCat(damage, area, speed, duration);
    }
  }

  private summonCat(damage: number, area: number, speed: number, duration: number): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 50;

    const cat = this.scene.add.circle(
      this.player.x + Math.cos(angle) * dist,
      this.player.y + Math.sin(angle) * dist,
      10 * area,
      0xffa500
    );
    cat.setDepth(8);

    this.scene.physics.add.existing(cat);
    (cat as any).damage = damage;
    (cat as any).pierce = this.getPierce();

    this.scene.addProjectile(cat as any);
    this.cats.push(cat);

    // Random wandering behavior
    const wander = () => {
      if (!cat.active) return;

      const target = this.findRandomEnemyInRange(300);
      if (target) {
        const a = Phaser.Math.Angle.Between(cat.x, cat.y, target.x, target.y);
        (cat.body as Phaser.Physics.Arcade.Body).setVelocity(
          Math.cos(a) * speed,
          Math.sin(a) * speed
        );
      } else {
        const randomAngle = Math.random() * Math.PI * 2;
        (cat.body as Phaser.Physics.Arcade.Body).setVelocity(
          Math.cos(randomAngle) * speed * 0.5,
          Math.sin(randomAngle) * speed * 0.5
        );
      }

      this.scene.time.delayedCall(500, wander);
    };
    wander();

    this.scene.time.delayedCall(duration, () => {
      if (cat.active) {
        this.scene.tweens.add({
          targets: cat,
          alpha: 0,
          duration: 200,
          onComplete: () => cat.destroy(),
        });
      }
    });
  }
}
