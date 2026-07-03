import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Cross extends WeaponBase {
  id = 'cross';
  name = 'Cross';
  nameKo = '십자가';
  description = 'Boomerang that returns';
  descriptionKo = '돌아오는 부메랑입니다';
  maxLevel = 8;
  evolutionPair = 'clover';
  evolvedForm = 'heaven_sword';

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 15,
      cooldown: 1000,
      area: 1,
      speed: 350,
      duration: 2500,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { speed: 30 },
      { damage: 5 },
      { area: 0.15 },
      { amount: 1 },
      { damage: 5 },
      { speed: 30 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const speed = this.getSpeed();
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    for (let i = 0; i < amount; i++) {
      const angle = (Math.PI * 2 * i) / amount + Math.random() * 0.5;
      this.scene.time.delayedCall(i * 100, () => {
        this.throwCross(angle, speed, damage, area, duration);
      });
    }
  }

  private throwCross(angle: number, speed: number, damage: number, area: number, duration: number): void {
    const cross = this.scene.physics.add.sprite(
      this.player.x,
      this.player.y,
      'projectile_cross'
    );

    cross.setScale(area);
    cross.setDepth(8);
    cross.setData('damage', damage);
    cross.setData('pierce', 999);

    // Initial velocity
    cross.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );

    // Rotation
    this.scene.tweens.add({
      targets: cross,
      rotation: Math.PI * 6,
      duration: duration,
      ease: 'Linear',
    });

    // Boomerang effect - slow down and return
    this.scene.tweens.add({
      targets: cross.body!.velocity,
      x: 0,
      y: 0,
      duration: duration * 0.4,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Return to player
        this.scene.tweens.add({
          targets: cross,
          x: this.player.x,
          y: this.player.y,
          duration: duration * 0.5,
          ease: 'Sine.easeIn',
          onComplete: () => {
            cross.destroy();
          },
        });
      },
    });

    this.scene.addProjectile(cross);
  }
}
