import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Knife extends WeaponBase {
  id = 'knife';
  name = 'Knife';
  nameKo = '칼';
  description = 'Fires quickly in faced direction';
  descriptionKo = '바라보는 방향으로 빠르게 발사합니다';
  maxLevel = 8;
  evolutionPair = 'bracer';
  evolvedForm = 'thousand_edge';

  private lastDirection: number = 1;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 8,
      cooldown: 350,
      area: 1,
      speed: 500,
      duration: 1500,
      amount: 1,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 3 },
      { amount: 1 },
      { damage: 3 },
      { pierce: 1 },
      { amount: 1 },
      { damage: 5 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const speed = this.getSpeed();

    // Track player direction
    if (this.player.body) {
      if ((this.player.body as Phaser.Physics.Arcade.Body).velocity.x > 10) {
        this.lastDirection = 1;
      } else if ((this.player.body as Phaser.Physics.Arcade.Body).velocity.x < -10) {
        this.lastDirection = -1;
      }
    }

    for (let i = 0; i < amount; i++) {
      const spreadAngle = (i - (amount - 1) / 2) * 0.15;
      const angle = this.lastDirection > 0 ? spreadAngle : Math.PI + spreadAngle;

      this.createProjectile(
        this.player.x,
        this.player.y,
        'projectile_knife',
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        { scale: 0.8 }
      );
    }
  }
}
