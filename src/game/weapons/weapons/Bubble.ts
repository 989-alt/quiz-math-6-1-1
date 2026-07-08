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
      // 방울은 update()에서 매 프레임 x/y를 직접 찍어 배치하는 "수동 구동(kinematic)" 바디다.
      // moves=true(기본)면 Arcade가 postUpdate에서 (position - prevFrame)만큼을 스프라이트에
      // 한 번 더 더해(updateFromGameObject로 이미 옮긴 위치 위에) 프레임 이동량을 이중 적용한다.
      // 그 잔차는 프레임마다 부호가 뒤집히는 감쇠 없는 진동(willStep 패턴에 따라 수초간 지속되다
      // no-step 프레임에서 리셋)이라, 생성/개수변화 직후 방울이 잠깐 튀어 보인다. moves=false로
      // postUpdate의 스프라이트 역동기화를 꺼 위치를 update()가 단독 소유하게 한다.
      // (몬스터 겹침 판정은 updateFromGameObject가 갱신하는 body 경계를 쓰므로 영향 없음)
      body.moves = false;

      (bubble as any).damage = damage;
      (bubble as any).pierce = 999;
      (bubble as any).__lastHitReset = this.scene.time.now;
      // 새로 생성되는 방울은 "자신의" 목표 슬롯 각도 위에 바로 배치한다(스냅 없이 궤도 위에서 시작).
      // 이후 매 프레임 update()에서 목표 슬롯 각도를 (인덱스 / 개수)로 재계산하고
      // 현재 각도를 그쪽으로 부드럽게 수렴시키므로, 기존 방울들도 순간이동 없이 재배치된다.
      (bubble as any).__slotAngle = (this.bubbles.length / amount) * Math.PI * 2;

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
    // 캐릭터 세로 길이의 절반만큼 더 떨어뜨려 궤도가 캐릭터에 바짝 붙어 보이지 않게 한다
    // (사용자 피드백). displayHeight는 스프라이트 스케일 변경에도 항상 정확한 실제 크기.
    const orbitRadius = 60 * area + this.player.displayHeight / 2;
    this.orbitAngle += this.getSpeed() * 0.0007 * delta; // speed 3 ≈ 초당 2.1rad

    this.bubbles.forEach((bubble, i) => {
      if (!bubble.active) return;

      // 목표 슬롯 각도는 매 프레임 (인덱스 / 현재 개수)로 재계산해 항상 균일 간격을 유지한다.
      // 개수가 바뀌어 목표가 바뀌더라도 실제 각도(__slotAngle)는 최단 회전 방향으로
      // 약 300ms에 걸쳐 서서히 수렴시켜(지수 감쇠) 순간이동 없이 자연스럽게 재배치된다.
      // 개수가 그대로면 목표==현재라 드리프트도, 추가 비용도 없다.
      const targetSlotAngle = (i / this.bubbles.length) * Math.PI * 2;
      const currentSlotAngle = (bubble as any).__slotAngle ?? targetSlotAngle;
      const slotDiff = Phaser.Math.Angle.Wrap(targetSlotAngle - currentSlotAngle);
      (bubble as any).__slotAngle = currentSlotAngle + slotDiff * Math.min(1, delta * 0.01);

      const angle = this.orbitAngle + (bubble as any).__slotAngle;
      bubble.x = this.player.x + Math.cos(angle) * orbitRadius;
      bubble.y = this.player.y + Math.sin(angle) * orbitRadius;

      // Floating effect (크기 숨쉬기 ±8%) — 고정 인덱스를 위상차로 써서 방울마다 다르게,
      // 숨쉬기 주기는 공전 속도와 무관하게 일정하게 유지
      bubble.setScale((1.1 * area) * (1 + Math.sin(this.scene.time.now / 300 + i) * 0.08));

      const body = bubble.body as Phaser.Physics.Arcade.Body;
      body.updateFromGameObject();
    });
  }
}
