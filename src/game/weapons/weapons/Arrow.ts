import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Arrow extends WeaponBase {
  id = 'arrow';
  name = 'Arrow';
  nameKo = '화살';
  description = 'Rapid fire arrows';
  descriptionKo = '빠르게 화살을 발사합니다';
  maxLevel = 8;

  private lastDirection: number = 1;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 10,
      cooldown: 400,
      area: 1,
      speed: 600,
      duration: 2000,
      amount: 1,
      pierce: 2,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 5 },
      { pierce: 1 },
      { amount: 1 },
      { damage: 5 },
      { amount: 1 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const speed = this.getSpeed();

    if (this.player.body) {
      const vel = (this.player.body as Phaser.Physics.Arcade.Body).velocity;
      if (vel.x > 10) this.lastDirection = 0;
      else if (vel.x < -10) this.lastDirection = Math.PI;
      else if (vel.y > 10) this.lastDirection = Math.PI / 2;
      else if (vel.y < -10) this.lastDirection = -Math.PI / 2;
    }

    for (let i = 0; i < amount; i++) {
      const spread = (i - (amount - 1) / 2) * 0.1;
      const angle = this.lastDirection + spread;

      this.createProjectile(
        this.player.x,
        this.player.y,
        'projectile_arrow',
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        { scale: 0.8 }
      );
    }
  }
}
