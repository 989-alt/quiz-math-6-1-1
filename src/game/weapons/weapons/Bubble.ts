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
  private static readonly HIT_RESET_INTERVAL = 500;

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

  // 궤도 위치는 update()에서 매 프레임 갱신 (attack 쿨다운 틱으로 옮기면 위치가
  // 뚝뚝 끊겨 난잡해 보이고 이동 시 플레이어에게서 뒤처진다 — 사용자 피드백)
  attack(): void {
    // 생성/스탯 갱신만 담당 — 캐릭터 중심 원형 궤도에 균일 간격으로 상시 유지
    const amount = this.getAmount();
    const damage = this.getDamage();
    const area = this.getArea();

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
      (bubble as any).__lastHitReset = this.scene.time.now;

      this.scene.addProjectile(bubble as any);
      this.bubbles.push(bubble);
    }

    this.bubbles.forEach((bubble) => {
      if (!bubble.active) return;

      // Update damage
      (bubble as any).damage = damage;

      // GameScene의 (projectile, monster) 중복타격 방지 Set은 영구적이라 계속 맞닿아있는
      // 같은 몬스터(보스 등)를 다시는 못 때린다. 궤도형 무기는 주기적으로 초기화해 재타격 허용.
      const lastReset = (bubble as any).__lastHitReset ?? 0;
      if (this.scene.time.now - lastReset > Bubble.HIT_RESET_INTERVAL) {
        (bubble as any).__hitMonsters?.clear();
        (bubble as any).__lastHitReset = this.scene.time.now;
      }
    });

    // Clean up destroyed bubbles
    this.bubbles = this.bubbles.filter(b => b.active);
  }

  // 태양 주위 행성처럼: 매 프레임 플레이어 현재 위치 기준으로 균일 간격 원형 공전.
  // 플레이어가 이동하면 궤도 중심도 즉시 따라간다.
  update(delta: number): void {
    super.update(delta); // 쿨다운 → attack() (생성/스탯 관리)

    const area = this.getArea();
    const orbitRadius = 60 * area;
    this.orbitAngle += this.getSpeed() * 0.0007 * delta; // speed 3 ≈ 초당 2.1rad

    this.bubbles.forEach((bubble, i) => {
      if (!bubble.active) return;

      const angle = this.orbitAngle + (i / this.bubbles.length) * Math.PI * 2;
      bubble.x = this.player.x + Math.cos(angle) * orbitRadius;
      bubble.y = this.player.y + Math.sin(angle) * orbitRadius;

      // Floating effect (크기 숨쉬기 ±8%)
      bubble.setScale((1.1 * area) * (1 + Math.sin(this.scene.time.now / 300 + i) * 0.08));

      const body = bubble.body as Phaser.Physics.Arcade.Body;
      body.updateFromGameObject();
    });
  }
}
