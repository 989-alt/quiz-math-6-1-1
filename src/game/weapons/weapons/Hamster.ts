import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Hamster extends WeaponBase {
  id = 'hamster';
  name = 'Hamster';
  nameKo = '햄스터';
  description = 'Spinning hamster friend';
  descriptionKo = '회전하는 햄스터 친구';
  maxLevel = 8;

  private hamsters: Phaser.GameObjects.Sprite[] = [];
  private orbitAngle: number = 0;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 18,
      cooldown: 100,
      area: 1,
      speed: 4,
      duration: 999999,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 4 },
      { amount: 1 },
      { speed: 1 },
      { damage: 5 },
      { amount: 1 },
      { damage: 6 },
      { amount: 1 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();

    // Create missing hamsters
    while (this.hamsters.length < amount) {
      // Use actual sprite
      const hamster = this.scene.add.sprite(
        this.player.x,
        this.player.y,
        'weapon_hamster'
      );
      hamster.setScale(0.06 * area);
      hamster.setDepth(9);

      this.scene.physics.add.existing(hamster);
      const body = hamster.body as Phaser.Physics.Arcade.Body;
      body.setSize(hamster.displayWidth * 0.8, hamster.displayHeight * 0.8);

      (hamster as any).damage = damage;
      (hamster as any).pierce = 999;

      this.scene.addProjectile(hamster as any);
      this.hamsters.push(hamster);
    }

    // Update positions
    const orbitRadius = 70 * area;
    this.orbitAngle += this.getSpeed() * 0.02;

    this.hamsters.forEach((hamster, i) => {
      if (!hamster.active) return;

      const angle = this.orbitAngle + (i / this.hamsters.length) * Math.PI * 2;
      hamster.x = this.player.x + Math.cos(angle) * orbitRadius;
      hamster.y = this.player.y + Math.sin(angle) * orbitRadius;

      // Update damage
      (hamster as any).damage = damage;

      // Rolling animation
      hamster.setRotation(this.orbitAngle * 3);

      // Update physics body position
      const body = hamster.body as Phaser.Physics.Arcade.Body;
      body.updateFromGameObject();
    });

    // Clean up
    this.hamsters = this.hamsters.filter(h => h.active);
  }
}
