import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Crayon extends WeaponBase {
  id = 'crayon';
  name = 'Crayon';
  nameKo = '크레파스';
  description = 'Draws rainbow damage';
  descriptionKo = '무지개 선을 그리는 크레파스';
  maxLevel = 8;

  private colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x8b00ff];

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 15,
      cooldown: 1500,
      area: 1,
      speed: 300,
      duration: 800,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 4 },
      { area: 0.1 },
      { amount: 1 },
      { damage: 5 },
      { duration: 100 },
      { damage: 6 },
      { amount: 1 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      const angle = (i / amount) * Math.PI * 2;
      this.createCrayonLine(angle);
    }
  }

  private createCrayonLine(baseAngle: number): void {
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();
    const length = 100 * area;

    // Create rainbow line segments
    const segmentCount = 6;
    for (let i = 0; i < segmentCount; i++) {
      const color = this.colors[i % this.colors.length];
      const segmentLength = length / segmentCount;
      const distance = i * segmentLength;

      this.scene.time.delayedCall(i * 50, () => {
        const x = this.player.x + Math.cos(baseAngle) * (distance + segmentLength / 2);
        const y = this.player.y + Math.sin(baseAngle) * (distance + segmentLength / 2);

        const segment = this.scene.add.rectangle(
          x, y,
          segmentLength,
          12 * area,
          color,
          0.9
        );
        segment.setRotation(baseAngle);
        segment.setDepth(9);

        this.scene.physics.add.existing(segment);

        (segment as any).damage = damage / 2;
        (segment as any).pierce = 999;

        this.scene.addProjectile(segment as any);

        this.scene.tweens.add({
          targets: segment,
          alpha: 0,
          scaleY: 0.5,
          duration: duration,
          delay: 200,
          onComplete: () => segment.destroy(),
        });
      });
    }
  }
}
