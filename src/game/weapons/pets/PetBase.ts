import Phaser from 'phaser';
import { WeaponBase } from '../WeaponBase';
import type { GameScene } from '../../scenes/GameScene';
import type { Player } from '../../entities/Player';

/**
 * 펫 공통 베이스 (설계 T1) — WeaponBase를 상속하되 attack/cooldown 루프를 봉인하고
 * 자체 상태머신 + 수동 이동(팔로우/방황/복귀)을 update(delta)에서 돌린다.
 *
 * 핵심 불변식:
 *  - 모든 게임플레이 타이머는 delta 누적 필드 (일시정지 시 GameScene.update가
 *    weaponManager.update를 멈추므로 자동 동결). scene.time.now 스케줄링 금지.
 *  - 이동은 물리 velocity 없이 매 프레임 수동 좌표 갱신 (이모트 팝 트윈만 시각 전용 허용).
 *  - 펫 본체 스프라이트는 절대 addProjectile에 등록하지 않는다 (damage||10 폴백 방지).
 */
export abstract class PetBase extends WeaponBase {
  // === 팔로우/방황 상수 ===
  protected static readonly FOLLOW_TIME_CONST = 220; // ms — 지수 팔로우 시간상수
  protected static readonly FOLLOW_MAX_SPEED = 340; // px/s
  protected static readonly SNAP_DISTANCE = 600; // 이 이상 떨어지면 즉시 스냅
  protected static readonly WANDER_RADIUS = 40;
  protected static readonly WANDER_SPEED = 60; // px/s
  protected static readonly WANDER_DWELL_MIN = 600;
  protected static readonly WANDER_DWELL_MAX = 1400;
  protected static readonly IDLE_BEFORE_WANDER = 800; // 플레이어 정지 후 방황 시작까지
  protected static readonly SLEEP_AFTER = 3000; // 플레이어 정지 지속 시 💤 이모트
  protected static readonly SLEEP_EMOTE_COOLDOWN = 4000;
  protected static readonly ALERT_DURATION = 500; // "!" 이모트 시각 길이 (팝+홀드)
  protected static readonly ALERT_PAUSE = 250; // "!" 후 정지 시간 → ENGAGE
  protected static readonly RETURN_SPEED = 220; // px/s
  protected static readonly RETURN_ARRIVE = 30; // 슬롯 복귀 판정 거리
  private static readonly EMOTE_RESHOW_COOLDOWN = 1000; // kind별 재표시 쿨

  // === 서브클래스 계약 (getter라 base 생성자에서도 접근 가능) ===
  protected abstract get followSlot(): { x: number; y: number };
  protected abstract get walkAnimKey(): string;
  /** pet_* strip이 없을 때 쓸 기존 무기 텍스처 키 */
  protected abstract get fallbackTextureKey(): string;
  protected abstract get baseScale(): number;
  /** 레벨업 카드 설명 (index = level-1). getNextUpgradeDescKo가 사용 */
  protected abstract levelDescKo: string[];

  // === 본체 (initPet()에서 생성 — 추상 getter는 base 생성자에서 접근 불가) ===
  protected sprite!: Phaser.GameObjects.Sprite;
  protected shadow: Phaser.GameObjects.Sprite | null = null;
  protected petState: string = 'IDLE';

  // 논리 좌표 (bob 오프셋과 분리 — Player.ts:302-314 "이전 오프셋 제거 후 재계산" 패턴)
  protected px: number = 0;
  protected py: number = 0;

  // === 타이머 (전부 delta 누적) ===
  protected walkTimer: number = 0; // 이동 중 bob 위상
  protected idleTimer: number = 0; // 정지 중 breathe 위상
  private playerIdleTimer: number = 0; // 플레이어 정지 누적 (방황/수면 트리거)
  private wanderDwellTimer: number = 0;
  private wanderDwellTarget: number = 0;
  private wanderTarget: { x: number; y: number } | null = null;
  private wanderDwelling: boolean = false;
  private emoteCooldowns: Record<string, number> = {};

  // 이번 프레임 이동 여부 (bob/breathe 분기)
  protected movedThisFrame: boolean = false;

  // 이모트 (시각 전용 — 팝 트윈 허용)
  private emoteImage: Phaser.GameObjects.Image | null = null;

  constructor(scene: GameScene, player: Player) {
    super(scene, player);
  }

  /**
   * 본체 스프라이트/그림자 생성. 서브클래스 생성자 마지막에 반드시 호출
   * (추상 getter는 TS 규칙상 base 생성자에서 접근 불가 — 서브클래스 super() 이후엔 안전).
   */
  protected initPet(): void {
    const scene = this.scene;

    // 스폰: 반드시 플레이어 위치 + 슬롯 (0,0 금지)
    this.px = this.player.x + this.followSlot.x;
    this.py = this.player.y + this.followSlot.y;

    // 텍스처: pet_* strip → 기존 weapon_* → 로컬 생성 폴백 (전부 없어도 크래시 금지)
    let texKey = this.walkAnimKey;
    if (!scene.textures.exists(texKey)) {
      texKey = this.fallbackTextureKey;
      if (!scene.textures.exists(texKey)) {
        texKey = `pet_fallback_${this.id}`;
        if (!scene.textures.exists(texKey)) {
          const g = scene.make.graphics({ x: 0, y: 0 }, false);
          g.fillStyle(0xffcc66);
          g.fillCircle(12, 12, 12);
          g.generateTexture(texKey, 24, 24);
          g.destroy();
        }
      }
    }

    this.sprite = scene.add.sprite(this.px, this.py, texKey);
    this.sprite.setDepth(9);
    this.sprite.setScale(this.baseScale);
    if (texKey === this.walkAnimKey && scene.anims.exists(this.walkAnimKey)) {
      this.sprite.play(this.walkAnimKey);
    }

    if (scene.textures.exists('shadow_blob')) {
      this.shadow = scene.add.sprite(this.px, this.py, 'shadow_blob');
      this.shadow.setAlpha(0.35);
      this.shadow.setScale(0.7);
      this.shadow.setDepth(8);
    }
  }

  // WeaponBase의 쿨다운 → attack() 루프 봉인 (펫은 상태머신이 전부 담당)
  attack(): void {}

  update(delta: number): void {
    if (!this.sprite || !this.sprite.active) return;

    this.movedThisFrame = false;

    // 이모트 재표시 쿨 감쇠
    for (const k of Object.keys(this.emoteCooldowns)) {
      if (this.emoteCooldowns[k] > 0) this.emoteCooldowns[k] -= delta;
    }

    // 서브클래스 상태머신 (이동 포함)
    this.updateState(delta);

    // 시각 처리: bob/breathe → 스프라이트 좌표 반영 → 그림자/이모트 추종
    this.applyVisuals(delta);
  }

  /** 서브클래스 상태머신 틱. IDLE에서는 this.updateIdleFollow(delta) 위임 권장 */
  protected abstract updateState(delta: number): void;

  // === 이동 헬퍼 ===

  protected slotX(): number {
    return this.player.x + this.followSlot.x;
  }

  protected slotY(): number {
    return this.player.y + this.followSlot.y;
  }

  /** 선형 이동 (속도 px/s). 이동 후 남은 거리 반환. 방향에 따라 flipX 갱신 */
  protected moveLinear(tx: number, ty: number, speed: number, delta: number): number {
    const dx = tx - this.px;
    const dy = ty - this.py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return 0;

    const step = Math.min(dist, (speed * delta) / 1000);
    this.px += (dx / dist) * step;
    this.py += (dy / dist) * step;
    if (step > 0.01) this.movedThisFrame = true;
    this.applyFacing(dx);
    return dist - step;
  }

  /** 지수 팔로우 스텝 (IDLE 팔로우 전용). SNAP_DISTANCE 초과 시 즉시 스냅 */
  private followStep(tx: number, ty: number, delta: number): void {
    const dx = tx - this.px;
    const dy = ty - this.py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > PetBase.SNAP_DISTANCE) {
      this.px = tx;
      this.py = ty;
      return;
    }
    if (dist < 1) return;

    const t = 1 - Math.exp(-delta / PetBase.FOLLOW_TIME_CONST);
    let stepX = dx * t;
    let stepY = dy * t;
    const stepLen = Math.sqrt(stepX * stepX + stepY * stepY);
    const maxStep = (PetBase.FOLLOW_MAX_SPEED * delta) / 1000;
    if (stepLen > maxStep) {
      stepX = (stepX / stepLen) * maxStep;
      stepY = (stepY / stepLen) * maxStep;
    }
    this.px += stepX;
    this.py += stepY;
    if (Math.sqrt(stepX * stepX + stepY * stepY) > 0.15) this.movedThisFrame = true;
    this.applyFacing(dx);
  }

  /** flipX: 목표 dx 기준, ±2px 데드존 */
  protected applyFacing(dx: number): void {
    if (dx < -2) this.sprite.setFlipX(true);
    else if (dx > 2) this.sprite.setFlipX(false);
  }

  /**
   * IDLE 공통 행동: 플레이어 이동 중 → 지수 팔로우 / 정지 → 슬롯 주변 방황 + 💤.
   * 서브클래스 IDLE 분기에서 호출.
   */
  protected updateIdleFollow(delta: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    const playerMoving = !!body && body.velocity.length() >= 5;

    if (playerMoving) {
      this.playerIdleTimer = 0;
      this.wanderTarget = null;
      this.wanderDwelling = false;
      this.followStep(this.slotX(), this.slotY(), delta);
      return;
    }

    this.playerIdleTimer += delta;

    // 정지 직후엔 슬롯으로 계속 수렴 (급정거 시 어색한 즉시 방황 방지)
    if (this.playerIdleTimer < PetBase.IDLE_BEFORE_WANDER) {
      this.followStep(this.slotX(), this.slotY(), delta);
      return;
    }

    // 💤 수면 이모트 (플레이어 장기 정지)
    if (this.playerIdleTimer >= PetBase.SLEEP_AFTER) {
      this.showEmote('sleep');
    }

    // 방황: 슬롯 주변 랜덤 포인트 → 이동 → 체류 → 반복
    if (this.wanderDwelling) {
      this.wanderDwellTimer += delta;
      if (this.wanderDwellTimer >= this.wanderDwellTarget) {
        this.wanderDwelling = false;
        this.wanderTarget = null;
      }
      return;
    }

    if (!this.wanderTarget) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * PetBase.WANDER_RADIUS;
      this.wanderTarget = {
        x: this.slotX() + Math.cos(a) * r,
        y: this.slotY() + Math.sin(a) * r,
      };
    }

    const remain = this.moveLinear(this.wanderTarget.x, this.wanderTarget.y, PetBase.WANDER_SPEED, delta);
    if (remain <= 2) {
      this.wanderDwelling = true;
      this.wanderDwellTimer = 0;
      this.wanderDwellTarget =
        PetBase.WANDER_DWELL_MIN + Math.random() * (PetBase.WANDER_DWELL_MAX - PetBase.WANDER_DWELL_MIN);
    }
  }

  /** RETURN 공통: 슬롯으로 복귀. 도착(RETURN_ARRIVE 내) 시 true */
  protected updateReturn(delta: number): boolean {
    const remain = this.moveLinear(this.slotX(), this.slotY(), PetBase.RETURN_SPEED, delta);
    return remain <= PetBase.RETURN_ARRIVE;
  }

  // === 시각 처리 ===

  private applyVisuals(delta: number): void {
    let bobOffset = 0;

    if (this.movedThisFrame) {
      this.walkTimer += delta;
      this.idleTimer = 0;
      bobOffset = Math.sin(this.walkTimer * 0.010) * 1.5;
      this.sprite.setScale(this.baseScale); // breathe 스케일 원복
    } else {
      this.walkTimer = 0;
      this.idleTimer += delta;
      // breathe: 이전 오프셋 제거 후 재계산 패턴 — scaleY만 재계산 (Player.ts:302-314 참고)
      this.sprite.scaleX = this.baseScale;
      this.sprite.scaleY = this.baseScale * (1 + Math.sin(this.idleTimer * 0.004) * 0.03);
    }

    this.sprite.setPosition(this.px, this.py + bobOffset);

    if (this.shadow) {
      this.shadow.setPosition(this.px, this.py + this.sprite.displayHeight * 0.42);
    }

    if (this.emoteImage && this.emoteImage.active) {
      this.emoteImage.setPosition(this.px, this.py - this.sprite.displayHeight * 0.75);
    }
  }

  /**
   * 머리 위 상태 이모트 (텍스처 없으면 no-op — 에셋 파이프라인과 동시 진행 가드).
   * 팝 트윈은 시각 전용 허용. kind별 재표시 쿨 1000ms (sleep은 4000ms).
   */
  protected showEmote(kind: 'alert' | 'heart' | 'sleep'): void {
    const texKey = `status_emote_${kind}`;
    if (!this.scene.textures.exists(texKey)) return;
    if ((this.emoteCooldowns[kind] ?? 0) > 0) return;
    this.emoteCooldowns[kind] = kind === 'sleep' ? PetBase.SLEEP_EMOTE_COOLDOWN : PetBase.EMOTE_RESHOW_COOLDOWN;

    // 기존 이모트 교체
    this.destroyEmote();

    const img = this.scene.add.image(this.px, this.py - this.sprite.displayHeight * 0.75, texKey);
    img.setDepth(11);
    img.setScale(0.6);
    this.emoteImage = img;

    this.scene.tweens.add({
      targets: img,
      scale: 1.0,
      duration: 120,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(500, () => {
          if (!img.active) return;
          this.scene.tweens.add({
            targets: img,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              if (this.emoteImage === img) this.emoteImage = null;
              img.destroy();
            },
          });
        });
      },
    });
  }

  private destroyEmote(): void {
    if (this.emoteImage) {
      this.scene.tweens.killTweensOf(this.emoteImage);
      this.emoteImage.destroy();
      this.emoteImage = null;
    }
  }

  // 레벨업 카드 문구: 펫 전용 테이블(levelDescKo)로 대체
  getNextUpgradeDescKo(): string | null {
    if (this.isMaxLevel()) return null;
    return this.levelDescKo[this.level - 1] ?? null;
  }

  destroy(): void {
    this.destroyEmote();
    this.shadow?.destroy();
    this.shadow = null;
    this.sprite?.destroy();
  }
}
