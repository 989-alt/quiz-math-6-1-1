import Phaser from 'phaser';
import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

// weapon_pencil.png(52x52) 픽셀 분석 결과.
// 심(뾰족한 공격 끝)이 가리키는 방향은 rotation=0 기준 약 138.2° — 진행 방향에 심이 앞서도록 보정한다.
const PENCIL_ART_TIP_ANGLE = 2.4123152728935215; // radians

// 표창 크기로 작게 던진다 (원본 52px × 0.45 ≈ 23px)
const PENCIL_SCALE = 0.45;

export class Pencil extends WeaponBase {
  id = 'pencil';
  name = 'Pencil';
  nameKo = '연필';
  description = 'Throws pencils at the nearest monster';
  descriptionKo = '가장 가까운 몬스터를 향해 연필을 던지는 기본 무기';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 12,
      cooldown: 400,
      area: 1,
      speed: 500,
      duration: 900, // 발사체 수명(ms)
      amount: 1,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 3 },
      { speed: 50 },
      { amount: 1 },
      { damage: 5 },
      { pierce: 1 },
      { damage: 8 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * 120, () => {
        this.throwPencil();
      });
    }
  }

  private throwPencil(): void {
    if (!this.player.active) return;

    const target = this.findClosestEnemy();
    let angle: number;
    if (target) {
      angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
    } else {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      angle = body.velocity.lengthSq() > 0 ? body.velocity.angle() : 0;
    }

    const speed = this.getSpeed();
    const pencil = this.createProjectile(
      this.player.x,
      this.player.y,
      'weapon_pencil',
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      {
        scale: PENCIL_SCALE,
        rotation: angle - PENCIL_ART_TIP_ANGLE,
      }
    );

    // 명중 시 히트 이펙트 (관통해도 몬스터당 1회만)
    const hitSet = new Set<Phaser.Physics.Arcade.Sprite>();
    const overlap = this.scene.physics.add.overlap(pencil, this.scene.getMonsters(), (_p, monster) => {
      const m = monster as Phaser.Physics.Arcade.Sprite;
      if (hitSet.has(m)) return;
      hitSet.add(m);
      this.playImpact(m.x, m.y, 'hit_small');
    });
    pencil.once('destroy', () => overlap.destroy());
  }
}
