import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Leaf extends WeaponBase {
  id = 'leaf';
  name = 'Leaf';
  nameKo = '나뭇잎';
  description = 'Drifting leaf projectile';
  descriptionKo = '바람에 흔들리는 나뭇잎';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 8,
      cooldown: 600,
      area: 1,
      speed: 200,
      duration: 3000,
      amount: 3,
      pierce: 2,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 2 },
      { amount: 1 },
      { pierce: 1 },
      { damage: 3 },
      { amount: 2 },
      { damage: 5 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * 100, () => {
        this.createLeaf();
      });
    }
  }

  private createLeaf(): void {
    const speed = this.getSpeed();
    const damage = this.getDamage();
    const pierce = this.getPierce();
    const area = this.getArea();

    const angle = Math.random() * Math.PI * 2;

    const leaf = this.scene.add.ellipse(
      this.player.x,
      this.player.y,
      16 * area,
      8 * area,
      0x228b22 // Forest green
    );
    leaf.setDepth(9);

    this.scene.physics.add.existing(leaf);
    const body = leaf.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    (leaf as any).damage = damage;
    (leaf as any).pierce = pierce;

    this.scene.addProjectile(leaf as any);

    // Drifting/floating motion
    this.scene.tweens.add({
      targets: leaf,
      rotation: Math.PI * 4,
      duration: this.getDuration(),
    });

    // Wave motion
    const startY = leaf.y;
    const waveTimer = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (!leaf.active) return;
        const wave = Math.sin(Date.now() / 200) * 20;
        body.setVelocityY(body.velocity.y + wave * 0.1);
      },
      loop: true,
    });

    this.scene.time.delayedCall(this.getDuration(), () => {
      waveTimer.destroy();
      if (leaf.active) {
        this.scene.tweens.add({
          targets: leaf,
          alpha: 0,
          duration: 200,
          onComplete: () => leaf.destroy(),
        });
      }
    });
  }
}
