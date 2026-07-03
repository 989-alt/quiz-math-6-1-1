import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Axe extends WeaponBase {
  id = 'axe';
  name = 'Axe';
  nameKo = '도끼';
  description = 'High damage, thrown in arc';
  descriptionKo = '높은 데미지, 곡선으로 던집니다';
  maxLevel = 8;
  evolutionPair = 'candelabrador';
  evolvedForm = 'death_spiral';

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 25,
      cooldown: 1200,
      area: 1,
      speed: 300,
      duration: 3000,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 10 },
      { amount: 1 },
      { damage: 10 },
      { area: 0.2 },
      { damage: 10 },
      { amount: 1 },
      { damage: 15 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const speed = this.getSpeed();
    const damage = this.getDamage();
    const area = this.getArea();

    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * 150, () => {
        this.throwAxe(speed, damage, area);
      });
    }
  }

  private throwAxe(speed: number, damage: number, area: number): void {
    const randomAngle = Math.random() * Math.PI * 2;
    const offsetX = Math.cos(randomAngle) * 30;

    const axe = this.scene.physics.add.sprite(
      this.player.x + offsetX,
      this.player.y,
      'projectile_axe'
    );

    axe.setScale(area);
    axe.setDepth(8);
    axe.setData('damage', damage);
    axe.setData('pierce', 999);

    // Initial upward velocity with slight horizontal
    const horizontalVelocity = (Math.random() - 0.5) * speed * 0.5;
    axe.setVelocity(horizontalVelocity, -speed);

    // Add gravity effect
    (axe.body as Phaser.Physics.Arcade.Body).setGravityY(400);

    // Rotation
    this.scene.tweens.add({
      targets: axe,
      rotation: Math.PI * 4,
      duration: 2000,
      repeat: -1,
    });

    // Add to projectiles
    this.scene.addProjectile(axe);

    // Destroy after going off screen
    this.scene.time.delayedCall(3000, () => {
      if (axe.active) {
        axe.destroy();
      }
    });
  }
}
