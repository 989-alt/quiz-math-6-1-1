import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class SantaWater extends WeaponBase {
  id = 'santa_water';
  name = 'Santa Water';
  nameKo = '성수';
  description = 'Creates damaging zone';
  descriptionKo = '데미지 구역을 생성합니다';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 10,
      cooldown: 3000,
      area: 1,
      speed: 0,
      duration: 3000,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { duration: 500 },
      { damage: 5 },
      { amount: 1 },
      { area: 0.2 },
      { damage: 5 },
      { duration: 500 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 150 + 50;
      const x = this.player.x + Math.cos(angle) * dist;
      const y = this.player.y + Math.sin(angle) * dist;

      this.createWaterZone(x, y, damage, area, duration);
    }
  }

  private createWaterZone(x: number, y: number, damage: number, area: number, duration: number): void {
    const zone = this.scene.add.circle(x, y, 48 * area, 0x87ceeb, 0.5);
    zone.setDepth(2);

    this.scene.physics.add.existing(zone);
    (zone as any).damage = Math.floor(damage / 5); // Tick damage
    (zone as any).pierce = 999;

    this.scene.addProjectile(zone as any);

    // Spawn animation
    this.scene.tweens.add({
      targets: zone,
      scale: { from: 0, to: 1 },
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Bubble effect
    const bubbleTimer = this.scene.time.addEvent({
      delay: 200,
      repeat: Math.floor(duration / 200),
      callback: () => {
        if (!zone.active) return;

        const bubble = this.scene.add.circle(
          zone.x + (Math.random() - 0.5) * 40 * area,
          zone.y + (Math.random() - 0.5) * 40 * area,
          4,
          0xffffff,
          0.6
        );
        bubble.setDepth(3);

        this.scene.tweens.add({
          targets: bubble,
          y: bubble.y - 20,
          alpha: 0,
          duration: 500,
          onComplete: () => bubble.destroy(),
        });
      },
    });

    // Destroy after duration
    this.scene.time.delayedCall(duration, () => {
      bubbleTimer.destroy();
      this.scene.tweens.add({
        targets: zone,
        alpha: 0,
        scale: 0.5,
        duration: 200,
        onComplete: () => zone.destroy(),
      });
    });
  }
}
