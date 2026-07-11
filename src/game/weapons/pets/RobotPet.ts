import Phaser from 'phaser';
import { PetBase } from './PetBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';
import { EventBus, GameEvents } from '../../utils/EventBus';

type RobotState = 'IDLE' | 'ALERT' | 'TURRET' | 'RETURN' | 'GUARD_BURST';

/**
 * 로봇 장난감 펫: 멈춰 서서 조준 사격하는 경계 터렛 + 플레이어 피격 시 복수 연사 (설계 T1).
 * - PLAYER_DAMAGE 리스너를 생성자에서 구독 → destroy()에서 반드시 off
 *   (resetGame마다 새 WeaponManager가 생기므로 누수 시 리스너가 누적된다).
 * - 사격은 관통 레이저(fireLaser): 머즐 플래시 + 빔 비주얼 + 40px 간격 히트존 체인
 *   (addProjectile, 체인 전체가 같은 __hitMonsters Set을 공유해 몬스터당 1회만 피해).
 */
export class RobotPet extends PetBase {
  id = 'robot_toy';
  name = 'Robot Toy';
  nameKo = '로봇 장난감';
  description = 'Guard turret that avenges the player';
  descriptionKo = '멈춰 서서 레이저 발사! 내가 맞으면 바로 복수해요';
  maxLevel = 8;

  private static readonly DETECT_RANGE = 340;
  private static readonly FIRE_MIN_INTERVAL = 900;
  private static readonly TURRET_NO_ENEMY_EXIT_MS = 3000;
  private static readonly TURRET_PLAYER_DIST_EXIT = 260;
  private static readonly GUARD_AIM_FALLBACK_RANGE = 600;
  private static readonly BURST_SHOT_INTERVAL = 140;
  private static readonly LASER_ZONE_SPACING = 40; // 히트존 간격(px)
  private static readonly LASER_ZONE_LIFESPAN = 150; // 히트존 존속 시간(ms)

  protected get followSlot(): { x: number; y: number } {
    return { x: 46, y: 30 };
  }

  protected get walkAnimKey(): string {
    return 'pet_robot_walk';
  }

  protected get fallbackTextureKey(): string {
    return 'weapon_robot_toy';
  }

  protected get baseScale(): number {
    return 1.0;
  }

  protected levelDescKo: string[] = [
    '공격력 +3',
    '경계 사격 3연발 → 4연발',
    '공격력 +3',
    '레이저 사거리 +80',
    '사격 주기 -0.15초',
    '공격력 +4',
    '공격력 +5 · 경계 준비 6초 → 4초',
  ];

  // 펫 전용 레벨 테이블 (index = level-1)
  private static readonly BURST_COUNT_BY_LEVEL = [3, 3, 4, 4, 4, 4, 4, 4];
  private static readonly GUARD_COOLDOWN_BY_LEVEL = [6000, 6000, 6000, 6000, 6000, 6000, 6000, 4000];

  // === 타이머/상태 (전부 delta 누적) ===
  private alertTimer: number = 0;
  private fireTimer: number = 0;
  private noEnemyTimer: number = 0;
  private guardCooldownTimer: number = 0;
  // GUARD_BURST 진행 상태
  private burstShotsLeft: number = 0;
  private burstShotTimer: number = 0;
  private burstTargetX: number = 0;
  private burstTargetY: number = 0;
  private stateBeforeBurst: RobotState = 'IDLE';

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
    this.baseStats = {
      damage: 10,
      cooldown: 1200, // 사격 주기
      area: 1,
      speed: 420, // 레이저 사거리(px) — getSpeed()를 사거리로 재정의해 사용
      duration: 999999,
      amount: 1,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 3 },
      {},
      { damage: 3 },
      { speed: 80 },
      { cooldown: -150 },
      { damage: 4 },
      { damage: 5 },
    ];

    this.initPet();

    // 복수 사격 트리거 — destroy()에서 반드시 off (리스너 누수 방지)
    EventBus.on(GameEvents.PLAYER_DAMAGE, this.onPlayerDamage, this);
  }

  private getBurstCount(): number {
    return RobotPet.BURST_COUNT_BY_LEVEL[this.level - 1] ?? 3;
  }

  private getGuardCooldown(): number {
    return RobotPet.GUARD_COOLDOWN_BY_LEVEL[this.level - 1] ?? 6000;
  }

  private getFireInterval(): number {
    return Math.max(RobotPet.FIRE_MIN_INTERVAL, this.getCooldown());
  }

  /** PLAYER_DAMAGE → 경계 사격 (쿨 레디 시). 조준은 피격 소스 좌표, 없으면 근접 적 폴백 */
  private onPlayerDamage(payload: { source?: { x: number; y: number } }): void {
    if (!this.sprite || !this.sprite.active) return;
    if (this.petState === 'GUARD_BURST') return;
    if (this.guardCooldownTimer < this.getGuardCooldown()) return;

    let tx: number;
    let ty: number;
    if (payload?.source) {
      tx = payload.source.x;
      ty = payload.source.y;
    } else {
      const fallback = this.findClosestEnemy(RobotPet.GUARD_AIM_FALLBACK_RANGE);
      if (!fallback) return; // 조준할 대상 없음 → 무시
      tx = fallback.x;
      ty = fallback.y;
    }

    this.stateBeforeBurst = this.petState as RobotState;
    this.burstTargetX = tx;
    this.burstTargetY = ty;
    this.burstShotsLeft = this.getBurstCount();
    this.burstShotTimer = RobotPet.BURST_SHOT_INTERVAL; // 첫 발 즉시
    this.petState = 'GUARD_BURST';
    this.showEmote('alert');
    this.applyFacing(tx - this.px);
  }

  protected updateState(delta: number): void {
    this.guardCooldownTimer += delta;

    switch (this.petState as RobotState) {
      case 'IDLE': {
        this.updateIdleFollow(delta);

        const target = this.findClosestEnemy(RobotPet.DETECT_RANGE);
        if (target) {
          this.alertTimer = 0;
          this.petState = 'ALERT';
          this.showEmote('alert');
          this.applyFacing(target.x - this.px);
        }
        break;
      }

      case 'ALERT': {
        this.alertTimer += delta;
        if (this.alertTimer >= PetBase.ALERT_PAUSE) {
          this.fireTimer = this.getFireInterval(); // 진입 즉시 첫 발
          this.noEnemyTimer = 0;
          this.petState = 'TURRET';
        }
        break;
      }

      case 'TURRET': {
        // 정지 사격 — 이동 없음
        const target = this.findClosestEnemy(RobotPet.DETECT_RANGE);

        if (target) {
          this.noEnemyTimer = 0;
          this.applyFacing(target.x - this.px);
          this.fireTimer += delta;
          if (this.fireTimer >= this.getFireInterval()) {
            this.fireTimer = 0;
            this.fireLaser(target.x, target.y, this.getDamage());
          }
        } else {
          this.noEnemyTimer += delta;
        }

        const playerDist = Phaser.Math.Distance.Between(this.px, this.py, this.player.x, this.player.y);
        if (this.noEnemyTimer >= RobotPet.TURRET_NO_ENEMY_EXIT_MS || playerDist > RobotPet.TURRET_PLAYER_DIST_EXIT) {
          this.petState = 'RETURN';
        }
        break;
      }

      case 'GUARD_BURST': {
        // 제자리 연사 (140ms 간격 delta 누적)
        this.burstShotTimer += delta;
        if (this.burstShotTimer >= RobotPet.BURST_SHOT_INTERVAL) {
          this.burstShotTimer = 0;
          this.burstShotsLeft--;
          this.fireLaser(this.burstTargetX, this.burstTargetY, Math.floor(this.getDamage() * 1.5));
          if (this.burstShotsLeft <= 0) {
            this.guardCooldownTimer = 0;
            this.petState = this.stateBeforeBurst === 'GUARD_BURST' ? 'IDLE' : this.stateBeforeBurst;
          }
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
   * 탄환 → 관통 레이저로 교체: 즉발 직선 빔 + 40px 간격 히트존 체인.
   * 체인 전체가 같은 __hitMonsters Set을 공유하므로(엔진 전역 충돌 핸들러 규약),
   * 경로상 몬스터는 관통해도 딱 1번만 피해를 입는다.
   */
  private fireLaser(tx: number, ty: number, damage: number): void {
    const angle = Phaser.Math.Angle.Between(this.px, this.py, tx, ty);
    const area = this.getArea();
    const range = this.getSpeed(); // getSpeed()를 레이저 사거리(px)로 재정의

    // Muzzle flash (기존 유지) — 시각 전용 트윈 허용
    const muzzleX = this.px + Math.cos(angle) * 10 * area;
    const muzzleY = this.py + Math.sin(angle) * 10 * area;
    const flash = this.scene.add.circle(muzzleX, muzzleY, 5 * area, 0xffff00, 0.9);
    flash.setDepth(10);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.6,
      duration: 80,
      onComplete: () => flash.destroy(),
    });

    // 레이저 빔 비주얼: 바깥 글로우 + 안쪽 코어, 120ms 페이드 후 소멸
    const midX = this.px + Math.cos(angle) * range * 0.5;
    const midY = this.py + Math.sin(angle) * range * 0.5;
    const glow = this.scene.add.rectangle(midX, midY, range, 10, 0xffaaaa, 0.35);
    glow.setRotation(angle);
    glow.setDepth(10);
    const beam = this.scene.add.rectangle(midX, midY, range, 4, 0xff5566, 1);
    beam.setRotation(angle);
    beam.setDepth(10);
    this.scene.tweens.add({
      targets: [glow, beam],
      alpha: 0,
      duration: 120,
      onComplete: () => {
        glow.destroy();
        beam.destroy();
      },
    });

    // 히트존 체인: 레이저 경로를 따라 40px 간격 원(반지름 18×area) 배치,
    // 전 존에 damage/pierce/공유 hitSet을 직접 할당 후 addProjectile
    const hitSet = new Set<Phaser.Physics.Arcade.Sprite>();
    const radius = 18 * area;
    const zones: Phaser.GameObjects.Arc[] = [];
    for (let dist = 20; dist <= range; dist += RobotPet.LASER_ZONE_SPACING) {
      const zx = this.px + Math.cos(angle) * dist;
      const zy = this.py + Math.sin(angle) * dist;
      const zone = this.scene.add.circle(zx, zy, radius, 0x000000, 0);
      this.scene.physics.add.existing(zone);
      const body = (zone as unknown as { body: Phaser.Physics.Arcade.Body }).body;
      body.setCircle(radius);

      (zone as any).damage = damage;
      (zone as any).pierce = 999;
      (zone as any).__hitMonsters = hitSet;
      this.scene.addProjectile(zone as any);
      zones.push(zone);
    }

    this.attachLaserImpactEffect(zones);

    // 150ms 후 체인 전체 일괄 소멸 (허공 소멸 아님 — 히트 판정용 짧은 생존)
    this.scene.time.delayedCall(RobotPet.LASER_ZONE_LIFESPAN, () => {
      zones.forEach((zone) => {
        if (zone.active) zone.destroy();
      });
    });
  }

  /** 히트존 체인 공용 임팩트 이펙트: hitSet과 별개의 Set으로 몬스터당 1회만 'hit_small' 재생 */
  private attachLaserImpactEffect(zones: Phaser.GameObjects.Arc[]): void {
    const impactHitSet = new Set<Phaser.Physics.Arcade.Sprite>();
    zones.forEach((zone) => {
      const overlap = this.scene.physics.add.overlap(zone as any, this.scene.getMonsters(), (_z, monster) => {
        const m = monster as Phaser.Physics.Arcade.Sprite;
        if (impactHitSet.has(m)) return;
        impactHitSet.add(m);
        this.playImpact(m.x, m.y, 'hit_small');
      });
      zone.once('destroy', () => overlap.destroy());
    });
  }

  destroy(): void {
    EventBus.off(GameEvents.PLAYER_DAMAGE, this.onPlayerDamage, this);
    super.destroy();
  }
}
