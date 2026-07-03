import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class LunchBox extends WeaponBase {
  id = 'lunch_box';
  name = 'Lunch Box';
  nameKo = '도시락';
  description = 'Explosive area damage';
  descriptionKo = '폭발하는 도시락';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 35,
      cooldown: 3000,
      area: 1,
      speed: 150,
      duration: 1000,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 8 },
      { area: 0.15 },
      { cooldown: -200 },
      { damage: 10 },
      { area: 0.15 },
      { amount: 1 },
      { damage: 15 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      const target = this.findRandomEnemyInRange(300);
      if (target) {
        this.throwLunchBox(target.x, target.y);
      } else {
        const angle = Math.random() * Math.PI * 2;
        const dist = 100 + Math.random() * 100;
        this.throwLunchBox(
          this.player.x + Math.cos(angle) * dist,
          this.player.y + Math.sin(angle) * dist
        );
      }
    }
  }

  private throwLunchBox(targetX: number, targetY: number): void {
    const damage = this.getDamage();
    const area = this.getArea();

    const lunchBox = this.scene.add.rectangle(
      this.player.x,
      this.player.y,
      32 * area,
      24 * area,
      0xff6b6b // Red lunch box
    );
    lunchBox.setDepth(9);
    lunchBox.setStrokeStyle(2, 0xcc5555);

    // Arc throw animation
    this.scene.tweens.add({
      targets: lunchBox,
      x: targetX,
      y: targetY,
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Explosion effect
        const explosion = this.scene.add.circle(
          targetX,
          targetY,
          48 * area,
          0xffa500,
          0.7
        );
        explosion.setDepth(8);

        this.scene.physics.add.existing(explosion);

        (explosion as any).damage = damage;
        (explosion as any).pierce = 999;

        this.scene.addProjectile(explosion as any);

        this.scene.tweens.add({
          targets: explosion,
          scaleX: 1.5,
          scaleY: 1.5,
          alpha: 0,
          duration: 300,
          onComplete: () => explosion.destroy(),
        });

        lunchBox.destroy();
      },
    });

    // Rotation during flight
    this.scene.tweens.add({
      targets: lunchBox,
      rotation: Math.PI * 2,
      duration: 500,
    });
  }
}
