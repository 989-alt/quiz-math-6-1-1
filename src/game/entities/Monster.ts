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
}

export class Monster extends Phaser.Physics.Arcade.Sprite {
  public hp: number;
  public maxHp: number;
  public damage: number;
  public speed: number;
  public xpValue: number;
  public isBoss: boolean;
  // 스폰 목표 스케일 — 스트레치류 이펙트(Magnet 등)의 복원 기준.
  // 런타임 scaleX는 스폰 팝/이펙트 트윈과 레이스가 있어 캡처하면 안 됨.
  public baseScale: number;
  private target: Phaser.Physics.Arcade.Sprite | null = null;
  private hpBar: Phaser.GameObjects.Graphics | null = null;
  private shadow: Phaser.GameObjects.Sprite | null = null;
  private wobblePhase: number = Math.random() * Math.PI * 2;
  private telegraphRing: Phaser.GameObjects.Arc | null = null;
  private static readonly TELEGRAPH_INTERVAL = 3500;
  private static readonly TELEGRAPH_DURATION = 500;

  constructor(scene: Phaser.Scene, x: number, y: number, config: MonsterConfig) {
    super(scene, x, y, config.spriteKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.maxHp = config.hp;
    this.hp = config.hp;
    this.damage = config.damage;
    this.speed = config.speed;
    this.xpValue = config.xpValue;
    this.isBoss = config.isBoss || false;

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

  update(): void {
    if (!this.target || !this.active) return;

    // Move towards target
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
    const velocity = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
    velocity.scale(this.speed);

    this.setVelocity(velocity.x, velocity.y);

    // 스프라이트는 정면(카메라) 기준 아트. 보스는 뒤집으면 거울처럼 보여 어색하므로
    // 항상 정면(플레이어를 바라봄) 유지. 일반 몬스터만 이동 방향으로 좌우 반전 + wobble.
    if (!this.isBoss) {
      this.setFlipX(velocity.x < 0);
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
        this.clearTint();
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
        this.scene.tweens.add({
          targets: this,
          alpha: 0,
          scale: this.isBoss ? poppedScale * 0.65 : poppedScale * 0.4,
          duration: this.isBoss ? 420 : 160,
          onComplete: () => {
            this.destroy();
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
