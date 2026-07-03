import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class PaperPlane extends WeaponBase {
  id = 'paper_plane';
  name = 'Paper Plane';
  nameKo = '종이비행기';
  description = 'Homing paper planes';
  descriptionKo = '유도하는 종이비행기';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 18,
      cooldown: 1400,
      area: 1,
      speed: 250,
      duration: 4000,
      amount: 1,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 4 },
      { amount: 1 },
      { speed: 30 },
      { damage: 5 },
      { amount: 1 },
      { damage: 6 },
      { pierce: 1 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * 150, () => {
        this.createPaperPlane();
      });
    }
  }

  private createPaperPlane(): void {
    const target = this.findClosestEnemy();
    if (!target) return;

    const speed = this.getSpeed();
    const damage = this.getDamage();
    const pierce = this.getPierce();
    const area = this.getArea();

    // Use actual sprite
    const plane = this.scene.add.sprite(
      this.player.x,
      this.player.y,
      'weapon_paper_plane'
    );
    plane.setScale(0.05 * area);
    plane.setDepth(9);

    this.scene.physics.add.existing(plane);
    const body = plane.body as Phaser.Physics.Arcade.Body;
    body.setSize(plane.displayWidth * 0.8, plane.displayHeight * 0.8);

    (plane as any).damage = damage;
    (plane as any).pierce = pierce;

    this.scene.addProjectile(plane as any);

    // Homing behavior
    const homingEvent = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (!plane.active || !target.active) {
          homingEvent.destroy();
          return;
        }
        const angle = Phaser.Math.Angle.Between(plane.x, plane.y, target.x, target.y);
        body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        plane.setRotation(angle);
      },
      loop: true,
    });

    this.scene.time.delayedCall(this.getDuration(), () => {
      homingEvent.destroy();
      if (plane.active) plane.destroy();
    });
  }
}
