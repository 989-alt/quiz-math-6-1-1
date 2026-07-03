import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Whip extends WeaponBase {
  id = 'whip';
  name = 'Whip';
  nameKo = '채찍';
  description = 'Attacks horizontally, passes through enemies';
  descriptionKo = '수평으로 공격하며, 적을 관통합니다';
  maxLevel = 8;
  evolutionPair = 'hollow_heart';
  evolvedForm = 'bloody_tear';

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 20,
      cooldown: 1100,
      area: 1,
      speed: 0,
      duration: 300,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { area: 0.1 },
      { damage: 5 },
      { amount: 1 },
      { damage: 5 },
      { area: 0.1 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    for (let i = 0; i < amount; i++) {
      const direction = i % 2 === 0 ? 1 : -1;
      const offsetY = (i - Math.floor(amount / 2)) * 20;

      this.createWhipAttack(direction, offsetY, damage, area, duration);
    }
  }

  private createWhipAttack(direction: number, offsetY: number, damage: number, area: number, duration: number): void {
    const whip = this.scene.add.rectangle(
      this.player.x + direction * 40 * area,
      this.player.y + offsetY,
      80 * area,
      16 * area,
      this.isEvolved ? 0xff0000 : 0x8b4513
    );
    whip.setDepth(9);

    this.scene.physics.add.existing(whip);
    const body = whip.body as Phaser.Physics.Arcade.Body;

    // Store damage data
    (whip as any).damage = damage;
    (whip as any).pierce = 999;

    // Add to projectiles for collision detection
    this.scene.addProjectile(whip as any);

    // Animate
    this.scene.tweens.add({
      targets: whip,
      scaleX: { from: 0, to: 1 },
      alpha: { from: 1, to: 0 },
      duration: duration,
      onComplete: () => {
        whip.destroy();
      },
    });
  }
}
