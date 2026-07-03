import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class WaterBalloon extends WeaponBase {
  id = 'water_balloon';
  name = 'Water Balloon';
  nameKo = '물풍선';
  description = 'Splash damage on impact';
  descriptionKo = '터지면 튀는 물풍선';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 25,
      cooldown: 2000,
      area: 1,
      speed: 200,
      duration: 600,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { area: 0.15 },
      { amount: 1 },
      { damage: 6 },
      { cooldown: -150 },
      { area: 0.15 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      const target = this.findRandomEnemyInRange(250);
      if (target) {
        this.throwBalloon(target.x, target.y);
      } else {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 80;
        this.throwBalloon(
          this.player.x + Math.cos(angle) * dist,
          this.player.y + Math.sin(angle) * dist
        );
      }
    }
  }

  private throwBalloon(targetX: number, targetY: number): void {
    const damage = this.getDamage();
    const area = this.getArea();

    const balloon = this.scene.add.ellipse(
      this.player.x,
      this.player.y,
      20 * area,
      24 * area,
      0x00bfff, // Deep sky blue
      0.8
    );
    balloon.setDepth(9);

    // Arc throw
    const midX = (this.player.x + targetX) / 2;
    const midY = Math.min(this.player.y, targetY) - 50;

    this.scene.tweens.add({
      targets: balloon,
      x: targetX,
      y: targetY,
      duration: 400,
      ease: 'Sine.easeIn',
      onComplete: () => {
        // Splash effect
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const splash = this.scene.add.circle(
            targetX + Math.cos(angle) * 20 * area,
            targetY + Math.sin(angle) * 20 * area,
            8 * area,
            0x87ceeb,
            0.7
          );
          splash.setDepth(8);

          this.scene.physics.add.existing(splash);
          (splash as any).damage = damage / 3;
          (splash as any).pierce = 999;
          this.scene.addProjectile(splash as any);

          this.scene.tweens.add({
            targets: splash,
            x: targetX + Math.cos(angle) * 50 * area,
            y: targetY + Math.sin(angle) * 50 * area,
            alpha: 0,
            scale: 0.5,
            duration: 300,
            onComplete: () => splash.destroy(),
          });
        }

        // Main splash zone
        const splashZone = this.scene.add.circle(
          targetX,
          targetY,
          40 * area,
          0x00bfff,
          0.5
        );
        splashZone.setDepth(7);

        this.scene.physics.add.existing(splashZone);
        (splashZone as any).damage = damage;
        (splashZone as any).pierce = 999;
        this.scene.addProjectile(splashZone as any);

        this.scene.tweens.add({
          targets: splashZone,
          alpha: 0,
          scale: 1.5,
          duration: 300,
          onComplete: () => splashZone.destroy(),
        });

        balloon.destroy();
      },
    });
  }
}
