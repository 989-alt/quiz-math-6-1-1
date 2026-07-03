import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Runetracer extends WeaponBase {
  id = 'runetracer';
  name = 'Runetracer';
  nameKo = '룬트레이서';
  description = 'Bounces off walls';
  descriptionKo = '벽에 반사됩니다';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 12,
      cooldown: 2000,
      area: 1,
      speed: 300,
      duration: 5000,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { speed: 30 },
      { damage: 5 },
      { duration: 1000 },
      { amount: 1 },
      { damage: 5 },
      { speed: 30 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const speed = this.getSpeed();
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.createRune(angle, speed, damage, area, duration);
    }
  }

  private createRune(angle: number, speed: number, damage: number, area: number, duration: number): void {
    const rune = this.scene.add.circle(
      this.player.x,
      this.player.y,
      12 * area,
      0x9370db
    );
    rune.setDepth(8);

    this.scene.physics.add.existing(rune);
    const body = rune.body as Phaser.Physics.Arcade.Body;

    body.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
    body.setBounce(1, 1);
    body.setCollideWorldBounds(true);

    (rune as any).damage = damage;
    (rune as any).pierce = 999;

    this.scene.addProjectile(rune as any);

    // Trail effect
    const trailTimer = this.scene.time.addEvent({
      delay: 50,
      repeat: -1,
      callback: () => {
        if (!rune.active) {
          trailTimer.destroy();
          return;
        }

        const trail = this.scene.add.circle(
          rune.x,
          rune.y,
          8 * area,
          0x9370db,
          0.5
        );
        trail.setDepth(7);

        this.scene.tweens.add({
          targets: trail,
          alpha: 0,
          scale: 0.5,
          duration: 200,
          onComplete: () => trail.destroy(),
        });
      },
    });

    // Destroy after duration
    this.scene.time.delayedCall(duration, () => {
      trailTimer.destroy();
      if (rune.active) {
        this.scene.tweens.add({
          targets: rune,
          alpha: 0,
          scale: 0,
          duration: 200,
          onComplete: () => rune.destroy(),
        });
      }
    });
  }
}
