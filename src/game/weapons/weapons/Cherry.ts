import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Cherry extends WeaponBase {
  id = 'cherry';
  name = 'Cherry Bomb';
  nameKo = '체리 폭탄';
  description = 'Explosive AOE damage';
  descriptionKo = '폭발 범위 데미지';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 30,
      cooldown: 2500,
      area: 1,
      speed: 200,
      duration: 500,
      amount: 1,
      pierce: 999,
      knockback: 10,
    };
    this.levelUpgrades = [
      { damage: 10 },
      { area: 0.2 },
      { damage: 10 },
      { amount: 1 },
      { damage: 10 },
      { area: 0.2 },
      { damage: 20 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const speed = this.getSpeed();
    const damage = this.getDamage();
    const area = this.getArea();

    for (let i = 0; i < amount; i++) {
      const target = this.findClosestEnemy();
      if (target) {
        this.throwBomb(target.x, target.y, speed, damage, area);
      } else {
        const angle = Math.random() * Math.PI * 2;
        const dist = 100 + Math.random() * 100;
        this.throwBomb(
          this.player.x + Math.cos(angle) * dist,
          this.player.y + Math.sin(angle) * dist,
          speed,
          damage,
          area
        );
      }
    }
  }

  private throwBomb(targetX: number, targetY: number, speed: number, damage: number, area: number): void {
    const bomb = this.scene.add.circle(this.player.x, this.player.y, 10 * area, 0xff0000);
    bomb.setDepth(8);

    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, targetX, targetY);
    const duration = (dist / speed) * 1000;

    // Arc trajectory
    this.scene.tweens.add({
      targets: bomb,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.explode(bomb.x, bomb.y, damage, area);
        bomb.destroy();
      },
    });

    // Bounce effect
    this.scene.tweens.add({
      targets: bomb,
      y: bomb.y - 50,
      duration: duration / 2,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  private explode(x: number, y: number, damage: number, area: number): void {
    const explosion = this.scene.add.circle(x, y, 60 * area, 0xff4500, 0.7);
    explosion.setDepth(9);

    this.scene.physics.add.existing(explosion);
    (explosion as any).damage = damage;
    (explosion as any).pierce = 999;

    this.scene.addProjectile(explosion as any);

    this.scene.tweens.add({
      targets: explosion,
      scale: { from: 0.5, to: 1.5 },
      alpha: { from: 0.7, to: 0 },
      duration: 300,
      onComplete: () => explosion.destroy(),
    });

    // Screen shake
    this.scene.cameras.main.shake(100, 0.01);
  }
}
