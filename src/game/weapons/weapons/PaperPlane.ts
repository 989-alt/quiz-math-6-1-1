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
    plane.setScale(1.0 * area);
    plane.setDepth(9);

    this.scene.physics.add.existing(plane);
    const body = plane.body as Phaser.Physics.Arcade.Body;
    body.setSize(plane.width * 0.8, plane.height * 0.8);

    // Spawn scale pop (0.7 -> 1.0)
    plane.setScale(1.0 * area * 0.7);
    this.scene.tweens.add({
      targets: plane,
      scale: 1.0 * area,
      duration: 80,
      ease: 'Sine.easeOut',
    });

    (plane as any).damage = damage;
    (plane as any).pierce = pierce;

    this.scene.addProjectile(plane as any);

    // Impact effect on first contact with each monster
    const hitMonsters = new Set<Phaser.Physics.Arcade.Sprite>();
    const fxCollider = this.scene.physics.add.overlap(plane, this.scene.getMonsters(), (_p, monster) => {
      const m = monster as Phaser.Physics.Arcade.Sprite;
      if (hitMonsters.has(m)) return;
      hitMonsters.add(m);
      this.playImpact(m.x, m.y, 'hit_small');
    });
    plane.once('destroy', () => fxCollider.destroy());

    // Homing glide: sine-wave steering + banking roll
    const startTime = this.scene.time.now;
    const homingEvent = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (!plane.active || !target.active) {
          homingEvent.destroy();
          return;
        }
        const elapsed = this.scene.time.now - startTime;
        const baseAngle = Phaser.Math.Angle.Between(plane.x, plane.y, target.x, target.y);
        const sway = Math.sin(elapsed / 180) * 0.5;
        const moveAngle = baseAngle + sway;
        body.setVelocity(Math.cos(moveAngle) * speed, Math.sin(moveAngle) * speed);
        const bank = Math.sin(elapsed / 120) * 0.35;
        plane.setRotation(moveAngle + bank);
      },
      loop: true,
    });

    this.scene.time.delayedCall(this.getDuration(), () => {
      homingEvent.destroy();
      if (plane.active) {
        this.scene.tweens.add({
          targets: plane,
          alpha: 0,
          duration: 200,
          onComplete: () => plane.destroy(),
        });
      }
    });
  }
}
