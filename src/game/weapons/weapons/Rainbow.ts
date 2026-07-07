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

  private colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x8b00ff];

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

    // Create rainbow arc
    this.colors.forEach((color, i) => {
      const arcRadius = (50 + i * 10) * area;
      const startAngle = baseAngle - Math.PI / 4;
      const endAngle = baseAngle + Math.PI / 4;

      this.scene.time.delayedCall(i * 30, () => {
        // Create arc as multiple small segments
        const segments = 8;
        for (let s = 0; s < segments; s++) {
          const segAngle = startAngle + (s / segments) * (endAngle - startAngle);
          const x = this.player.x + Math.cos(segAngle) * arcRadius;
          const y = this.player.y + Math.sin(segAngle) * arcRadius;

          const segment = this.createProjectile(x, y, 'weapon_rainbow', 0, 0, {
            scale: 0.35,
            rotation: segAngle,
            lifespan: duration,
          });
          segment.setTint(color);
          segment.setAlpha(0.85);
          (segment as any).damage = damage / 3;
          this.attachImpactEffect(segment, 'collect');

          // Color shift (tint cycle) while the wave travels outward
          let colorIdx = i;
          const tintTimer = this.scene.time.addEvent({
            delay: Math.max(60, duration / this.colors.length),
            callback: () => {
              colorIdx = (colorIdx + 1) % this.colors.length;
              if (segment.active) segment.setTint(this.colors[colorIdx]);
            },
            repeat: this.colors.length - 1,
          });

          // Expand outward + fade (alpha decay). scale는 createProjectile의 스폰 팝(0~80ms)과
          // 겹치지 않도록 팝이 끝난 뒤 시작 (Snowball의 grow 트윈과 동일한 패턴)
          this.scene.tweens.add({
            targets: segment,
            x: this.player.x + Math.cos(segAngle) * (arcRadius + 100 * area),
            y: this.player.y + Math.sin(segAngle) * (arcRadius + 100 * area),
            alpha: 0,
            scale: 0.15 * area,
            duration: duration,
            delay: 80,
            onComplete: () => {
              tintTimer.destroy();
              if (segment.active) segment.destroy();
            },
          });
        }
      });
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
