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
      damage: 45, // 단일 대상 고데미지 역할(강한 적 우선 타격)에 맞춰 35 → 45 상향
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
    // 체력이 가장 많은 몬스터 우선(보스/엘리트 킬러), 없으면 가까운 적 폴백
    const target = this.findToughestEnemy(350) ?? this.findClosestEnemy(350);
    if (!target) return;

    const damage = this.getDamage();
    const area = this.getArea();
    const duration = this.getDuration();

    // 텔레그래프 중 타겟이 죽어도(destroy) 그 위치에 그대로 번 — 좌표를 미리 캡처
    const targetX = target.x;
    const targetY = target.y;

    // Create magnifying glass above target
    const glassX = targetX;
    const glassY = targetY - 80;

    // 렌즈+손잡이 (weapon_magnifying_glass 픽셀아트, 기존 도형 렌즈 지름 40*area → native 48px 기준 스케일 환산)
    const glass = this.scene.add.sprite(glassX, glassY, 'weapon_magnifying_glass');
    glass.setScale(area);
    glass.setDepth(11);

    // Telegraph ring shrinking over 0.5s to warn the burn is coming
    const telegraph = this.scene.add.circle(targetX, targetY, 45 * area, 0xff4500, 0);
    telegraph.setStrokeStyle(3, 0xffa500, 0.9);
    telegraph.setDepth(10);
    this.scene.tweens.add({
      targets: telegraph,
      scale: 0.1,
      alpha: 0.4,
      duration: 500,
      ease: 'Sine.easeIn',
      onComplete: () => telegraph.destroy(),
    });

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
            targetX,
            targetY
          );
        }

        // Central bright beam
        beamGraphics.lineStyle(4, 0xffa500, alpha);
        beamGraphics.lineBetween(glassX, glassY + 15 * area, targetX, targetY);
      },
      loop: true,
    });

    // Create burn zone at focus point once the telegraph finishes closing
    this.scene.time.delayedCall(500, () => {
      this.playImpact(targetX, targetY, 'burn');

      // Burn circle at target location
      const burnZone = this.scene.add.circle(
        targetX,
        targetY,
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
          targetX + Math.cos(angle) * 10 * area,
          targetY + Math.sin(angle) * 10 * area,
          4 * area,
          0xffff00,
          0.9
        );
        spark.setDepth(10);

        this.scene.tweens.add({
          targets: spark,
          x: targetX + Math.cos(angle) * 35 * area,
          y: targetY + Math.sin(angle) * 35 * area - 20,
          alpha: 0,
          scale: 0.3,
          duration: 400,
          onComplete: () => spark.destroy(),
        });
      }

      // Smoke effect
      const smoke = this.scene.add.circle(targetX, targetY - 10, 15 * area, 0x808080, 0.4);
      smoke.setDepth(10);
      this.scene.tweens.add({
        targets: smoke,
        y: targetY - 50,
        alpha: 0,
        scale: 2,
        duration: 600,
        onComplete: () => smoke.destroy(),
      });

      // Ground scorch decal lingering after the burn fades
      const scorch = this.scene.add.ellipse(targetX, targetY + 6 * area, 36 * area, 12 * area, 0x1a1208, 0.55);
      scorch.setDepth(5);
      this.scene.tweens.add({
        targets: scorch,
        alpha: 0,
        duration: 1200,
        delay: 500,
        onComplete: () => scorch.destroy(),
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
      glass.destroy();
    });
  }
}
