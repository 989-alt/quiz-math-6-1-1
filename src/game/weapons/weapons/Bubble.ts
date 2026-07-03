import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Bubble extends WeaponBase {
  id = 'bubble';
  name = 'Bubble';
  nameKo = '비눗방울';
  description = 'Orbiting bubbles';
  descriptionKo = '주위를 도는 비눗방울';
  maxLevel = 8;

  private bubbles: Phaser.GameObjects.Sprite[] = [];
  private orbitAngle: number = 0;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 12,
      cooldown: 100, // Continuous damage check
      area: 1,
      speed: 3, // Orbit speed
      duration: 999999,
      amount: 3,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 3 },
      { area: 0.1 },
      { amount: 1 },
      { damage: 4 },
      { amount: 1 },
      { damage: 5 },
    ];
  }

  attack(): void {
    // Create/update orbiting bubbles
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();

    // Create missing bubbles
    while (this.bubbles.length < amount) {
      // Use actual sprite
      const bubble = this.scene.add.sprite(
        this.player.x,
        this.player.y,
        'weapon_bubble'
      );
      bubble.setScale(0.06 * area);
      bubble.setDepth(9);
      bubble.setAlpha(0.8);

      this.scene.physics.add.existing(bubble);
      const body = bubble.body as Phaser.Physics.Arcade.Body;
      body.setSize(bubble.displayWidth * 0.8, bubble.displayHeight * 0.8);

      (bubble as any).damage = damage;
      (bubble as any).pierce = 999;

      this.scene.addProjectile(bubble as any);
      this.bubbles.push(bubble);
    }

    // Update bubble positions
    const orbitRadius = 60 * area;
    this.orbitAngle += this.getSpeed() * 0.02;

    this.bubbles.forEach((bubble, i) => {
      if (!bubble.active) return;

      const angle = this.orbitAngle + (i / this.bubbles.length) * Math.PI * 2;
      bubble.x = this.player.x + Math.cos(angle) * orbitRadius;
      bubble.y = this.player.y + Math.sin(angle) * orbitRadius;

      // Update damage
      (bubble as any).damage = damage;

      // Floating effect
      bubble.setScale((0.06 * area) * (1 + Math.sin(Date.now() / 300 + i) * 0.1));

      // Update physics body position
      const body = bubble.body as Phaser.Physics.Arcade.Body;
      body.updateFromGameObject();
    });

    // Clean up destroyed bubbles
    this.bubbles = this.bubbles.filter(b => b.active);
  }
}
