import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Phiera extends WeaponBase {
  id = 'phiera';
  name = 'Phiera Der Tuphello';
  nameKo = '피에라';
  description = 'Fires crossing beams';
  descriptionKo = '교차하는 광선을 발사합니다';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 15,
      cooldown: 1200,
      area: 1,
      speed: 400,
      duration: 1500,
      amount: 2,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { amount: 1 },
      { damage: 5 },
      { speed: 50 },
      { amount: 1 },
      { damage: 10 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const speed = this.getSpeed();
    const damage = this.getDamage();
    const area = this.getArea();

    for (let i = 0; i < amount; i++) {
      const angle = (Math.PI / amount) * i;
      this.createBeam(angle, speed, damage, area);
      this.createBeam(angle + Math.PI, speed, damage, area);
    }
  }

  private createBeam(angle: number, speed: number, damage: number, area: number): void {
    const beam = this.scene.add.rectangle(
      this.player.x,
      this.player.y,
      40 * area,
      8 * area,
      0xff6600
    );
    beam.setRotation(angle);
    beam.setDepth(8);

    this.scene.physics.add.existing(beam);
    (beam.body as Phaser.Physics.Arcade.Body).setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );

    (beam as any).damage = damage;
    (beam as any).pierce = 999;

    this.scene.addProjectile(beam as any);

    this.scene.time.delayedCall(this.getDuration(), () => {
      if (beam.active) beam.destroy();
    });
  }
}
