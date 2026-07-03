import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Lightning extends WeaponBase {
  id = 'lightning';
  name = 'Lightning Ring';
  nameKo = '번개 반지';
  description = 'Strikes random enemies';
  descriptionKo = '무작위 적을 타격합니다';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 25,
      cooldown: 800,
      area: 1,
      speed: 0,
      duration: 200,
      amount: 1,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 10 },
      { amount: 1 },
      { damage: 10 },
      { area: 0.3 },
      { amount: 1 },
      { damage: 10 },
      { damage: 15 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();

    for (let i = 0; i < amount; i++) {
      const target = this.findRandomEnemyInRange(500);
      if (target) {
        this.strikeLightning(target.x, target.y, damage, area);
      }
    }
  }

  private strikeLightning(x: number, y: number, damage: number, area: number): void {
    // Lightning bolt effect
    const bolt = this.scene.add.rectangle(x, y - 100, 8 * area, 200, 0xffff00);
    bolt.setDepth(10);
    bolt.setAlpha(0.8);

    // Impact circle
    const impact = this.scene.add.circle(x, y, 24 * area, 0xffff00, 0.6);
    impact.setDepth(9);

    this.scene.physics.add.existing(impact);
    (impact as any).damage = damage;
    (impact as any).pierce = 1;

    this.scene.addProjectile(impact as any);

    // Animation
    this.scene.tweens.add({
      targets: bolt,
      alpha: 0,
      scaleX: 0.5,
      duration: 200,
      onComplete: () => bolt.destroy(),
    });

    this.scene.tweens.add({
      targets: impact,
      alpha: 0,
      scale: 2,
      duration: 200,
      onComplete: () => impact.destroy(),
    });

    // Screen flash effect
    const flash = this.scene.add.rectangle(
      this.scene.cameras.main.scrollX + this.scene.cameras.main.width / 2,
      this.scene.cameras.main.scrollY + this.scene.cameras.main.height / 2,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0xffff00,
      0.1
    );
    flash.setDepth(100);
    flash.setScrollFactor(0);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 100,
      onComplete: () => flash.destroy(),
    });
  }
}
