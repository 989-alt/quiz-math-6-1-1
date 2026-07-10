import Phaser from 'phaser';
import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Marble extends WeaponBase {
  id = 'marble';
  name = 'Marble';
  nameKo = '구슬';
  description = 'Bounces off walls';
  descriptionKo = '벽에 반사되는 구슬';
  maxLevel = 8;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 14,
      cooldown: 1000,
      area: 1,
      speed: 400,
      duration: 5000,
      amount: 1,
      pierce: 5,
      knockback: 0,
    };
    this.levelUpgrades = [
      { pierce: 2 },
      { damage: 4 },
      { amount: 1 },
      { speed: 50 },
      { damage: 5 },
      { pierce: 3 },
      { damage: 8 },
    ];
  }

  attack(): void {
    const amount = this.getAmount();
    const targets = this.findClosestEnemies(amount);
    for (let i = 0; i < amount; i++) {
      const t = targets.length > 0 ? targets[i % targets.length] : null;
      const angle = t
        ? Phaser.Math.Angle.Between(this.player.x, this.player.y, t.x, t.y)
        : (i / amount) * Math.PI * 2 + Math.random() * 0.5; // 폴백: 기존 산개
      this.createMarble(angle);
    }
  }

  private createMarble(angle: number): void {
    const speed = this.getSpeed();
    const damage = this.getDamage();
    const pierce = this.getPierce();
    const area = this.getArea();

    // 유리구슬 픽셀아트 스프라이트 (기존 원 지름 ~16px 상당 크기로 스케일)
    const marble = this.scene.add.sprite(
      this.player.x,
      this.player.y,
      'weapon_marble'
    );
    const targetScale = (20 * area) / marble.width;
    marble.setScale(targetScale * 0.7);
    marble.setDepth(9);

    // 스폰 스케일 팝 (0.7 → 1.0, 80ms)
    this.scene.tweens.add({
      targets: marble,
      scale: targetScale,
      duration: 80,
      ease: 'Sine.easeOut',
    });

    // 반짝 트윈: 구슬이 숨쉬듯 밝기를 오간다 (기존 shine 원 대체)
    this.scene.tweens.add({
      targets: marble,
      alpha: 0.7,
      duration: 220,
      delay: 80,
      yoyo: true,
      repeat: -1,
    });

    this.scene.physics.add.existing(marble);
    const body = marble.body as Phaser.Physics.Arcade.Body;
    body.setSize(marble.width * 0.8, marble.height * 0.8);
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    body.setBounce(1, 1);

    (marble as any).damage = damage;
    (marble as any).pierce = pierce;

    this.scene.addProjectile(marble as any);
    this.wireImpactFx(marble, 'hit_small');

    // 최대 사거리에 도달하면 방향을 1회 반전(직선 반사)
    const startX = this.player.x;
    const startY = this.player.y;
    const maxRange = 260 * area;
    let hasReversed = false;

    // Bounce logic
    const bounceTimer = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (!marble.active) return;
        const cam = this.scene.cameras.main;
        const padding = 100;
        const bounds = {
          left: cam.scrollX - padding,
          right: cam.scrollX + cam.width + padding,
          top: cam.scrollY - padding,
          bottom: cam.scrollY + cam.height + padding,
        };

        if (marble.x <= bounds.left || marble.x >= bounds.right) {
          body.setVelocityX(-body.velocity.x);
        }
        if (marble.y <= bounds.top || marble.y >= bounds.bottom) {
          body.setVelocityY(-body.velocity.y);
        }

        if (!hasReversed) {
          const dist = Phaser.Math.Distance.Between(startX, startY, marble.x, marble.y);
          if (dist >= maxRange) {
            hasReversed = true;
            body.setVelocity(-body.velocity.x, -body.velocity.y);
          }
        }
      },
      loop: true,
    });

    // 수명 종료 시 허공 소멸 금지: 페이드로 종결
    this.scene.time.delayedCall(this.getDuration(), () => {
      bounceTimer.destroy();
      if (!marble.active) return;
      this.scene.tweens.killTweensOf(marble); // 반짝 트윈 정지
      this.scene.tweens.add({
        targets: marble,
        alpha: 0,
        scale: targetScale * 0.5,
        duration: 150,
        onComplete: () => {
          if (marble.active) marble.destroy();
        },
      });
    });

    // 관통 소진 등으로 duration 이전에 먼저 destroy되는 경우(pierce 소진, cleanupEntities)를 대비해
    // 타이머·트윈을 즉시 정리
    marble.once('destroy', () => {
      bounceTimer.destroy();
      this.scene.tweens.killTweensOf(marble);
    });
  }

  // 명중 시 hit_spark(소) 이펙트 재생
  private wireImpactFx(projectile: any, kind: string): void {
    const hitSet = new Set<any>();
    const overlap = this.scene.physics.add.overlap(projectile, this.scene.getMonsters(), (_p, monster) => {
      if (hitSet.has(monster)) return;
      hitSet.add(monster);
      const m = monster as Phaser.Physics.Arcade.Sprite;
      this.playImpact(m.x, m.y, kind);
    });

    projectile.once('destroy', () => overlap.destroy());
  }
}
