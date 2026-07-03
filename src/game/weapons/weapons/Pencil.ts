import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Pencil extends WeaponBase {
  id = 'pencil';
  name = 'Pencil';
  nameKo = '연필';
  description = 'Fast straight shots';
  descriptionKo = '빠른 직선 공격';
  maxLevel = 8;

  private lastDirection: number = 1;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 12,
      cooldown: 400,
      area: 1,
      speed: 500,
      duration: 2000,
      amount: 1,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 3 },
      { speed: 50 },
      { amount: 1 },
      { damage: 5 },
      { pierce: 1 },
      { damage: 8 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const speed = this.getSpeed();
    const damage = this.getDamage();
    const pierce = this.getPierce();
    const area = this.getArea();

    // Track player facing direction
    if (this.player.body) {
      const vel = this.player.body.velocity;
      if (vel.x !== 0 || vel.y !== 0) {
        this.lastDirection = Math.atan2(vel.y, vel.x);
      }
    }

    for (let i = 0; i < amount; i++) {
      const spread = (i - (amount - 1) / 2) * 0.15;
      const angle = this.lastDirection + spread;

      // Use actual sprite
      const pencil = this.scene.add.sprite(
        this.player.x,
        this.player.y,
        'weapon_pencil'
      );
      pencil.setScale(0.05 * area);
      pencil.setRotation(angle);
      pencil.setDepth(9);

      this.scene.physics.add.existing(pencil);
      const body = pencil.body as Phaser.Physics.Arcade.Body;
      body.setSize(pencil.displayWidth * 0.8, pencil.displayHeight * 0.5);
      body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

      (pencil as any).damage = damage;
      (pencil as any).pierce = pierce;

      this.scene.addProjectile(pencil as any);

      this.scene.time.delayedCall(this.getDuration(), () => {
        if (pencil.active) pencil.destroy();
      });
    }
  }
}
