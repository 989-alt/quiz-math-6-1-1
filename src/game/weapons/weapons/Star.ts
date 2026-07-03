import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Star extends WeaponBase {
  id = 'star';
  name = 'Star';
  nameKo = '별';
  description = 'Random lightning strikes';
  descriptionKo = '무작위 별똥별 공격';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 40,
      cooldown: 1800,
      area: 1,
      speed: 0,
      duration: 300,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 10 },
      { amount: 1 },
      { cooldown: -100 },
      { damage: 12 },
      { amount: 1 },
      { damage: 15 },
      { amount: 1 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * 100, () => {
        this.createStarStrike();
      });
    }
  }

  private createStarStrike(): void {
    const target = this.findRandomEnemyInRange(400);
    if (!target) return;

    const damage = this.getDamage();
    const area = this.getArea();

    // Create star above target
    const startY = target.y - 200;

    const star = this.scene.add.star(
      target.x,
      startY,
      5,
      8 * area,
      16 * area,
      0xffd700 // Gold star
    );
    star.setDepth(10);

    // Fall animation
    this.scene.tweens.add({
      targets: star,
      y: target.y,
      rotation: Math.PI * 2,
      duration: 300,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // Impact effect
        const impact = this.scene.add.circle(
          target.x,
          target.y,
          30 * area,
          0xffd700,
          0.7
        );
        impact.setDepth(9);

        this.scene.physics.add.existing(impact);
        (impact as any).damage = damage;
        (impact as any).pierce = 999;

        this.scene.addProjectile(impact as any);

        // Sparkle particles
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const sparkle = this.scene.add.star(
            target.x + Math.cos(angle) * 10,
            target.y + Math.sin(angle) * 10,
            4,
            3 * area,
            6 * area,
            0xffff00
          );
          sparkle.setDepth(10);

          this.scene.tweens.add({
            targets: sparkle,
            x: target.x + Math.cos(angle) * 40 * area,
            y: target.y + Math.sin(angle) * 40 * area,
            alpha: 0,
            scale: 0.3,
            duration: 300,
            onComplete: () => sparkle.destroy(),
          });
        }

        this.scene.tweens.add({
          targets: impact,
          alpha: 0,
          scale: 2,
          duration: 200,
          onComplete: () => impact.destroy(),
        });

        star.destroy();
      },
    });
  }
}
