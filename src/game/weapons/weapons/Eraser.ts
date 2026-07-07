import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Eraser extends WeaponBase {
  id = 'eraser';
  name = 'Eraser';
  nameKo = '지우개';
  description = 'Erases enemies in area';
  descriptionKo = '범위 내 적을 지우는 지우개';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 30,
      cooldown: 2500,
      area: 1,
      speed: 0,
      duration: 500,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { area: 0.15 },
      { damage: 8 },
      { cooldown: -200 },
      { area: 0.15 },
      { damage: 10 },
      { area: 0.2 },
      { damage: 15 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    for (let i = 0; i < amount; i++) {
      const angle = (i / amount) * Math.PI * 2;
      const distance = 60 + i * 30;
      this.createEraserZone(angle, distance, damage, area, duration);
    }
  }

  private createEraserZone(angle: number, distance: number, damage: number, area: number, duration: number): void {
    const x = this.player.x + Math.cos(angle) * distance;
    const y = this.player.y + Math.sin(angle) * distance;
    const dropHeight = 200;

    // Use actual sprite, dropped in from above
    const eraser = this.scene.add.sprite(x, y - dropHeight, 'weapon_eraser');
    eraser.setScale(1.3 * area);
    eraser.setDepth(9);

    this.scene.physics.add.existing(eraser);
    const body = eraser.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.enable = false;
    body.setSize(eraser.width * 1.35, eraser.height * 1.35); // 타격 판정 +50% (0.9 → 1.35, 너무 국소적이라는 피드백 반영)

    (eraser as any).damage = damage;
    (eraser as any).pierce = 999;

    this.scene.tweens.add({
      targets: eraser,
      y,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!eraser.active) return;
        body.enable = true;
        this.scene.addProjectile(eraser as any);
        this.playImpact(x, y, 'poof');
        this.spawnEraserDecal(x, y, area);
        this.spawnEraserDust(x, y, area);

        // Scale punch on landing
        eraser.setScale(1.6 * area);
        this.scene.tweens.add({
          targets: eraser,
          scale: 1.3 * area,
          duration: 140,
          ease: 'Back.easeOut',
        });

        this.scene.time.delayedCall(duration, () => {
          if (!eraser.active) return;
          this.scene.tweens.add({
            targets: eraser,
            alpha: 0,
            duration: 150,
            onComplete: () => eraser.destroy(),
          });
        });
      },
    });
  }

  private spawnEraserDecal(x: number, y: number, area: number): void {
    const decal = this.scene.add.ellipse(x, y, 60 * area, 24 * area, 0xffffff, 0.5);
    decal.setDepth(7);
    this.scene.tweens.add({
      targets: decal,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 600,
      onComplete: () => decal.destroy(),
    });
  }

  private spawnEraserDust(x: number, y: number, area: number): void {
    const dustCount = 8;
    for (let i = 0; i < dustCount; i++) {
      const dustAngle = (i / dustCount) * Math.PI * 2 + Math.random() * 0.3;
      const dustSpeed = 40 + Math.random() * 30;
      const particle = this.scene.add.circle(x, y, (2 + Math.random() * 2) * area, 0xe8e8e8, 0.9);
      particle.setDepth(10);
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(dustAngle) * dustSpeed,
        y: y + Math.sin(dustAngle) * dustSpeed - 10,
        alpha: 0,
        duration: 400,
        ease: 'Sine.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }
}
