import Phaser from 'phaser';
import { MONSTER_WALK_KEYS, BOSS_WALK_KEYS } from '../assetKeys';

const SHADOW_KEY = 'shadow_blob';

export interface MonsterConfig {
  hp: number;
  damage: number;
  speed: number;
  xpValue: number;
  spriteKey: string;
  scale?: number;
  isBoss?: boolean;
  passesObstacles?: boolean; // 지형지물(장애물) 통과 여부 — 유령 등. 미지정 시 종별 기본값
}

// 몬스터별 특성 종류 (spriteKey 접두어로 파생)
type MonsterTrait = 'none' | 'wasp' | 'ghost' | 'boar' | 'bat' | 'crowned';

export class Monster extends Phaser.Physics.Arcade.Sprite {
  public hp: number;
  public maxHp: number;
  public damage: number;
  public speed: number;
  public xpValue: number;
  public isBoss: boolean;
  // 무기 완성 후 등장하는 최종 보스 — 처치 시 게임 클리어 (GameScene에서 세팅)
  public isFinalBoss: boolean = false;
  // 피격 화이트 플래시 후 복원할 상시 틴트 (최종 보스 식별용). null이면 clearTint.
  public persistentTint: number | null = null;
  // 스폰 목표 스케일 — 스트레치류 이펙트(Magnet 등)의 복원 기준.
  // 런타임 scaleX는 스폰 팝/이펙트 트윈과 레이스가 있어 캡처하면 안 됨.
  public baseScale: number;
  // 슬로우 디버프 기준 속도 — 런타임 speed 캡처(중첩 레이스) 대신 이 값 기준으로 감속/복원
  private baseSpeed: number;
  private slowUntil: number = 0;
  private target: Phaser.Physics.Arcade.Sprite | null = null;
  private hpBar: Phaser.GameObjects.Graphics | null = null;
  private shadow: Phaser.GameObjects.Sprite | null = null;
  private wobblePhase: number = Math.random() * Math.PI * 2;
  private telegraphRing: Phaser.GameObjects.Arc | null = null;
  private static readonly TELEGRAPH_INTERVAL = 3500;
  private static readonly TELEGRAPH_DURATION = 500;

  // === 몬스터별 특성(trait) 상태 ===
  // 퀴즈 일시정지 중엔 GameScene.update가 return하여 monster.update도 안 불리므로,
  // scene.time.now(절대시각) 비교 대신 update delta 누적으로 타이머를 관리한다
  // (절대시각 기준이면 일시정지 동안 시간이 흘러 복귀 직후 일제 발동하는 문제).
  public passesObstacles: boolean = false;
  private trait: MonsterTrait = 'none';
  private traitTimer: number = 0; // 특성 사이클 누적 시간(ms)
  private traitPhase: number = 0; // 0=대기 1=텔레그래프(윈드업) 2=발동
  private traitSpeedMul: number = 1; // 이번 프레임 이동 속도 배율
  private traitDir: Phaser.Math.Vector2 | null = null; // 이동 방향 오버라이드 (돌진 고정·움찔 후퇴)
  private zigzagTime: number = 0; // 박쥐 사인파 누적 시간(ms)

  constructor(scene: Phaser.Scene, x: number, y: number, config: MonsterConfig) {
    super(scene, x, y, config.spriteKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.maxHp = config.hp;
    this.hp = config.hp;
    this.damage = config.damage;
    this.speed = config.speed;
    this.baseSpeed = config.speed;
    this.xpValue = config.xpValue;
    this.isBoss = config.isBoss || false;

    // 몬스터별 특성 파생 (spriteKey 접두어로 종 판별)
    this.trait = Monster.deriveTrait(config.spriteKey);
    // 유령은 기본적으로 지형지물 통과 (config로 명시 오버라이드 가능)
    this.passesObstacles = config.passesObstacles ?? this.trait === 'ghost';
    if (this.trait === 'ghost') {
      this.setAlpha(0.65); // 반투명으로 통과 능력을 시각적으로 표시
    }

    const finalScale = config.scale || 1;
    this.baseScale = finalScale;

    // walk 루프 재생 (Phase 4에서 상태머신으로 확장). anim 키 == 텍스처 키.
    if (config.spriteKey && this.scene.anims.exists(config.spriteKey)) {
      this.play(config.spriteKey);
    }

    // Hitbox를 sprite 시각 영역의 50%로 축소하고 중앙 정렬 (투명 padding 충돌 방지)
    const body = this.body as Phaser.Physics.Arcade.Body;
    const hitboxRatio = 0.5;
    const bodyWidth = this.width * hitboxRatio;
    const bodyHeight = this.height * hitboxRatio;
    body.setSize(bodyWidth, bodyHeight);
    body.setOffset(
      (this.width - bodyWidth) / 2,
      (this.height - bodyHeight) / 2
    );

    this.setDepth(5);

    // 스폰: 그림자 먼저 → 팝업 스케일 (설계 §3.2)
    this.spawnShadow(finalScale);
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: finalScale,
      duration: 150,
      ease: 'Back.easeOut',
    });

    // Create HP bar for bosses
    if (this.isBoss) {
      this.createHpBar();
      // setScale(0) 직후라 displayWidth/Height가 아직 0 — 네이티브 크기 × 목표 scale로 계산
      this.telegraphRing = scene.add.circle(x, y, Math.max(this.width, this.height) * finalScale * 0.6, 0xff2222, 0);
      this.telegraphRing.setStrokeStyle(3, 0xff2222, 0);
      this.telegraphRing.setDepth(this.depth - 1);
    }
  }

  private spawnShadow(finalScale: number): void {
    if (!this.scene.textures.exists(SHADOW_KEY)) {
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x000000, 0.3);
      g.fillEllipse(16, 8, 32, 16);
      g.generateTexture(SHADOW_KEY, 32, 16);
      g.destroy();
    }
    this.shadow = this.scene.add.sprite(this.x, this.y + this.height * finalScale * 0.4, SHADOW_KEY);
    this.shadow.setScale(finalScale * (this.isBoss ? 1.6 : 0.9));
    this.shadow.setAlpha(0.4);
    this.shadow.setDepth(this.depth - 1);
  }

  private createHpBar(): void {
    this.hpBar = this.scene.add.graphics();
    this.hpBar.setDepth(6);
    this.updateHpBar();
  }

  private updateHpBar(): void {
    if (!this.hpBar || !this.active) return;

    this.hpBar.clear();
    const barWidth = 60;
    const barHeight = 6;
    const x = this.x - barWidth / 2;
    const y = this.y - this.displayHeight / 2 - 10;

    // Background
    this.hpBar.fillStyle(0x000000, 0.7);
    this.hpBar.fillRect(x, y, barWidth, barHeight);

    // HP fill
    const hpPercent = this.hp / this.maxHp;
    const fillColor = hpPercent > 0.5 ? 0x00ff00 : hpPercent > 0.25 ? 0xffff00 : 0xff0000;
    this.hpBar.fillStyle(fillColor, 1);
    this.hpBar.fillRect(x + 1, y + 1, (barWidth - 2) * hpPercent, barHeight - 2);
  }

  setTarget(target: Phaser.Physics.Arcade.Sprite): void {
    this.target = target;
  }

  // 슬로우 디버프 (눈덩이·늪 존 등): baseSpeed 기준 감속, 만료 시 update()에서 자동 복원.
  // 중첩 적용 시 더 강한 감속과 더 긴 지속을 유지한다.
  applySlow(factor: number, durationMs: number): void {
    if (!this.active) return;
    this.speed = Math.min(this.speed, this.baseSpeed * factor);
    this.slowUntil = Math.max(this.slowUntil, this.scene.time.now + durationMs);
  }

  update(delta: number = 16.7): void {
    if (!this.target || !this.active) return;

    // 슬로우 만료 복원
    if (this.slowUntil > 0 && this.scene.time.now > this.slowUntil) {
      this.speed = this.baseSpeed;
      this.slowUntil = 0;
    }

    // 몬스터별 특성 갱신 (traitSpeedMul / traitDir 결정)
    this.updateTrait(delta);

    // Move towards target (특성이 방향을 고정/오버라이드하면 그 방향 사용)
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
    const velocity = this.traitDir
      ? this.traitDir.clone()
      : new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
    velocity.scale(this.speed * this.traitSpeedMul);

    // 박쥐: 진행 방향에 수직인 사인파 오프셋으로 지그재그 비행
    if (this.trait === 'bat') {
      this.zigzagTime += delta;
      const sway = Math.sin(this.zigzagTime * 0.006) * this.speed * 0.7;
      velocity.x += -Math.sin(angle) * sway;
      velocity.y += Math.cos(angle) * sway;
    }

    this.setVelocity(velocity.x, velocity.y);

    // 스프라이트는 정면(카메라) 기준 아트. 보스는 뒤집으면 거울처럼 보여 어색하므로
    // 항상 정면(플레이어를 바라봄) 유지. 일반 몬스터만 이동 방향으로 좌우 반전 + wobble.
    if (!this.isBoss) {
      // 정지 상태(멧돼지 발구르기 등)에선 특성 연출의 flip을 덮어쓰지 않음
      if (Math.abs(velocity.x) > 0.5) {
        this.setFlipX(velocity.x < 0);
      }
      this.updateWobble();
    }

    if (this.shadow) {
      this.shadow.setPosition(this.x, this.y + this.displayHeight * 0.4);
    }

    // Update HP bar position for bosses
    if (this.isBoss && this.hpBar) {
      this.updateHpBar();
    }

    // 보스 공격 전 텔레그래프 펄스 (설계 §3.2)
    if (this.isBoss && this.telegraphRing) {
      this.updateTelegraph();
    }
  }

  // spriteKey 접두어로 몬스터 종 판별 (보스 키는 'boss_' 접두라 매칭되지 않음)
  private static deriveTrait(spriteKey: string): MonsterTrait {
    if (!spriteKey) return 'none';
    if (spriteKey.startsWith('wasp')) return 'wasp';
    if (spriteKey.startsWith('ghost')) return 'ghost';
    if (spriteKey.startsWith('boar')) return 'boar';
    if (spriteKey.startsWith('bat')) return 'bat';
    if (spriteKey.startsWith('elite_crowned')) return 'crowned';
    return 'none';
  }

  // 몬스터별 특성 상태머신 — delta 누적 타이머라 퀴즈 일시정지 중엔 자동 동결됨
  private updateTrait(delta: number): void {
    if (this.trait === 'ghost') {
      // 유령: 상시 저속(×0.6) + 장애물 통과(콜라이더 processCallback에서 처리)
      this.traitSpeedMul = 0.6;
      return;
    }
    if (this.trait === 'none' || this.trait === 'bat') {
      // 박쥐의 사인파는 update()의 이동 블록에서 처리 (여기선 배율만 기본값)
      this.traitSpeedMul = 1;
      return;
    }

    this.traitTimer += delta;

    if (this.trait === 'wasp') {
      // 벌: 상시 고속(×1.45) + 2.5s마다 [0.25s 뒤로 움찔(윈드업) → 0.8s간 ×1.7 대시]
      const BASE = 1.45;
      const WAIT = 2500;
      const WINDUP = 250;
      const DASH = 800;
      if (this.traitTimer < WAIT) {
        this.traitSpeedMul = BASE;
        this.traitDir = null;
      } else if (this.traitTimer < WAIT + WINDUP) {
        // 윈드업 텔레그래프: 플레이어 반대쪽으로 살짝 물러남
        if (this.target) {
          const back = Phaser.Math.Angle.Between(this.target.x, this.target.y, this.x, this.y);
          this.traitDir = new Phaser.Math.Vector2(Math.cos(back), Math.sin(back));
        }
        this.traitSpeedMul = 0.5;
      } else if (this.traitTimer < WAIT + WINDUP + DASH) {
        // 대시: 플레이어 방향 유도 유지 + 순간 가속
        this.traitDir = null;
        this.traitSpeedMul = BASE * 1.7;
      } else {
        this.traitTimer = 0;
      }
      return;
    }

    if (this.trait === 'boar') {
      // 멧돼지: 3.5s마다 [0.4s 제자리 발구르기 텔레그래프 → 1s간 ×2.2 직선 돌진(방향 고정, 유도 없음)]
      const WAIT = 3500;
      const STOMP = 400;
      const CHARGE = 1000;
      if (this.traitTimer < WAIT) {
        if (this.traitPhase !== 0) {
          this.traitPhase = 0;
          this.traitDir = null;
        }
        this.traitSpeedMul = 1;
      } else if (this.traitTimer < WAIT + STOMP) {
        if (this.traitPhase !== 1) {
          this.traitPhase = 1;
          this.setTint(0xffb0b0); // 발구르기 텔레그래프 (붉은 기)
        }
        this.traitSpeedMul = 0;
        // 제자리 발구르기: 좌우로 빠르게 흔들리는 연출
        this.setFlipX(Math.floor(this.traitTimer / 100) % 2 === 0);
      } else if (this.traitTimer < WAIT + STOMP + CHARGE) {
        if (this.traitPhase !== 2) {
          this.traitPhase = 2;
          this.clearTint();
          if (this.target) {
            // 돌진 시작 시점의 플레이어 방향으로 고정 (돌진 중 유도 안 함)
            const a = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
            this.traitDir = new Phaser.Math.Vector2(Math.cos(a), Math.sin(a));
          }
        }
        this.traitSpeedMul = 2.2;
      } else {
        this.traitTimer = 0;
        this.traitPhase = 0;
        this.traitDir = null;
        this.traitSpeedMul = 1;
      }
      return;
    }

    if (this.trait === 'crowned') {
      // 왕관 슬라임: 7s마다 주변에 일반 슬라임 1기 소환 (씬 경유 — 40기 상한은 씬에서 체크)
      const SUMMON_INTERVAL = 7000;
      this.traitSpeedMul = 1;
      if (this.traitTimer >= SUMMON_INTERVAL) {
        this.traitTimer = 0;
        const ox = (Math.random() - 0.5) * 120;
        const oy = (Math.random() - 0.5) * 120;
        (this.scene as any).spawnMinion?.(this.x + ox, this.y + oy);
      }
      return;
    }
  }

  // 공용 몬스터 wobble: 회전 ±4°, 개체별 위상차 (설계 §3.2 — 물량이어도 살아 움직이는 느낌)
  private updateWobble(): void {
    const wobble = Phaser.Math.DegToRad(4) * Math.sin(this.scene.time.now * 0.0078 + this.wobblePhase);
    this.setRotation(wobble);
  }

  private updateTelegraph(): void {
    if (!this.telegraphRing) return;
    this.telegraphRing.setPosition(this.x, this.y);
    const cyclePos = this.scene.time.now % Monster.TELEGRAPH_INTERVAL;
    if (cyclePos < Monster.TELEGRAPH_DURATION) {
      const t = cyclePos / Monster.TELEGRAPH_DURATION;
      const pulse = Math.abs(Math.sin(t * Math.PI * 3));
      this.telegraphRing.setStrokeStyle(3, 0xff2222, pulse);
    } else {
      this.telegraphRing.setStrokeStyle(3, 0xff2222, 0);
    }
  }

  takeDamage(amount: number): boolean {
    // 이미 죽음 처리 중이거나 비활성 상태면 추가 데미지 무시 (중복 호출 차단)
    if (!this.active || this.hp <= 0) {
      return false;
    }

    this.hp -= amount;

    // 1) 화이트 tintFill 히트 플래시 (설계 §3.2)
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) {
        // 상시 틴트(최종 보스)가 있으면 복원, 없으면 틴트 해제
        if (this.persistentTint !== null) this.setTint(this.persistentTint);
        else this.clearTint();
      }
    });

    // 2) 데미지 숫자 floating text
    this.spawnDamageNumber(Math.round(amount));

    // 3) hit_spark 이펙트
    (this.scene as any).fx?.hit(this.x, this.y, this.isBoss ? 'large' : 'small');

    // 4) SFX
    (this.scene as any).playSfx?.('sfx_monster_hit', this.isBoss ? 0.35 : 0.22);

    // Knockback (less for bosses, 기존 유지)
    if (this.target) {
      const angle = Phaser.Math.Angle.Between(this.target.x, this.target.y, this.x, this.y);
      const knockback = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
      knockback.scale(this.isBoss ? 30 : 100);
      this.setVelocity(knockback.x, knockback.y);
    }

    // 5) 보스 히트스톱 (~30ms 프리즈, 타격감 강조)
    if (this.isBoss) {
      this.triggerHitStop(30);
    }

    // Update HP bar
    if (this.isBoss && this.hpBar) {
      this.updateHpBar();
    }

    if (this.hp <= 0) {
      this.die();
      return true;
    }

    return false;
  }

  private spawnDamageNumber(amount: number): void {
    const offsetX = (Math.random() - 0.5) * 24;
    const startY = this.y - this.displayHeight / 2 - 4;

    const text = this.scene.add.text(
      this.x + offsetX,
      startY,
      `-${amount}`,
      {
        fontFamily: 'Arial, sans-serif',
        fontSize: this.isBoss ? '20px' : '15px',
        fontStyle: 'bold',
        color: this.isBoss ? '#fca5a5' : '#fbbf24',
        stroke: '#000000',
        strokeThickness: 3,
      }
    );
    text.setOrigin(0.5);
    text.setDepth(20);

    this.scene.tweens.add({
      targets: text,
      y: startY - 32,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        text.destroy();
      },
    });
  }

  // 히트스톱: 물리 시뮬레이션을 짧게 정지해 타격 임팩트를 강조 (설계 §3.2 보스 전용)
  private triggerHitStop(ms: number): void {
    const world = this.scene.physics.world;
    if (world.isPaused) return; // 퀴즈/레벨업으로 이미 일시정지 중이면 개입하지 않음
    world.isPaused = true;
    this.scene.time.delayedCall(ms, () => {
      // 히트스톱 대기 중 퀴즈가 열려 physics가 별도로 일시정지됐다면 그 상태를 유지
      if (!this.scene || (this.scene as any).isGamePaused?.()) return;
      world.isPaused = false;
    });
  }

  // 처치 슬로모: 벽시계 기준 ms로 정확히 복구 (Phaser timeScale은 delayedCall도 같이
  // 느려지므로 window.setTimeout으로 되돌린다)
  private triggerDeathSlowMo(ms: number): void {
    const time = this.scene.time;
    const physicsWorld = this.scene.physics.world;
    const anims = this.scene.anims;
    time.timeScale = 0.3;
    physicsWorld.timeScale = 0.3;
    anims.globalTimeScale = 0.3;
    window.setTimeout(() => {
      time.timeScale = 1;
      physicsWorld.timeScale = 1;
      anims.globalTimeScale = 1;
    }, ms);
  }

  private die(): void {
    // 즉시 비활성화 + 물리 바디 OFF (페이드 중에 다시 충돌·중복 처치되는 것 방지)
    this.setActive(false);
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = false;
    }

    // 처치 SFX (보스는 더 크게)
    (this.scene as any).playSfx?.('sfx_monster_die', this.isBoss ? 0.55 : 0.3);

    // Destroy HP bar / shadow / telegraph ring
    if (this.hpBar) {
      this.hpBar.destroy();
      this.hpBar = null;
    }
    if (this.shadow) {
      this.shadow.destroy();
      this.shadow = null;
    }
    if (this.telegraphRing) {
      this.telegraphRing.destroy();
      this.telegraphRing = null;
    }

    // death_poof 이펙트
    (this.scene as any).fx?.poof(this.x, this.y);

    if (this.isBoss) {
      this.triggerDeathSlowMo(200);
    }

    // Death effect - 스케일 팝 후 페이드
    const poppedScale = this.scale * 1.2;
    this.scene.tweens.add({
      targets: this,
      scale: poppedScale,
      duration: 80,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // 리셋(monsters.clear) 등으로 트윈 완료 전에 파괴되면 this.scene이 undefined —
        // 여기서 예외가 나면 Phaser RAF 체인이 끊겨 게임 전체가 프리즈된다.
        if (!this.scene) return;
        this.scene.tweens.add({
          targets: this,
          alpha: 0,
          scale: this.isBoss ? poppedScale * 0.65 : poppedScale * 0.4,
          duration: this.isBoss ? 420 : 160,
          onComplete: () => {
            if (this.scene) this.destroy();
          },
        });
      },
    });
  }

  destroy(fromScene?: boolean): void {
    if (this.hpBar) {
      this.hpBar.destroy();
      this.hpBar = null;
    }
    if (this.shadow) {
      this.shadow.destroy();
      this.shadow = null;
    }
    if (this.telegraphRing) {
      this.telegraphRing.destroy();
      this.telegraphRing = null;
    }
    super.destroy(fromScene);
  }
}

// 순차 로테이션 스폰 순서 — 한 세트(15종) 안에서 약한 종 → 강한 종 순으로 등장.
// 한 세트를 다 돌면 세트 번호가 올라가며 전체 스탯이 강해진다 (사용자 확정 진행 방식).
const ROTATION_ORDER = [
  'slime_green_walk', 'slime_blue_walk', 'bat_walk', 'crow_walk', 'slime_red_walk',
  'fox_walk', 'wasp_walk', 'wolf_walk', 'ghost_walk', 'boar_walk',
  'badger_walk', 'slime_elite_walk', 'elite_mage_walk', 'elite_knight_walk', 'elite_crowned_walk',
] as const;

export const ROTATION_LENGTH = ROTATION_ORDER.length;

// 같은 종이 연속으로 몇 번 등장한 후 다음 종으로 넘어가는지 — 이게 커야
// 초반에 약한 몬스터 구간이 실제로 체감된다 (사용자 피드백: 처음부터 다종 등장 방지).
// 첫 보스 도달 시점을 약 3분으로 맞추기 위한 값 (아래 export function 주석의 계산 참고).
export const SPAWNS_PER_TYPE = 6;

// 한 세트(로스터 15종 완주)에 필요한 총 스폰 수 — GameScene의 "세트 완주 → wave++" 판정 기준
export const FULL_ROTATION_LENGTH = SPAWNS_PER_TYPE * ROTATION_LENGTH;

// 종별 개성 배율 (특성 시스템과 짝: 벌/박쥐=빠르고 약함, 오소리/기사=탱커, 왕관=소환 엘리트)
const TYPE_MODS: Record<string, { hp?: number; speed?: number; damage?: number; xp?: number; scale?: number }> = {
  slime_green_walk: {},
  slime_blue_walk: { hp: 1.15 },
  slime_red_walk: { hp: 0.9, damage: 1.25 },
  bat_walk: { hp: 0.5, speed: 1.45 },
  crow_walk: { hp: 0.6, speed: 1.35 },
  fox_walk: { hp: 0.8, speed: 1.25 },
  wasp_walk: { hp: 0.45, speed: 1.15, damage: 0.8 }, // 특성이 이미 ×1.45 가속 + 대시
  wolf_walk: { hp: 0.95, speed: 1.35, damage: 1.2 },
  ghost_walk: { hp: 1.1, damage: 1.1 }, // 특성이 저속(×0.6)·지형 통과
  boar_walk: { hp: 1.6, speed: 0.9, damage: 1.4, scale: 1.1 },
  badger_walk: { hp: 2.2, speed: 0.6, damage: 1.5, xp: 2, scale: 1.2 },
  slime_elite_walk: { hp: 1.8, xp: 2, scale: 1.15 },
  elite_mage_walk: { hp: 1.4, xp: 2 },
  elite_knight_walk: { hp: 2.5, speed: 0.8, damage: 1.5, xp: 2, scale: 1.2 },
  elite_crowned_walk: { hp: 2.8, xp: 3, scale: 1.25 }, // 특성: 슬라임 소환
};

// 순차 로테이션 스폰용 config — 같은 종이 SPAWNS_PER_TYPE번 연속 등장한 뒤 다음 종으로 넘어가고,
// 전 로스터(15종)를 다 돌면 세트가 올라간다.
//
// [첫 보스 도달 시각 계산 — GameScene.updateMonsterSpawning의 spawnInterval = max(200, 1000 - wave*50)]
// 세트 1(wave=1, interval=950ms) 90스폰 + 세트 2(wave=2, interval=900ms) 90스폰 후
// wave=3에서 isBossWave(3)=true → 보스 즉시 스폰.
// 90*950 + 90*900 = 85500 + 81000 = 166500ms ≈ 166.5초(2분46초) — 목표 3분 ±30초(150~210초) 이내.
export function getMonsterConfigForRotation(spawnIndex: number): MonsterConfig {
  const typeIndex = Math.floor(spawnIndex / SPAWNS_PER_TYPE) % ROTATION_LENGTH;
  const spriteKey = ROTATION_ORDER[typeIndex];
  const set = Math.floor(spawnIndex / FULL_ROTATION_LENGTH) + 1; // 세트 번호 (1부터)
  const mod = TYPE_MODS[spriteKey] ?? {};

  // 세트 기반 스케일링 (선형 + 완만한 2차)
  const baseHp = Math.floor(15 + set * 8 + set * set * 0.6);
  const baseDamage = 5 + Math.floor(set * 0.8);
  const baseSpeed = 60 + Math.min(set * 3, 45);
  const baseXp = 1 + Math.floor(set / 2);

  return {
    hp: Math.max(1, Math.floor(baseHp * (mod.hp ?? 1))),
    damage: Math.max(1, Math.floor(baseDamage * (mod.damage ?? 1))),
    speed: baseSpeed * (mod.speed ?? 1),
    xpValue: Math.max(1, Math.floor(baseXp * (mod.xp ?? 1))),
    spriteKey,
    scale: mod.scale ?? 1,
  };
}

// Get monster config based on wave number
export function getMonsterConfigForWave(wave: number): MonsterConfig {
  // Select monster sprite based on wave (cycles through 15 monster walk sheets)
  const monsterIndex = (wave - 1) % MONSTER_WALK_KEYS.length;
  const spriteKey = MONSTER_WALK_KEYS[monsterIndex];

  // Base stats — 가파른 스케일링 (선형 + 2차)
  const baseHp = Math.floor(15 + wave * 6 + wave * wave * 0.4);
  const baseDamage = 5 + Math.floor(wave / 2);
  const baseSpeed = 60 + Math.min(wave * 2, 40);
  const baseXp = 1 + Math.floor(wave / 3);

  // Monster variants based on wave phase — 격차 확대
  const wavePhase = wave % 3;

  if (wavePhase === 0) {
    // 매 3웨이브: 탱커 (HP 3배, 매우 느림)
    return {
      hp: Math.floor(baseHp * 3),
      damage: Math.floor(baseDamage * 1.8),
      speed: baseSpeed * 0.55,
      xpValue: baseXp * 3,
      spriteKey,
      scale: 1.3,
    };
  } else if (wavePhase === 2) {
    // 보스 직전: 빠른 약한 (HP 0.4배, 빠름)
    return {
      hp: Math.max(1, Math.floor(baseHp * 0.4)),
      damage: Math.floor(baseDamage * 0.7),
      speed: baseSpeed * 1.5,
      xpValue: baseXp,
      spriteKey,
      scale: 0.8,
    };
  } else {
    // 일반 웨이브: 균형형
    return {
      hp: baseHp,
      damage: baseDamage,
      speed: baseSpeed,
      xpValue: baseXp,
      spriteKey,
      scale: 1.0,
    };
  }
}

// Get boss config based on wave number
export function getBossConfigForWave(wave: number): MonsterConfig {
  // Boss appears every 3 waves, select boss sprite (cycles through 5 boss walk sheets)
  const bossIndex = Math.floor(wave / 3) % BOSS_WALK_KEYS.length;
  const spriteKey = BOSS_WALK_KEYS[bossIndex];

  // Boss stats — 가파른 스케일링
  const bossLevel = Math.floor(wave / 3);
  const baseHp = Math.floor(300 + bossLevel * 200 + bossLevel * bossLevel * 30);
  const baseDamage = 25 + bossLevel * 8;
  const baseSpeed = 40 + Math.min(bossLevel * 3, 30);
  const baseXp = 30 + bossLevel * 15;

  return {
    hp: baseHp,
    damage: baseDamage,
    speed: baseSpeed,
    xpValue: baseXp,
    spriteKey,
    scale: 1.4, // Bosses are larger (native ≈100–128px)
    isBoss: true,
  };
}

// Check if current wave is a boss wave
export function isBossWave(wave: number): boolean {
  return wave > 0 && wave % 3 === 0;
}

// Legacy monster types (kept for compatibility)
export const MonsterTypes: Record<string, MonsterConfig> = {
  basic: {
    hp: 10,
    damage: 5,
    speed: 60,
    xpValue: 1,
    spriteKey: MONSTER_WALK_KEYS[0],
    scale: 1.0,
  },
  fast: {
    hp: 5,
    damage: 3,
    speed: 100,
    xpValue: 1,
    spriteKey: MONSTER_WALK_KEYS[4],
    scale: 0.8,
  },
  tank: {
    hp: 30,
    damage: 10,
    speed: 40,
    xpValue: 3,
    spriteKey: MONSTER_WALK_KEYS[8],
    scale: 1.3,
  },
  boss: {
    hp: 200,
    damage: 20,
    speed: 50,
    xpValue: 20,
    spriteKey: BOSS_WALK_KEYS[0],
    scale: 1.4,
    isBoss: true,
  },
};
