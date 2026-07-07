import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';
import type { Monster } from '../../entities/Monster';

export class Magnet extends WeaponBase {
  id = 'magnet';
  name = 'Magnet';
  nameKo = '자석';
  description = 'Pulls and damages enemies';
  descriptionKo = '적을 끌어당겨 공격';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 8,
      cooldown: 2000,
      area: 1,
      speed: 100,
      duration: 1500,
      amount: 1,
      pierce: 999,
      knockback: -50, // Negative = pull
    };
    this.levelUpgrades = [
      { damage: 2 },
      { area: 0.15 },
      { damage: 2 },
      { duration: 200 },
      { damage: 3 },
      { area: 0.15 },
      { damage: 4 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      const angle = (i / amount) * Math.PI * 2;
      const distance = 80 + i * 30;
      this.createMagnetField(angle, distance);
    }
  }

  private createMagnetField(angle: number, distance: number): void {
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    const x = this.player.x + Math.cos(angle) * distance;
    const y = this.player.y + Math.sin(angle) * distance;

    // 자석 본체 (weapon_magnet 픽셀아트, 기존 도형 폭 28*area → native 40px 기준 스케일 환산)
    const magnet = this.scene.add.sprite(x, y, 'weapon_magnet');
    magnet.setScale(0.75 * area);
    magnet.setDepth(9);

    // Magnetic field visualization
    const fieldRadius = 60 * area;
    const field = this.scene.add.circle(x, y, fieldRadius, 0x9370db, 0.2);
    field.setDepth(8);

    this.scene.physics.add.existing(field);
    (field as any).damage = damage;
    (field as any).pierce = 999;

    this.scene.addProjectile(field as any);
    this.attachImpactEffect(field as any, 'hit_small');

    // Field particles flowing inward toward the center
    const flowTimer = this.scene.time.addEvent({
      delay: 120,
      callback: () => {
        const spawnAngle = Math.random() * Math.PI * 2;
        const particle = this.scene.add.circle(
          x + Math.cos(spawnAngle) * fieldRadius,
          y + Math.sin(spawnAngle) * fieldRadius,
          3 * area,
          0x9370db,
          0.8
        );
        particle.setDepth(8);
        this.scene.tweens.add({
          targets: particle,
          x,
          y,
          alpha: 0,
          scale: 0.3,
          duration: 450,
          onComplete: () => particle.destroy(),
        });
      },
      loop: true,
    });

    // Pull effect + x-stretch on nearby enemies.
    // 복원 기준은 Monster.baseScale(스폰 목표 스케일) — 런타임 scaleX를 캡처하면
    // 필드 중첩·스폰 팝 트윈과 레이스로 몬스터 스케일이 영구 오염된다.
    const stretched = new Set<Phaser.Physics.Arcade.Sprite>();
    const baseScaleOf = (m: Phaser.Physics.Arcade.Sprite) =>
      (m as Monster).baseScale ?? m.scaleX;
    const pullInterval = this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        // 퀴즈/레벨업으로 게임이 일시정지된 동안엔 몬스터를 끌어당기지 않음
        if ((this.scene as any).isGamePaused?.()) return;
        const monsters = this.scene.getMonsters();
        monsters.getChildren().forEach((monster) => {
          const m = monster as Phaser.Physics.Arcade.Sprite;
          if (!m.active) {
            stretched.delete(m);
            return;
          }

          const dist = Phaser.Math.Distance.Between(x, y, m.x, m.y);
          if (dist < fieldRadius && dist > 10) {
            const pullAngle = Phaser.Math.Angle.Between(m.x, m.y, x, y);
            const pullForce = 30 * area;
            m.x += Math.cos(pullAngle) * pullForce * 0.1;
            m.y += Math.sin(pullAngle) * pullForce * 0.1;

            m.setScale(baseScaleOf(m) * 1.15, m.scaleY);
            stretched.add(m);
          } else if (stretched.has(m)) {
            m.setScale(baseScaleOf(m), m.scaleY);
            stretched.delete(m);
          }
        });
      },
      loop: true,
    });

    // Pulsing animation
    this.scene.tweens.add({
      targets: field,
      scale: { from: 0.8, to: 1.2 },
      alpha: { from: 0.3, to: 0.1 },
      duration: 500,
      yoyo: true,
      repeat: Math.floor(duration / 1000),
    });

    this.scene.time.delayedCall(duration, () => {
      pullInterval.destroy();
      flowTimer.destroy();
      stretched.forEach((m) => {
        if (m.active) m.setScale(baseScaleOf(m), m.scaleY);
      });
      magnet.destroy();
      field.destroy();
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
