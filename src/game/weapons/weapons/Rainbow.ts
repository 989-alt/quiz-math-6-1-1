import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Rainbow extends WeaponBase {
  id = 'rainbow';
  name = 'Rainbow';
  nameKo = '무지개';
  description = 'Rainbow wave attack';
  descriptionKo = '무지개 파동 공격';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 20,
      cooldown: 2500,
      area: 1,
      speed: 0,
      duration: 800,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { area: 0.15 },
      { damage: 5 },
      { duration: 100 },
      { damage: 8 },
      { area: 0.15 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      const angle = (i / amount) * Math.PI * 2;
      this.createRainbowWave(angle);
    }
  }

  private createRainbowWave(baseAngle: number): void {
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    // 반원 파동 스프라이트 1장이 진행 방향으로 확장하며 알파 감쇠 (설계 §3.3).
    // 조각 스프라이트 56개를 부채꼴로 도배하던 이전 방식은 파동으로 읽히지 않아 폐기.
    // 무지개 아트 자체가 풀컬러라 tint cycle은 곱연산으로 색을 죽여서 적용하지 않는다.
    const startR = 30 * area;
    const endR = 140 * area;
    const wave = this.createProjectile(
      this.player.x + Math.cos(baseAngle) * startR,
      this.player.y + Math.sin(baseAngle) * startR,
      'weapon_rainbow',
      0,
      0,
      {
        scale: 1.0 * area,
        rotation: baseAngle + Math.PI / 2, // 아트가 위를 향한 아치라 진행 방향으로 회전
        lifespan: duration + 200,
      }
    );
    wave.setAlpha(0.9);
    (wave as any).damage = damage;
    this.attachImpactEffect(wave, 'collect');

    // 확장 + 알파 감쇠. scale은 createProjectile의 스폰 팝(0~80ms)이 끝난 뒤 시작
    this.scene.tweens.add({
      targets: wave,
      x: this.player.x + Math.cos(baseAngle) * endR,
      y: this.player.y + Math.sin(baseAngle) * endR,
      scale: 2.2 * area,
      alpha: 0,
      duration: duration,
      delay: 80,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (wave.active) wave.destroy();
      },
    });
  }

  private attachImpactEffect(sprite: Phaser.Physics.Arcade.Sprite, kind: string): void {
    const hit = new Set<Phaser.Physics.Arcade.Sprite>();
    const overlap = this.scene.physics.add.overlap(sprite, this.scene.getMonsters(), (_s, monster) => {
      const m = monster as Phaser.Physics.Arcade.Sprite;
      if (hit.has(m)) return;
      hit.add(m);
      this.playImpact(m.x, m.y, kind);
    });
    sprite.once('destroy', () => overlap.destroy());
  }
}
