import Phaser from 'phaser';
import { PetBase } from './PetBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';
import { XPGem } from '../../entities/XPGem';

type HamsterState = 'IDLE' | 'ALERT' | 'DASH' | 'RETURN' | 'FETCH_GO' | 'FETCH_RETURN';

/**
 * 햄스터 펫: 적에게 몸통 돌진 + 떨어진 수정 배달 (설계 T1).
 * - DASH 피해는 시작 시 생성되는 이동 히트존(addProjectile) 1개가 펫을 추종하며 처리 —
 *   목표 지점보다 120px 더 파고드는 관통 돌진이라 경로상 몬스터를 훑고 지나간다.
 *   본체 스프라이트는 절대 projectile로 등록하지 않는다.
 * - 젬 배달은 gem.startCollection(펫)으로 끌고 와 플레이어 몸 중심으로 파고들어
 *   기존 player↔xpGems overlap이 collect()를 발화시킨다 (XP 지급 경로 단일화 —
 *   펫이 gem.collect()를 직접 호출하는 일은 없다).
 */
export class HamsterPet extends PetBase {
  id = 'hamster';
  name = 'Hamster';
  nameKo = '햄스터';
  description = 'Charges at enemies and fetches gems';
  descriptionKo = '적에게 몸통 돌진! 떨어진 수정도 물어다 줘요';
  maxLevel = 8;

  private static readonly DASH_DETECT_RANGE = 400;
  private static readonly DASH_MIN_COOLDOWN = 1400;
  private static readonly DASH_IMPACT_DIST = 24;
  private static readonly DASH_MAX_MS = 1600;
  private static readonly DASH_OVERSHOOT = 120; // 관통 돌진: 적 위치보다 더 멀리 파고드는 거리(px)
  private static readonly FETCH_SPEED = 300;
  private static readonly FETCH_PICKUP_DIST = 14;
  private static readonly FETCH_TOTAL_TIMEOUT = 6000;
  private static readonly FETCH_NEAR_PLAYER_DIST = 30;
  private static readonly FETCH_NEAR_PLAYER_FORCE_MS = 2000;

  protected get followSlot(): { x: number; y: number } {
    return { x: -46, y: 30 };
  }

  protected get walkAnimKey(): string {
    return 'pet_hamster_walk';
  }

  protected get fallbackTextureKey(): string {
    return 'weapon_hamster';
  }

  protected get baseScale(): number {
    return 1.1;
  }

  protected levelDescKo: string[] = [
    '공격력 +6',
    '수정 배달 준비 8초 → 6초',
    '공격력 +8',
    '돌진 준비 -0.4초',
    '수정 감지 범위 +80',
    '공격력 +10',
    '돌진 준비 -0.3초 · 배달 준비 6초 → 4초',
  ];

  // 펫 전용 레벨 테이블 (index = level-1)
  private static readonly FETCH_COOLDOWN_BY_LEVEL = [8000, 8000, 6000, 6000, 6000, 6000, 6000, 4000];
  private static readonly FETCH_RANGE_BY_LEVEL = [180, 180, 180, 180, 180, 260, 260, 260];

  // === 타이머/상태 (전부 delta 누적) ===
  private dashCooldownTimer: number = 0;
  private fetchCooldownTimer: number = 0;
  private alertTimer: number = 0;
  private dashTimer: number = 0;
  private dashTarget: Phaser.Physics.Arcade.Sprite | null = null;
  private dashTargetX: number = 0;
  private dashTargetY: number = 0;
  private dashAngle: number = 0; // ALERT 진입 시 확정되는 돌진 방향(오버슛 계산에 고정 사용)
  private dashHitZone: Phaser.GameObjects.Arc | null = null; // DASH 중 펫을 추종하는 이동 히트존
  private fetchGem: XPGem | null = null;
  private fetchTotalTimer: number = 0;
  private fetchNearPlayerTimer: number = 0;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 20,
      cooldown: 2500, // 돌진 쿨
      area: 1,
      speed: 520, // 돌진 속도
      duration: 999999,
      amount: 1,
      pierce: 5,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 6 },
      {},
      { damage: 8 },
      { cooldown: -400 },
      {},
      { damage: 10 },
      { cooldown: -300 },
    ];

    this.initPet();
  }

  private getFetchCooldown(): number {
    return HamsterPet.FETCH_COOLDOWN_BY_LEVEL[this.level - 1] ?? 6000;
  }

  private getFetchRange(): number {
    return HamsterPet.FETCH_RANGE_BY_LEVEL[this.level - 1] ?? 180;
  }

  private getDashCooldown(): number {
    return Math.max(HamsterPet.DASH_MIN_COOLDOWN, this.getCooldown());
  }

  protected updateState(delta: number): void {
    // 쿨은 항상 누적 (레디 판정은 임계 비교)
    this.dashCooldownTimer += delta;
    this.fetchCooldownTimer += delta;

    switch (this.petState as HamsterState) {
      case 'IDLE': {
        this.updateIdleFollow(delta);

        // 우선순위: 돌진 > 배달 (전투가 먼저)
        if (this.dashCooldownTimer >= this.getDashCooldown()) {
          const target = this.findClosestEnemy(HamsterPet.DASH_DETECT_RANGE);
          if (target) {
            this.dashTarget = target;
            // 방향은 ALERT 진입 시점(지금)에 확정 — DASH 중엔 이 방향을 유지한 채 오버슛만 재계산
            this.dashAngle = Phaser.Math.Angle.Between(this.px, this.py, target.x, target.y);
            this.dashTargetX = target.x + Math.cos(this.dashAngle) * HamsterPet.DASH_OVERSHOOT;
            this.dashTargetY = target.y + Math.sin(this.dashAngle) * HamsterPet.DASH_OVERSHOOT;
            this.alertTimer = 0;
            this.petState = 'ALERT';
            this.showEmote('alert');
            break;
          }
        }

        if (this.fetchCooldownTimer >= this.getFetchCooldown()) {
          const gem = this.findFetchableGem();
          if (gem) {
            this.fetchGem = gem;
            this.fetchTotalTimer = 0;
            this.fetchNearPlayerTimer = 0;
            this.petState = 'FETCH_GO';
          }
        }
        break;
      }

      case 'ALERT': {
        // "!" + 250ms 정지 후 돌진
        this.alertTimer += delta;
        if (this.alertTimer >= PetBase.ALERT_PAUSE) {
          this.dashTimer = 0;
          this.petState = 'DASH';
          this.startDashHitZone(); // DASH 시작 시 이동 히트존 1개 생성 (펫을 추종)
        }
        break;
      }

      case 'DASH': {
        this.dashTimer += delta;

        // 타깃 생존 중엔 좌표 추적하되, 방향은 ALERT 진입 시 확정된 dashAngle 유지 + 오버슛 재계산
        if (this.dashTarget && this.dashTarget.active) {
          this.dashTargetX = this.dashTarget.x + Math.cos(this.dashAngle) * HamsterPet.DASH_OVERSHOOT;
          this.dashTargetY = this.dashTarget.y + Math.sin(this.dashAngle) * HamsterPet.DASH_OVERSHOOT;
        }

        const remain = this.moveLinear(this.dashTargetX, this.dashTargetY, this.getSpeed(), delta);

        // 이동 히트존을 펫 좌표로 매 프레임 추종
        if (this.dashHitZone && this.dashHitZone.active) {
          this.dashHitZone.setPosition(this.px, this.py);
          const zoneBody = (this.dashHitZone as unknown as { body: Phaser.Physics.Arcade.Body }).body;
          zoneBody.reset(this.px, this.py);
        }

        if (remain <= HamsterPet.DASH_IMPACT_DIST || remain <= 0.5) {
          this.endDash();
        } else if (this.dashTimer >= HamsterPet.DASH_MAX_MS) {
          // 세이프티: 타임아웃 시 그 자리에서 종료
          this.endDash();
        }
        break;
      }

      case 'FETCH_GO': {
        this.fetchTotalTimer += delta;
        const gem = this.fetchGem;

        if (!gem || !gem.active || gem.isCollecting()) {
          // 도착 전에 사라짐/다른 경로로 수집 시작 → 포기 (쿨 절반 소모)
          this.abandonFetch(false);
          break;
        }
        if (this.fetchTotalTimer >= HamsterPet.FETCH_TOTAL_TIMEOUT) {
          this.abandonFetch(true);
          break;
        }

        const remain = this.moveLinear(gem.x, gem.y, HamsterPet.FETCH_SPEED, delta);
        if (remain <= HamsterPet.FETCH_PICKUP_DIST) {
          (gem as any).__petFetched = true;
          gem.startCollection(this.sprite as unknown as Phaser.Physics.Arcade.Sprite);
          this.petState = 'FETCH_RETURN';
        }
        break;
      }

      case 'FETCH_RETURN': {
        this.fetchTotalTimer += delta;
        const gem = this.fetchGem;

        // 젬 비활성 = 플레이어 overlap이 collect() 완료 → 배달 성공
        if (!gem || !gem.active) {
          this.showEmote('heart');
          this.fetchCooldownTimer = 0;
          this.fetchGem = null;
          this.petState = 'RETURN';
          break;
        }

        if (this.fetchTotalTimer >= HamsterPet.FETCH_TOTAL_TIMEOUT) {
          this.abandonFetch(true);
          break;
        }

        // 플레이어 몸 중심으로 파고들기 (슬롯 아님) → 젬이 펫을 쫓아와 플레이어와 overlap
        const remain = this.moveLinear(this.player.x, this.player.y, HamsterPet.FETCH_SPEED, delta);

        // 페일세이프: 2초간 플레이어 곁에 있는데도 젬이 살아있으면 플레이어 위치로 스냅해
        // overlap을 강제 (지급은 여전히 overlap 경로 — 펫이 collect()를 호출하지 않음)
        if (remain <= HamsterPet.FETCH_NEAR_PLAYER_DIST) {
          this.fetchNearPlayerTimer += delta;
          if (this.fetchNearPlayerTimer >= HamsterPet.FETCH_NEAR_PLAYER_FORCE_MS) {
            this.px = this.player.x;
            this.py = this.player.y;
          }
        } else {
          this.fetchNearPlayerTimer = 0;
        }
        break;
      }

      case 'RETURN': {
        if (this.updateReturn(delta)) {
          this.petState = 'IDLE';
        }
        break;
      }
    }
  }

  /**
   * DASH 시작 시 이동 히트존 1개 생성 (관통 돌진 — damage||10 폴백 안전, damage/pierce 명시).
   * 자체 __hitMonsters Set을 가져 "돌진당 몬스터 1회 히트"만 보장하고, DASH 동안 매 프레임
   * setPosition + body.reset으로 펫 좌표를 추종한다.
   */
  private startDashHitZone(): void {
    const radius = 26 * this.getArea();
    const zone = this.scene.add.circle(this.px, this.py, radius, 0x000000, 0);
    this.scene.physics.add.existing(zone);
    const body = (zone as unknown as { body: Phaser.Physics.Arcade.Body }).body;
    body.setCircle(radius);

    (zone as any).damage = this.getDamage();
    (zone as any).pierce = 999;
    (zone as any).__hitMonsters = new Set<Phaser.Physics.Arcade.Sprite>();
    this.scene.addProjectile(zone as any);

    this.dashHitZone = zone;
  }

  /** 이동 히트존 제거 (존속 중이면 destroy) — 리셋/DASH 종료 어느 경로에서도 안전하게 호출 가능 */
  private destroyDashHitZone(): void {
    if (this.dashHitZone) {
      if (this.dashHitZone.active) this.dashHitZone.destroy();
      this.dashHitZone = null;
    }
  }

  /** DASH 종료 처리(도달/타임아웃 공통): 이동 히트존 제거 + 도착점 이펙트 + 쿨 리셋 + RETURN 전환
   *  (기존 dashImpact의 마무리 역할을 대체 — 피해는 DASH 중 이동 히트존이 이미 처리했음) */
  private endDash(): void {
    this.destroyDashHitZone();

    this.playImpact(this.px, this.py, 'hit_small');
    this.scene.fx.poof(this.px, this.py);

    this.dashCooldownTimer = 0;
    this.dashTarget = null;
    this.petState = 'RETURN';
  }

  /** 배달 포기: __petFetched 해제 + 참조 해제 + 복귀. consumeHalf=true(타임아웃)면 쿨 절반만 소모 */
  private abandonFetch(consumeHalf: boolean): void {
    if (this.fetchGem && this.fetchGem.active) {
      delete (this.fetchGem as any).__petFetched;
    }
    this.fetchGem = null;
    if (consumeHalf) {
      this.fetchCooldownTimer = this.getFetchCooldown() / 2;
    }
    // consumeHalf=false(젬이 도착 전 소멸/선점)면 누적 쿨 유지 → 곧바로 다른 젬 재시도 가능
    this.petState = 'RETURN';
  }

  /**
   * 감지 범위 내 배달 가능한 가장 가까운 젬 (수집 중/다른 펫 선점 제외).
   * 범위는 플레이어 기준 — '수정 감지 범위'는 주인 주변에 떨어진 수정을 줍는 오라 개념이라
   * 펫의 현재 위치(슬롯 오프셋)에 좌우되지 않게 한다.
   */
  private findFetchableGem(): XPGem | null {
    const range = this.getFetchRange();
    let closest: XPGem | null = null;
    let closestDist = Infinity;

    this.scene.getXpGems().getChildren().forEach((child) => {
      const g = child as XPGem;
      if (!g.active || g.isCollecting() || (g as any).__petFetched) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, g.x, g.y);
      if (dist <= range && dist < closestDist) {
        closestDist = dist;
        closest = g;
      }
    });

    return closest;
  }

  destroy(): void {
    if (this.fetchGem && this.fetchGem.active) {
      delete (this.fetchGem as any).__petFetched;
    }
    this.fetchGem = null;
    this.dashTarget = null;
    this.destroyDashHitZone(); // 리셋 중 돌진이었다면 존 잔존 금지
    super.destroy();
  }
}
