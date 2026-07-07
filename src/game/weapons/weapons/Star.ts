import Phaser from 'phaser';
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

    // 화면 상단서 랜덤 낙하 (착지 지점은 대상 위치로 수렴)
    const cam = this.scene.cameras.main;
    const startY = cam.scrollY - 60;
    const startX = target.x + Phaser.Math.Between(-60, 60) * area;

    // 별 픽셀아트 스프라이트 (기존 별 도형 지름 ~32px 상당 크기로 스케일)
    const star = this.scene.add.sprite(startX, startY, 'weapon_star');
    const targetScale = (32 * area) / star.width;
    star.setDepth(10);
    star.setScale(targetScale * 0.6);

    // Fall animation (낙하하며 커지는 것이 스폰 팝을 겸한다)
    this.scene.tweens.add({
      targets: star,
      x: target.x,
      y: target.y,
      scale: targetScale,
      rotation: Math.PI * 2,
      duration: 300,
      ease: 'Quad.easeIn',
      onComplete: () => {
        // 착지 플래시
        this.playImpact(target.x, target.y, 'hit_large');

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

        // 별가루: 작은 별 스프라이트가 사방으로 흩어진다
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const sparkle = this.scene.add.sprite(
            target.x + Math.cos(angle) * 10,
            target.y + Math.sin(angle) * 10,
            'weapon_star'
          );
          sparkle.setScale(targetScale * 0.35);
          sparkle.setDepth(10);

          this.scene.tweens.add({
            targets: sparkle,
            x: target.x + Math.cos(angle) * 40 * area,
            y: target.y + Math.sin(angle) * 40 * area,
            alpha: 0,
            scale: targetScale * 0.1,
            rotation: Math.PI,
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
