import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Song extends WeaponBase {
  id = 'song';
  name = 'Song of Mana';
  nameKo = '마나의 노래';
  description = 'Creates damaging waves';
  descriptionKo = '데미지를 주는 파동을 생성합니다';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 12,
      cooldown: 1500,
      area: 1,
      speed: 200,
      duration: 1000,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 5 },
      { amount: 1 },
      { damage: 5 },
      { area: 0.2 },
      { amount: 1 },
      { damage: 5 },
      { damage: 10 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * 200, () => {
        this.createWave(damage, area, duration, i % 2 === 0);
      });
    }
  }

  private createWave(damage: number, area: number, duration: number, vertical: boolean): void {
    const waveWidth = 300 * area;
    const waveHeight = 30 * area;

    const wave = this.scene.add.rectangle(
      this.player.x,
      this.player.y,
      vertical ? waveHeight : waveWidth,
      vertical ? waveWidth : waveHeight,
      0x9932cc,
      0.6
    );
    wave.setDepth(7);

    this.scene.physics.add.existing(wave);
    (wave as any).damage = damage;
    (wave as any).pierce = 999;

    this.scene.addProjectile(wave as any);

    this.scene.tweens.add({
      targets: wave,
      scaleX: vertical ? 1 : 2,
      scaleY: vertical ? 2 : 1,
      alpha: 0,
      duration: duration,
      onComplete: () => wave.destroy(),
    });
  }
}
