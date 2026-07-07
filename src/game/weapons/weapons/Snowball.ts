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
    const area = this.getArea();
    const lifespan = this.getDuration();

    const snowball = this.createProjectile(
      this.player.x,
      this.player.y,
      'weapon_snowball',
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      { scale: 1.2, lifespan }
    );

    const body = snowball.body as Phaser.Physics.Arcade.Body;
    body.setSize(snowball.width * 0.8, snowball.height * 0.8);

    // Grows in flight
    this.scene.tweens.add({
      targets: snowball,
      scale: 1.2 * area * 1.3,
      duration: lifespan,
      delay: 80,
    });

    // Slow debuff on hit (설명대로 실제 이동속도 저하 적용, 1.5초간 50%)
    const hitMonsters = new Set<Phaser.Physics.Arcade.Sprite>();
    const overlap = this.scene.physics.add.overlap(
      snowball,
      this.scene.getMonsters(),
      (_snowball, monster) => {
        const m = monster as any;
        if (!m.active || hitMonsters.has(m)) return;
        hitMonsters.add(m);

        this.playImpact(m.x, m.y, 'splash');

        if (!m.__snowSlowed) {
          m.__snowSlowed = true;
          const originalSpeed = m.speed;
          m.speed = originalSpeed * 0.5;
          this.scene.time.delayedCall(1500, () => {
            if (m.active) m.speed = originalSpeed;
            m.__snowSlowed = false;
          });
        }

        const flake = this.scene.add.sprite(m.x, m.y - 10, 'weapon_snowball');
        flake.setScale(0.5);
        flake.setDepth(11);
        this.scene.tweens.add({
          targets: flake,
          alpha: 0,
          y: flake.y - 15,
          duration: 1000,
          onComplete: () => flake.destroy(),
        });
      }
    );
    this.scene.time.delayedCall(lifespan, () => overlap.destroy());
  }
}
