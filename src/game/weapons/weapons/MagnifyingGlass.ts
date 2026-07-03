import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class MagnifyingGlass extends WeaponBase {
  id = 'magnifying_glass';
  name = 'Magnifying Glass';
  nameKo = '돋보기';
  description = 'Focus sunlight to burn enemies';
  descriptionKo = '햇빛을 모아 적을 태우는 공격';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 35,
      cooldown: 2200,
      area: 1,
      speed: 0,
      duration: 1000,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 8 },
      { area: 0.2 },
      { damage: 10 },
      { amount: 1 },
      { damage: 12 },
      { area: 0.2 },
      { damage: 15 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      this.scene.time.delayedCall(i * 200, () => {
        this.createLightBeam();
      });
    }
  }

  private createLightBeam(): void {
    const target = this.findRandomEnemyInRange(350);
    if (!target) return;

    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    // Create magnifying glass above target
    const glassX = target.x;
    const glassY = target.y - 80;

    // Glass lens (circle)
    const lens = this.scene.add.circle(glassX, glassY, 20 * area, 0x87ceeb, 0.4);
    lens.setStrokeStyle(3, 0x8b4513);
    lens.setDepth(11);

    // Glass handle
    const handle = this.scene.add.rectangle(
      glassX + 15 * area,
      glassY + 25 * area,
      8 * area,
      30 * area,
      0x8b4513
    );
    handle.setRotation(-Math.PI / 4);
    handle.setDepth(11);

    // Light beam from lens to ground
    const beamGraphics = this.scene.add.graphics();
    beamGraphics.setDepth(10);

    // Animate light beam concentration
    let beamProgress = 0;
    const beamInterval = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        beamProgress += 0.1;
        beamGraphics.clear();

        // Draw converging light rays
        const alpha = Math.min(beamProgress * 0.3, 0.6);
        beamGraphics.lineStyle(2, 0xffff00, alpha);

        for (let i = 0; i < 5; i++) {
          const offsetX = (i - 2) * 8 * area;
          beamGraphics.lineBetween(
            glassX + offsetX,
            glassY + 15 * area,
            target.x,
            target.y
          );
        }

        // Central bright beam
        beamGraphics.lineStyle(4, 0xffa500, alpha);
        beamGraphics.lineBetween(glassX, glassY + 15 * area, target.x, target.y);
      },
      loop: true,
    });

    // Create burn zone at focus point after delay
    this.scene.time.delayedCall(300, () => {
      // Burn circle at target location
      const burnZone = this.scene.add.circle(
        target.x,
        target.y,
        25 * area,
        0xff4500,
        0.6
      );
      burnZone.setDepth(9);

      this.scene.physics.add.existing(burnZone);
      (burnZone as any).damage = damage;
      (burnZone as any).pierce = 999;

      this.scene.addProjectile(burnZone as any);

      // Fire particles
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const spark = this.scene.add.circle(
          target.x + Math.cos(angle) * 10 * area,
          target.y + Math.sin(angle) * 10 * area,
          4 * area,
          0xffff00,
          0.9
        );
        spark.setDepth(10);

        this.scene.tweens.add({
          targets: spark,
          x: target.x + Math.cos(angle) * 35 * area,
          y: target.y + Math.sin(angle) * 35 * area - 20,
          alpha: 0,
          scale: 0.3,
          duration: 400,
          onComplete: () => spark.destroy(),
        });
      }

      // Smoke effect
      const smoke = this.scene.add.circle(target.x, target.y - 10, 15 * area, 0x808080, 0.4);
      smoke.setDepth(10);
      this.scene.tweens.add({
        targets: smoke,
        y: target.y - 50,
        alpha: 0,
        scale: 2,
        duration: 600,
        onComplete: () => smoke.destroy(),
      });

      // Pulsing burn animation
      this.scene.tweens.add({
        targets: burnZone,
        scale: { from: 0.8, to: 1.3 },
        alpha: { from: 0.7, to: 0.3 },
        duration: 300,
        yoyo: true,
        repeat: 2,
        onComplete: () => burnZone.destroy(),
      });
    });

    // Cleanup
    this.scene.time.delayedCall(duration, () => {
      beamInterval.destroy();
      beamGraphics.destroy();
      lens.destroy();
      handle.destroy();
    });
  }
}
