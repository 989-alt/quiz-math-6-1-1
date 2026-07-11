import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';
import type { Monster } from '../../entities/Monster';

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
      { area: 0.15 },
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
      {
        scale: 1.2,
        lifespan,
        // 전역 충돌 핸들러(pierce 1 → 즉시 destroy)가 자체 overlap보다 먼저 처리돼
        // 슬로우가 발동하지 못하던 문제 회피 — onHit으로 이전(몬스터당 1회는 전역 __hitMonsters가 보장)
        onHit: (_snowball, monster) => {
          const m = monster as any;
          this.playImpact(m.x, m.y, 'splash');

          // 공용 슬로우 API로 감속 — 만료 자동 복원, 중첩 레이스 없음
          (m as Monster).applySlow(0.45, 2500);

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
        },
      }
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
  }
}
