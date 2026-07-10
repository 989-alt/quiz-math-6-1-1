import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class LunchBox extends WeaponBase {
  id = 'lunch_box';
  name = 'Lunch Box';
  nameKo = '도시락';
  description = 'Explosive area damage';
  descriptionKo = '폭발하는 도시락';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 45,
      cooldown: 3500,
      area: 1,
      speed: 150,
      duration: 1000,
      amount: 1,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 8 },
      { area: 0.15 },
      { cooldown: -200 },
      { damage: 10 },
      { area: 0.15 },
      { amount: 1 },
      { damage: 15 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    for (let i = 0; i < amount; i++) {
      const target = this.findRandomEnemyInRange(300);
      if (target) {
        this.throwLunchBox(target.x, target.y);
      } else {
        const angle = Math.random() * Math.PI * 2;
        const dist = 100 + Math.random() * 100;
        this.throwLunchBox(
          this.player.x + Math.cos(angle) * dist,
          this.player.y + Math.sin(angle) * dist
        );
      }
    }
  }

  private throwLunchBox(targetX: number, targetY: number): void {
    const damage = this.getDamage();
    const area = this.getArea();

    // 도시락 픽셀아트 스프라이트 (기존 사각형 폭 ~32px 상당 크기로 스케일)
    const lunchBox = this.scene.add.sprite(
      this.player.x,
      this.player.y,
      'weapon_lunch_box'
    );
    const targetScale = (32 * area) / lunchBox.width;
    lunchBox.setScale(targetScale * 0.7);
    lunchBox.setDepth(9);

    // Arc throw animation
    this.scene.tweens.add({
      targets: lunchBox,
      x: targetX,
      y: targetY,
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // Explosion effect
        this.playImpact(targetX, targetY, 'explosion');

        // 폭발 데미지 반경 확대 (48 → 80, 대형 단발화)
        const explosion = this.scene.add.circle(
          targetX,
          targetY,
          80 * area,
          0xffa500,
          0.7
        );
        explosion.setDepth(8);

        this.scene.physics.add.existing(explosion);

        (explosion as any).damage = damage;
        (explosion as any).pierce = 999;

        this.scene.addProjectile(explosion as any);

        this.scene.tweens.add({
          targets: explosion,
          scaleX: 1.5,
          scaleY: 1.5,
          alpha: 0,
          duration: 300,
          onComplete: () => explosion.destroy(),
        });

        // 음식 파편: 도시락 조각이 사방으로 튄다
        const crumbTints = [0xffe08a, 0xff8a5c, 0x9be37a]; // 밥·소시지·채소 느낌
        for (let i = 0; i < 5; i++) {
          const angle = Math.random() * Math.PI * 2;
          const crumb = this.scene.add.sprite(targetX, targetY, 'weapon_lunch_box');
          crumb.setScale(targetScale * 0.3);
          crumb.setDepth(10);
          crumb.setTint(crumbTints[i % crumbTints.length]);

          this.scene.tweens.add({
            targets: crumb,
            x: targetX + Math.cos(angle) * (30 + Math.random() * 25) * area,
            y: targetY + Math.sin(angle) * (30 + Math.random() * 25) * area,
            rotation: (Math.random() - 0.5) * 6,
            alpha: 0,
            scale: targetScale * 0.1,
            duration: 350,
            ease: 'Quad.easeOut',
            onComplete: () => crumb.destroy(),
          });
        }

        lunchBox.destroy();
      },
    });

    // 스폰 스케일 팝 (0.7 → 1.0, 80ms)
    this.scene.tweens.add({
      targets: lunchBox,
      scale: targetScale,
      duration: 80,
      ease: 'Sine.easeOut',
    });

    // Parabola scale pop (up during rise, down as it lands)
    this.scene.tweens.add({
      targets: lunchBox,
      scale: targetScale * 1.3,
      duration: 210,
      delay: 80,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });

    // Tumbling rotation during flight
    this.scene.tweens.add({
      targets: lunchBox,
      rotation: Math.PI * 4,
      duration: 500,
    });
  }
}
