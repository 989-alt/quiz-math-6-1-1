import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Butterfly extends WeaponBase {
  id = 'butterfly';
  name = 'Butterfly';
  nameKo = '나비';
  description = 'Homing butterfly attack';
  descriptionKo = '유도하는 나비 공격';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 14,
      cooldown: 1200,
      area: 1,
      speed: 180,
      duration: 5000,
      amount: 2,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 3 },
      { speed: 20 },
      { amount: 1 },
      { damage: 4 },
      { amount: 1 },
      { damage: 6 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * 200, () => {
        this.createButterfly();
      });
    }
  }

  private createButterfly(): void {
    const target = this.findClosestEnemy();
    if (!target) return;

    const speed = this.getSpeed();
    const damage = this.getDamage();
    const pierce = this.getPierce();
    const area = this.getArea();

    const colors = [0xff69b4, 0x9370db, 0x00ced1, 0xffd700];
    const color = colors[Math.floor(Math.random() * colors.length)];

    // Create butterfly shape (two wings)
    const butterfly = this.scene.add.container(this.player.x, this.player.y);

    const leftWing = this.scene.add.ellipse(-6 * area, 0, 12 * area, 16 * area, color, 0.8);
    const rightWing = this.scene.add.ellipse(6 * area, 0, 12 * area, 16 * area, color, 0.8);
    const body = this.scene.add.ellipse(0, 0, 4 * area, 10 * area, 0x000000);

    butterfly.add([leftWing, rightWing, body]);
    butterfly.setDepth(9);

    this.scene.physics.add.existing(butterfly);
    const body2 = butterfly.body as Phaser.Physics.Arcade.Body;
    body2.setSize(20 * area, 20 * area);

    (butterfly as any).damage = damage;
    (butterfly as any).pierce = pierce;

    this.scene.addProjectile(butterfly as any);

    // Wing flapping animation
    this.scene.tweens.add({
      targets: [leftWing, rightWing],
      scaleX: { from: 1, to: 0.3 },
      duration: 150,
      yoyo: true,
      repeat: -1,
    });

    // Homing with flutter
    const homingEvent = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (!butterfly.active || !target.active) {
          homingEvent.destroy();
          return;
        }
        const angle = Phaser.Math.Angle.Between(butterfly.x, butterfly.y, target.x, target.y);
        const flutter = Math.sin(Date.now() / 100) * 30;
        body2.setVelocity(
          Math.cos(angle) * speed + flutter,
          Math.sin(angle) * speed
        );
      },
      loop: true,
    });

    this.scene.time.delayedCall(this.getDuration(), () => {
      homingEvent.destroy();
      if (butterfly.active) {
        this.scene.tweens.add({
          targets: butterfly,
          alpha: 0,
          duration: 200,
          onComplete: () => butterfly.destroy(),
        });
      }
    });
  }
}
