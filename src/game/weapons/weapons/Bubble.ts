import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

export class Bubble extends WeaponBase {
  id = 'bubble';
  name = 'Bubble';
  nameKo = '비눗방울';
  description = 'Orbiting bubbles';
  descriptionKo = '주위를 도는 비눗방울';
  maxLevel = 8;

  private bubbles: Phaser.GameObjects.Sprite[] = [];
  private orbitAngle: number = 0;
  private lastTickTime: number = 0;
  private static readonly HIT_RESET_INTERVAL = 500;
  private static readonly LIFESPAN = 2500;
  // 퀴즈/레벨업 일시정지 동안 scene 시계는 계속 흐르므로, 절대시각 대신
  // 틱 간 delta 누적으로 나이를 재고 큰 점프(일시정지 복귀)는 클램프한다.
  private static readonly MAX_TICK_DELTA = 200;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 12,
      cooldown: 100, // Continuous damage check
      area: 1,
      speed: 3, // Orbit speed
      duration: 999999,
      amount: 3,
      pierce: 999,
      knockback: 0,
    };
    this.levelUpgrades = [
      { amount: 1 },
      { damage: 3 },
      { area: 0.1 },
      { amount: 1 },
      { damage: 4 },
      { amount: 1 },
      { damage: 5 },
    ];
  }

  attack(): void {
    // Create/update orbiting bubbles
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();

    const now = this.scene.time.now;
    const tickDelta = this.lastTickTime
      ? Math.min(now - this.lastTickTime, Bubble.MAX_TICK_DELTA)
      : 0;
    this.lastTickTime = now;

    // Create missing bubbles
    while (this.bubbles.length < amount) {
      // Use actual sprite
      const bubble = this.scene.add.sprite(
        this.player.x,
        this.player.y,
        'weapon_bubble'
      );
      bubble.setScale(1.1 * area);
      bubble.setDepth(9);
      bubble.setAlpha(0.8);

      this.scene.physics.add.existing(bubble);
      const body = bubble.body as Phaser.Physics.Arcade.Body;
      body.setSize(bubble.width * 0.8, bubble.height * 0.8);

      (bubble as any).damage = damage;
      (bubble as any).pierce = 999;
      (bubble as any).__age = 0;
      (bubble as any).__lastHitReset = this.scene.time.now;

      this.scene.addProjectile(bubble as any);
      this.bubbles.push(bubble);
    }

    // Update bubble positions
    const orbitRadius = 60 * area;
    this.orbitAngle += this.getSpeed() * 0.02;

    this.bubbles.forEach((bubble, i) => {
      if (!bubble.active) return;

      const age = ((bubble as any).__age ?? 0) + tickDelta;
      (bubble as any).__age = age;
      if (age > Bubble.LIFESPAN) {
        this.popBubble(bubble);
        return;
      }

      const angle = this.orbitAngle + (i / this.bubbles.length) * Math.PI * 2;
      bubble.x = this.player.x + Math.cos(angle) * orbitRadius;
      bubble.y = this.player.y + Math.sin(angle) * orbitRadius;

      // Update damage
      (bubble as any).damage = damage;

      // GameScene의 (projectile, monster) 중복타격 방지 Set은 영구적이라 계속 맞닿아있는
      // 같은 몬스터(보스 등)를 다시는 못 때린다. 궤도형 무기는 주기적으로 초기화해 재타격 허용.
      const lastReset = (bubble as any).__lastHitReset ?? 0;
      if (this.scene.time.now - lastReset > Bubble.HIT_RESET_INTERVAL) {
        (bubble as any).__hitMonsters?.clear();
        (bubble as any).__lastHitReset = this.scene.time.now;
      }

      // Floating effect
      bubble.setScale((1.1 * area) * (1 + Math.sin(Date.now() / 300 + i) * 0.08));

      // Update physics body position
      const body = bubble.body as Phaser.Physics.Arcade.Body;
      body.updateFromGameObject();
    });

    // Clean up destroyed bubbles
    this.bubbles = this.bubbles.filter(b => b.active);
  }

  private popBubble(bubble: Phaser.GameObjects.Sprite): void {
    const x = bubble.x;
    const y = bubble.y;

    this.playImpact(x, y, 'poof');

    const shine = this.scene.add.circle(x, y, bubble.displayWidth * 0.6, 0xffffff, 0.6);
    shine.setDepth(10);
    this.scene.tweens.add({
      targets: shine,
      scale: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => shine.destroy(),
    });

    bubble.destroy();
  }
}
