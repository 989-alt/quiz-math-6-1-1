import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class KingBible extends WeaponBase {
  id = 'king_bible';
  name = 'King Bible';
  nameKo = '성경';
  description = 'Orbits around you';
  descriptionKo = '주위를 회전합니다';
  maxLevel = 8;
  evolutionPair = 'spellbinder';
  evolvedForm = 'unholy_vespers';

  private orbitals: Phaser.GameObjects.Rectangle[] = [];
  private orbitAngle: number = 0;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 15,
      cooldown: 100, // Tick rate for rotation
      area: 1,
      speed: 3, // Rotation speed
      duration: 3000,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { speed: 0.5 },
      { amount: 1 },
      { damage: 5 },
      { area: 0.1 },
      { amount: 1 },
      { damage: 5 },
      { duration: 500 },
    ];
  }

  attack(): void {
    // Create/update orbitals
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();

    // Destroy old orbitals if count changed
    if (this.orbitals.length !== amount) {
      this.orbitals.forEach((o) => o.destroy());
      this.orbitals = [];

      for (let i = 0; i < amount; i++) {
        const orbital = this.scene.add.rectangle(0, 0, 24 * area, 32 * area, 0xffd700);
        orbital.setDepth(8);
        (orbital as any).damage = damage;
        (orbital as any).pierce = 999;
        this.scene.physics.add.existing(orbital);
        this.scene.addProjectile(orbital as any);
        this.orbitals.push(orbital);
      }
    }

    // Update damage on existing orbitals
    this.orbitals.forEach((o) => {
      (o as any).damage = damage;
    });
  }

  update(delta: number): void {
    super.update(delta);

    // Update orbital positions
    const speed = this.getSpeed();
    const area = this.getArea();
    const radius = 80 * area;

    this.orbitAngle += (speed * delta) / 1000;

    this.orbitals.forEach((orbital, i) => {
      if (!orbital.active) return;

      const angle = this.orbitAngle + (Math.PI * 2 * i) / this.orbitals.length;
      orbital.x = this.player.x + Math.cos(angle) * radius;
      orbital.y = this.player.y + Math.sin(angle) * radius;
      orbital.rotation = angle + Math.PI / 2;
    });
  }
}
