import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Garlic extends WeaponBase {
  id = 'garlic';
  name = 'Garlic';
  nameKo = '마늘';
  description = 'Damages nearby enemies';
  descriptionKo = '근처의 적에게 데미지를 줍니다';
  maxLevel = 8;
  evolutionPair = 'pummarola';
  evolvedForm = 'soul_eater';

  private auraGraphic: Phaser.GameObjects.Arc | null = null;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 5,
      cooldown: 500,
      area: 1,
      speed: 0,
      duration: 200,
      amount: 1,
      pierce: 999,
      knockback: 5,
    };
    this.levelUpgrades = [
      { damage: 2 },
      { area: 0.2 },
      { damage: 2 },
      { knockback: 3 },
      { damage: 3 },
      { area: 0.2 },
      { damage: 5 },
    ];
  }

  attack(): void {
    const damage = this.getDamage();
    const area = this.getArea();
    const radius = 64 * area;

    // Create pulse effect
    if (this.auraGraphic) {
      this.auraGraphic.destroy();
    }

    this.auraGraphic = this.scene.add.circle(
      this.player.x,
      this.player.y,
      radius,
      0x90ee90,
      0.3
    );
    this.auraGraphic.setDepth(3);

    // Add physics for collision
    this.scene.physics.add.existing(this.auraGraphic);
    (this.auraGraphic as any).damage = damage;
    (this.auraGraphic as any).pierce = 999;

    this.scene.addProjectile(this.auraGraphic as any);

    // Pulse animation
    this.scene.tweens.add({
      targets: this.auraGraphic,
      scale: { from: 0.8, to: 1.2 },
      alpha: { from: 0.4, to: 0 },
      duration: 200,
      onComplete: () => {
        if (this.auraGraphic) {
          this.auraGraphic.destroy();
          this.auraGraphic = null;
        }
      },
    });
  }

  update(delta: number): void {
    super.update(delta);

    // Keep aura centered on player
    if (this.auraGraphic && this.auraGraphic.active) {
      this.auraGraphic.x = this.player.x;
      this.auraGraphic.y = this.player.y;
    }
  }
}
