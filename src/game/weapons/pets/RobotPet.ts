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
 * - 사격은 기존 RobotToy.robotFire 포팅: 머즐 플래시 + 노란 원 탄환 + addProjectile.
 */
export class RobotPet extends PetBase {
  id = 'robot_toy';
  name = 'Robot Toy';
  nameKo = '로봇 장난감';
  description = 'Guard turret that avenges the player';
  descriptionKo = '멈춰 서서 조준 사격! 내가 맞으면 바로 복수해요';
  maxLevel = 8;

  private static readonly DETECT_RANGE = 340;
  private static readonly FIRE_MIN_INTERVAL = 900;
  private static readonly TURRET_NO_ENEMY_EXIT_MS = 3000;
  private static readonly TURRET_PLAYER_DIST_EXIT = 260;
  private static readonly GUARD_AIM_FALLBACK_RANGE = 600;
  private static readonly BURST_SHOT_INTERVAL = 140;
  private static readonly BULLET_LIFESPAN = 2000;

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
    '탄속 +40',
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
      speed: 330, // 탄속
      duration: 999999,
      amount: 1,
      pierce: 1,
      knockback: 0,
    };
    this.levelUpgrades = [
      { damage: 3 },
      {},
      { damage: 3 },
      { speed: 40 },
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
            this.fireBullet(target.x, target.y, this.getDamage());
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
          this.fireBullet(this.burstTargetX, this.burstTargetY, Math.floor(this.getDamage() * 1.5));
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

  /** 기존 RobotToy.robotFire 포팅: 머즐 플래시 + 노란 원 탄환 (damage/pierce 명시) */
  private fireBullet(tx: number, ty: number, damage: number): void {
    const angle = Phaser.Math.Angle.Between(this.px, this.py, tx, ty);
    const speed = this.getSpeed();
    const area = this.getArea();

    // Muzzle flash (1 frame) — 시각 전용 트윈 허용
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

    const bullet = this.scene.add.circle(this.px, this.py, 4 * area, 0xffe066);
    bullet.setDepth(8);

    this.scene.physics.add.existing(bullet);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    (bullet as any).damage = damage;
    (bullet as any).pierce = this.getPierce();

    this.scene.addProjectile(bullet as any);
    this.attachImpactEffect(bullet as any, 'hit_small');

    this.scene.time.delayedCall(RobotPet.BULLET_LIFESPAN, () => {
      if (bullet.active) bullet.destroy();
    });
  }

  /** 기존 RobotToy.attachImpactEffect 포팅: Set 중복 방지 + 히트 이펙트 */
  private attachImpactEffect(sprite: Phaser.Physics.Arcade.Sprite, kind: string): void {
    const hit = new Set<Phaser.Physics.Arcade.Sprite>();
    const overlap = this.scene.physics.add.overlap(sprite, this.scene.getMonsters(), (_s, monster) => {
      const m = monster as Phaser.Physics.Arcade.Sprite;
      if (hit.has(m)) return;
      hit.add(m);
      this.playImpact(m.x, m.y, kind);
    });
    sprite.once('destroy', () => overlap.destroy());
  }

  destroy(): void {
    EventBus.off(GameEvents.PLAYER_DAMAGE, this.onPlayerDamage, this);
    super.destroy();
  }
}
