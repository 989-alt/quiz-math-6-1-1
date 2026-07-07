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
    for (let i = 0; i < amount; i++) {
      const angle = (i / amount) * Math.PI * 2 + Math.random() * 0.5;
      this.createMarble(angle);
    }
  }

  private createMarble(angle: number): void {
    const speed = this.getSpeed();
    const damage = this.getDamage();
    const pierce = this.getPierce();
    const area = this.getArea();

    // Create glass marble with gradient effect
    const marble = this.scene.add.circle(
      this.player.x,
      this.player.y,
      8 * area,
      0x4169e1 // Royal blue
    );
    marble.setDepth(9);

    // Add shine effect
    const shine = this.scene.add.circle(
      this.player.x - 2 * area,
      this.player.y - 2 * area,
      2 * area,
      0xffffff,
      0.6
    );
    shine.setDepth(10);

    // 반짝 트윈: shine이 계속 숨쉬듯 밝기/크기를 오간다
    this.scene.tweens.add({
      targets: shine,
      alpha: 0.2,
      scale: 1.6,
      duration: 220,
      yoyo: true,
      repeat: -1,
    });

    this.scene.physics.add.existing(marble);
    const body = marble.body as Phaser.Physics.Arcade.Body;
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

    // Update shine position
    const updateShine = this.scene.time.addEvent({
      delay: 16,
      callback: () => {
        if (marble.active) {
          shine.setPosition(marble.x - 2 * area, marble.y - 2 * area);
        }
      },
      loop: true,
    });

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

    this.scene.time.delayedCall(this.getDuration(), () => {
      bounceTimer.destroy();
      updateShine.destroy();
      if (marble.active) marble.destroy();
      if (shine.active) shine.destroy();
    });

    // 관통 소진 등으로 duration 이전에 먼저 destroy되는 경우(pierce 소진, cleanupEntities)를 대비해
    // shine과 타이머를 즉시 정리 — 안 하면 shine이 남은 시간 동안 계속 깜빡인다
    marble.once('destroy', () => {
      bounceTimer.destroy();
      updateShine.destroy();
      if (shine.active) shine.destroy();
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
