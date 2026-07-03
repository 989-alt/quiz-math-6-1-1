import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Bone extends WeaponBase {
  id = 'bone';
  name = 'Bone';
  nameKo = '뼈';
  description = 'Bouncing projectile';
  descriptionKo = '바운스하는 투사체';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 15,
      cooldown: 1500,
      area: 1,
      speed: 250,
      duration: 4000,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { amount: 1 },
      { speed: 30 },
      { damage: 5 },
      { amount: 1 },
      { damage: 10 },
      { speed: 50 },
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
      this.throwBone(angle, speed, damage, area, duration);
    }
  }

  private throwBone(angle: number, speed: number, damage: number, area: number, duration: number): void {
    const bone = this.scene.add.rectangle(
      this.player.x,
      this.player.y,
      20 * area,
      8 * area,
      0xf5f5dc
    );
    bone.setDepth(8);

    this.scene.physics.add.existing(bone);
    const body = bone.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    body.setBounce(1, 1);
    body.setCollideWorldBounds(true);

    (bone as any).damage = damage;
    (bone as any).pierce = 999;

    this.scene.addProjectile(bone as any);

    // Rotation
    this.scene.tweens.add({
      targets: bone,
      rotation: Math.PI * 8,
      duration: duration,
      ease: 'Linear',
    });

    this.scene.time.delayedCall(duration, () => {
      if (bone.active) bone.destroy();
    });
  }
}
