import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Acorn extends WeaponBase {
  id = 'acorn';
  name = 'Acorn';
  nameKo = '도토리';
  description = 'Bouncing acorns';
  descriptionKo = '튕기는 도토리';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 15,
      cooldown: 900,
      area: 1,
      speed: 350,
      duration: 3000,
      amount: 2,
      pierce: 3,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 5 },
      { pierce: 1 },
      { amount: 1 },
      { damage: 5 },
      { pierce: 2 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();

    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.createAcorn(angle);
    }
  }

  private createAcorn(angle: number): void {
    const speed = this.getSpeed();
    const area = this.getArea();
    const damage = this.getDamage();
    const pierce = this.getPierce();

    // Use actual sprite
    const acorn = this.scene.add.sprite(
      this.player.x,
      this.player.y,
      'weapon_acorn'
    );
    acorn.setScale(0.05 * area);
    acorn.setDepth(9);

    this.scene.physics.add.existing(acorn);
    const body = acorn.body as Phaser.Physics.Arcade.Body;
    body.setSize(acorn.displayWidth * 0.8, acorn.displayHeight * 0.8);
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    body.setBounce(1, 1);

    (acorn as any).damage = damage;
    (acorn as any).pierce = pierce;

    this.scene.addProjectile(acorn as any);

    // Rotation animation
    this.scene.tweens.add({
      targets: acorn,
      rotation: Math.PI * 4,
      duration: 1000,
      repeat: -1,
    });

    // Bounce off screen edges
    const checkBounds = () => {
      if (!acorn.active) return;
      const cam = this.scene.cameras.main;
      const bounds = {
        left: cam.scrollX,
        right: cam.scrollX + cam.width,
        top: cam.scrollY,
        bottom: cam.scrollY + cam.height,
      };

      if (acorn.x <= bounds.left || acorn.x >= bounds.right) {
        body.setVelocityX(-body.velocity.x);
      }
      if (acorn.y <= bounds.top || acorn.y >= bounds.bottom) {
        body.setVelocityY(-body.velocity.y);
      }
    };

    const bounceTimer = this.scene.time.addEvent({
      delay: 50,
      callback: checkBounds,
      loop: true,
    });

    this.scene.time.delayedCall(this.getDuration(), () => {
      bounceTimer.destroy();
      if (acorn.active) acorn.destroy();
    });
  }
}
