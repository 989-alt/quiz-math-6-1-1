import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Butterfly extends WeaponBase {
  id = 'butterfly';
  name = 'Butterfly';
  nameKo = '나비';
  description = 'Multiple weak homing butterflies';
  descriptionKo = '여러 마리가 날아가는 나비 떼';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 8,
      cooldown: 1200,
      area: 1,
      speed: 180,
      duration: 5000,
      amount: 3,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 2 },
      { amount: 1 },
      { speed: 20 },
      { amount: 1 },
      { damage: 3 },
      { amount: 2 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const targets = this.findClosestEnemies(amount);
    for (let i = 0; i < amount; i++) {
      const assigned = targets.length > 0 ? targets[i % targets.length] : null;
      this.scene.time.delayedCall(i * 200, () => {
        this.createButterfly(assigned);
      });
    }
  }

  private createButterfly(assigned: Phaser.Physics.Arcade.Sprite | null): void {
    // 배정 타겟이 죽었거나 없으면 발사 시점 최근접으로 폴백
    const target = assigned && assigned.active ? assigned : this.findClosestEnemy();
    if (!target) return;

    const speed = this.getSpeed();
    const damage = this.getDamage();
    const pierce = this.getPierce();
    const area = this.getArea();

    // 픽셀아트 나비 스프라이트. 아트 여백 때문에 0.6이면 배경 반점 수준으로 안 읽혀
    // 1.2로 상향 (인게임 검증 실측: 형태가 식별되는 최소 크기)
    const butterfly = this.scene.add.sprite(this.player.x, this.player.y, 'weapon_butterfly');
    const targetScale = 1.2 * area;
    butterfly.setDepth(9);

    this.scene.physics.add.existing(butterfly);
    const body2 = butterfly.body as Phaser.Physics.Arcade.Body;
    body2.setSize(butterfly.width * 0.7, butterfly.height * 0.7);

    (butterfly as any).damage = damage;
    (butterfly as any).pierce = pierce;

    this.scene.addProjectile(butterfly as any);

    // Spawn scale pop (0.7 -> 1.0)
    butterfly.setScale(targetScale * 0.7);
    this.scene.tweens.add({
      targets: butterfly,
      scale: targetScale,
      duration: 80,
      ease: 'Sine.easeOut',
    });

    // Impact effect on first contact with each monster
    const hitMonsters = new Set<Phaser.Physics.Arcade.Sprite>();
    const fxCollider = this.scene.physics.add.overlap(butterfly, this.scene.getMonsters(), (_b, monster) => {
      const m = monster as Phaser.Physics.Arcade.Sprite;
      if (hitMonsters.has(m)) return;
      hitMonsters.add(m);
      this.playImpact(m.x, m.y, 'heal');
    });
    butterfly.once('destroy', () => fxCollider.destroy());

    // 날개짓: 스폰 팝(0~80ms)이 끝난 뒤 scaleX 요요로 퍼덕임 (단일 스프라이트 대체 연출, 12fps 상당)
    this.scene.tweens.add({
      targets: butterfly,
      scaleX: { from: targetScale, to: targetScale * 0.3 },
      duration: 83,
      delay: 80,
      yoyo: true,
      repeat: -1,
    });

    // Gentle homing with sine hover
    const startTime = this.scene.time.now;
    let steerAngle = Phaser.Math.Angle.Between(butterfly.x, butterfly.y, target.x, target.y);
    const homingEvent = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (!butterfly.active || !target.active) {
          homingEvent.destroy();
          return;
        }
        const elapsed = this.scene.time.now - startTime;
        const desiredAngle = Phaser.Math.Angle.Between(butterfly.x, butterfly.y, target.x, target.y);
        steerAngle = Phaser.Math.Angle.RotateTo(steerAngle, desiredAngle, 0.08);
        const hover = Math.sin(elapsed / 200) * 40;
        const hoverAngle = steerAngle + Math.PI / 2;
        body2.setVelocity(
          Math.cos(steerAngle) * speed + Math.cos(hoverAngle) * hover,
          Math.sin(steerAngle) * speed + Math.sin(hoverAngle) * hover
        );
      },
      loop: true,
    });

    this.scene.time.delayedCall(this.getDuration(), () => {
      homingEvent.destroy();
      if (butterfly.active) {
        this.scene.tweens.add({
          targets: butterfly,
          alpha: 0,
          duration: 200,
          onComplete: () => butterfly.destroy(),
        });
      }
    });
  }
}
