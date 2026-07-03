import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Peachone extends WeaponBase {
  id = 'peachone';
  name = 'Peachone';
  nameKo = '피치원';
  description = 'Orbiting bird companion';
  descriptionKo = '회전하는 새 동료';
  maxLevel = 8;

  private birds: Phaser.GameObjects.Arc[] = [];
  private orbitAngle: number = 0;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 10,
      cooldown: 100,
      area: 1,
      speed: 2,
      duration: 0,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { speed: 0.3 },
      { damage: 5 },
      { amount: 1 },
      { damage: 5 },
      { speed: 0.3 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();

    if (this.birds.length !== amount) {
      this.birds.forEach(b => b.destroy());
      this.birds = [];

      for (let i = 0; i < amount; i++) {
        const bird = this.scene.add.circle(0, 0, 12 * area, 0x87ceeb);
        bird.setDepth(8);
        (bird as any).damage = damage;
        (bird as any).pierce = 999;
        this.scene.physics.add.existing(bird);
        this.scene.addProjectile(bird as any);
        this.birds.push(bird);
      }
    }

    this.birds.forEach(b => (b as any).damage = damage);
  }

  update(delta: number): void {
    super.update(delta);

    const speed = this.getSpeed();
    const area = this.getArea();
    const radius = 120 * area;

    this.orbitAngle += (speed * delta) / 1000;

    this.birds.forEach((bird, i) => {
      if (!bird.active) return;
      const angle = this.orbitAngle + (Math.PI * 2 * i) / this.birds.length;
      bird.x = this.player.x + Math.cos(angle) * radius;
      bird.y = this.player.y + Math.sin(angle) * radius;
    });
  }
}
