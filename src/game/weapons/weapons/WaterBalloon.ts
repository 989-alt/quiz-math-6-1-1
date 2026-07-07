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

    // 물풍선 픽셀아트 스프라이트 (기존 타원 높이 ~24px 상당 크기로 스케일)
    const balloon = this.scene.add.sprite(
      this.player.x,
      this.player.y,
      'weapon_water_balloon'
    );
    const targetScale = (24 * area) / balloon.height;
    balloon.setScale(targetScale * 0.7);
    balloon.setDepth(9);

    // 스폰 스케일 팝 (0.7 → 1.0, 80ms)
    this.scene.tweens.add({
      targets: balloon,
      scale: targetScale,
      duration: 80,
      ease: 'Sine.easeOut',
    });

    // Wobble scale while airborne
    this.scene.tweens.add({
      targets: balloon,
      scaleX: targetScale * 1.15,
      scaleY: targetScale * 0.85,
      duration: 100,
      delay: 80,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
    });

    this.scene.tweens.add({
      targets: balloon,
      x: targetX,
      y: targetY,
      duration: 400,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.playImpact(targetX, targetY, 'splash');

        // 늪 존 — 착탄 지점에 3초간 잔존, 위에 있는 적 50% 감속
        this.spawnHazard(targetX, targetY, {
          radius: 75 * area,
          duration: 3000,
          slowFactor: 0.5,
          tint: 0x3366cc,
          alpha: 0.28,
        });

        // Slow ring (visual only, marks the splash's slow zone)
        const slowRing = this.scene.add.circle(targetX, targetY, 30 * area, 0x000000, 0);
        slowRing.setStrokeStyle(3, 0xffffff, 0.8);
        slowRing.setDepth(8);
        this.scene.tweens.add({
          targets: slowRing,
          scale: 2,
          alpha: 0,
          duration: 500,
          onComplete: () => slowRing.destroy(),
        });

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

        // Main splash zone (스플래시 데미지 반경 +40%: 40 → 56)
        const splashZone = this.scene.add.circle(
          targetX,
          targetY,
          56 * area,
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
