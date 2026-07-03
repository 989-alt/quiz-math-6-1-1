import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class FireWand extends WeaponBase {
  id = 'fire_wand';
  name = 'Fire Wand';
  nameKo = '불 지팡이';
  description = 'Random explosions on enemies';
  descriptionKo = '적에게 무작위 폭발을 일으킵니다';
  maxLevel = 8;
  evolutionPair = 'spinach';
  evolvedForm = 'hellfire';

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 20,
      cooldown: 1500,
      area: 1,
      speed: 0,
      duration: 300,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 10 },
      { area: 0.2 },
      { damage: 10 },
      { amount: 1 },
      { damage: 10 },
      { area: 0.2 },
      { damage: 15 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();

    for (let i = 0; i < amount; i++) {
      const target = this.findRandomEnemyInRange(400);
      if (target) {
        this.createExplosion(target.x, target.y, damage, area);
      } else {
        // Random location if no enemies
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 200 + 50;
        this.createExplosion(
          this.player.x + Math.cos(angle) * dist,
          this.player.y + Math.sin(angle) * dist,
          damage,
          area
        );
      }
    }
  }

  private createExplosion(x: number, y: number, damage: number, area: number): void {
    const explosion = this.scene.add.circle(x, y, 32 * area, 0xff4500, 0.8);
    explosion.setDepth(7);

    this.scene.physics.add.existing(explosion);
    (explosion as any).damage = damage;
    (explosion as any).pierce = 999;

    this.scene.addProjectile(explosion as any);

    // Explosion animation
    this.scene.tweens.add({
      targets: explosion,
      scale: { from: 0.5, to: 1.5 },
      alpha: { from: 0.8, to: 0 },
      duration: 300,
      onComplete: () => {
        explosion.destroy();
      },
    });
  }
}
