import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Snowball extends WeaponBase {
  id = 'snowball';
  name = 'Snowball';
  nameKo = '눈덩이';
  description = 'Slows enemies';
  descriptionKo = '적을 느리게 만드는 눈덩이';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 10,
      cooldown: 800,
      area: 1,
      speed: 350,
      duration: 2000,
      amount: 2,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 3 },
      { area: 0.1 },
      { amount: 1 },
      { damage: 4 },
      { amount: 1 },
      { damage: 6 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.createSnowball(angle);
    }
  }

  private createSnowball(angle: number): void {
    const speed = this.getSpeed();
    const damage = this.getDamage();
    const area = this.getArea();

    // Use actual sprite
    const snowball = this.scene.add.sprite(
      this.player.x,
      this.player.y,
      'weapon_snowball'
    );
    snowball.setScale(0.05 * area);
    snowball.setDepth(9);

    this.scene.physics.add.existing(snowball);
    const body = snowball.body as Phaser.Physics.Arcade.Body;
    body.setSize(snowball.displayWidth * 0.8, snowball.displayHeight * 0.8);
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    (snowball as any).damage = damage;
    (snowball as any).pierce = 1;

    this.scene.addProjectile(snowball as any);

    // Auto destroy after duration
    this.scene.time.delayedCall(this.getDuration(), () => {
      if (snowball.active) snowball.destroy();
    });
  }
}
