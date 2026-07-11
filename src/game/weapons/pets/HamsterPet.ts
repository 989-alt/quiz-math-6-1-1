import Phaser from 'phaser';
import { PetBase } from './PetBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';
import { XPGem } from '../../entities/XPGem';

type HamsterState = 'IDLE' | 'ALERT' | 'DASH' | 'RETURN' | 'FETCH_GO' | 'FETCH_RETURN';

/**
 * 햄스터 펫: 적에게 몸통 돌진 + 떨어진 수정 배달 (설계 T1).
 * - DASH 피해는 임팩트 순간의 1회성 투명 원 히트존(addProjectile, 150ms 소멸)으로만 —
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

  private static readonly DASH_DETECT_RANGE = 220;
  private static readonly DASH_MIN_COOLDOWN = 1400;
  private static readonly DASH_IMPACT_DIST = 24;
  private static readonly DASH_MAX_MS = 1200;
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
  private fetchGem: XPGem | null = null;
  private fetchTotalTimer: number = 0;
  private fetchNearPlayerTimer: number = 0;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 20,
      cooldown: 2500, // 돌진 쿨
      area: 1,
      speed: 420, // 돌진 속도
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
            this.dashTargetX = target.x;
            this.dashTargetY = target.y;
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
        }
        break;
      }

      case 'DASH': {
        this.dashTimer += delta;

        // 타깃 생존 중엔 좌표 추적, 죽으면 마지막 좌표 유지
        if (this.dashTarget && this.dashTarget.active) {
          this.dashTargetX = this.dashTarget.x;
          this.dashTargetY = this.dashTarget.y;
        }

        const remain = this.moveLinear(this.dashTargetX, this.dashTargetY, this.getSpeed(), delta);

        if (remain <= HamsterPet.DASH_IMPACT_DIST || remain <= 0.5) {
          this.dashImpact(this.dashTargetX, this.dashTargetY);
        } else if (this.dashTimer >= HamsterPet.DASH_MAX_MS) {
          // 세이프티: 제자리 임팩트 후 복귀
          this.dashImpact(this.px, this.py);
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

  /** 돌진 임팩트: 150ms 1회성 투명 원 히트존 (damage||10 폴백 안전 — damage/pierce 명시) */
  private dashImpact(x: number, y: number): void {
    const radius = 34 * this.getArea();
    const zone = this.scene.add.circle(x, y, radius, 0x000000, 0);
    this.scene.physics.add.existing(zone);
    const body = (zone as unknown as { body: Phaser.Physics.Arcade.Body }).body;
    body.setCircle(radius);

    (zone as any).damage = this.getDamage();
    (zone as any).pierce = this.getPierce();
    this.scene.addProjectile(zone as any);

    this.scene.time.delayedCall(150, () => {
      if (zone.active) zone.destroy();
    });

    this.playImpact(x, y, 'hit_small');
    this.scene.fx.poof(x, y);

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
    super.destroy();
  }
}
