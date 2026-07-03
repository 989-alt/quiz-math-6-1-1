import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class MagicWand extends WeaponBase {
  id = 'magic_wand';
  name = 'Magic Wand';
  nameKo = '마법봉';
  description = 'Fires at the nearest enemy';
  descriptionKo = '가장 가까운 적을 공격합니다';
  maxLevel = 8;
  evolutionPair = 'empty_tome';
  evolvedForm = 'holy_wand';

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 10,
      cooldown: 700,
      area: 1,
      speed: 400,
      duration: 2000,
      amount: 1,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { amount: 1 },
      { damage: 5 },
      { pierce: 1 },
      { damage: 5 },
      { amount: 1 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const target = this.findClosestEnemy();
    if (!target) return;

    const amount = this.getAmount();
    const speed = this.getSpeed();

    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * 100, () => {
        const currentTarget = this.findClosestEnemy();
        if (!currentTarget) return;

        const angle = Phaser.Math.Angle.Between(
          this.player.x, this.player.y,
          currentTarget.x, currentTarget.y
        );

        this.createProjectile(
          this.player.x,
          this.player.y,
          'projectile_magic',
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          { scale: 0.8 }
        );
      });
    }
  }
}
