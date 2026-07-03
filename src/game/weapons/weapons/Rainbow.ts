import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Rainbow extends WeaponBase {
  id = 'rainbow';
  name = 'Rainbow';
  nameKo = '무지개';
  description = 'Rainbow wave attack';
  descriptionKo = '무지개 파동 공격';
  maxLevel = 8;

  private colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x8b00ff];

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 20,
      cooldown: 2500,
      area: 1,
      speed: 0,
      duration: 800,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { area: 0.15 },
      { damage: 5 },
      { duration: 100 },
      { damage: 8 },
      { area: 0.15 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      const angle = (i / amount) * Math.PI * 2;
      this.createRainbowWave(angle);
    }
  }

  private createRainbowWave(baseAngle: number): void {
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    // Create rainbow arc
    this.colors.forEach((color, i) => {
      const arcRadius = (50 + i * 10) * area;
      const startAngle = baseAngle - Math.PI / 4;
      const endAngle = baseAngle + Math.PI / 4;

      this.scene.time.delayedCall(i * 30, () => {
        // Create arc as multiple small segments
        const segments = 8;
        for (let s = 0; s < segments; s++) {
          const segAngle = startAngle + (s / segments) * (endAngle - startAngle);
          const x = this.player.x + Math.cos(segAngle) * arcRadius;
          const y = this.player.y + Math.sin(segAngle) * arcRadius;

          const segment = this.scene.add.circle(x, y, 8 * area, color, 0.8);
          segment.setDepth(9);

          this.scene.physics.add.existing(segment);
          (segment as any).damage = damage / 3;
          (segment as any).pierce = 999;

          this.scene.addProjectile(segment as any);

          // Expand outward
          this.scene.tweens.add({
            targets: segment,
            x: this.player.x + Math.cos(segAngle) * (arcRadius + 100 * area),
            y: this.player.y + Math.sin(segAngle) * (arcRadius + 100 * area),
            alpha: 0,
            scale: 0.5,
            duration: duration,
            onComplete: () => segment.destroy(),
          });
        }
      });
    });
  }
}
