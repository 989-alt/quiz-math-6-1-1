import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { EventBus, GameEvents } from '../utils/EventBus';
import { HERO_IDLE_KEY } from '../assetKeys';

// 히어로 상태머신 애니메이션 키 (설계 §3.1). idle/walk/death는 매니페스트 strip →
// BootScene.registerStripAnimations()가 자동 등록. hurt는 1프레임 static 텍스처(single)라
// anim이 아니라 텍스처 스왑 + tintFill로 표현한다.
const HERO_WALK_KEY = 'hero_walk';
const HERO_HURT_KEY = 'hero_hurt';
const HERO_DEATH_KEY = 'hero_death';
const SHADOW_KEY = 'shadow_blob';
const BASE_SCALE = 1.3;

type AnimState = 'idle' | 'walk' | 'hurt' | 'dead';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  public currentHp: number;
  public maxHp: number;
  public moveSpeed: number;
  public isInvincible: boolean = false;
  public pickupRange: number;

  // Stats modifiers
  public damageMultiplier: number = 1;
  public areaMultiplier: number = 1;
  public speedMultiplier: number = 1;
  public projectileSpeedMultiplier: number = 1;
  public durationMultiplier: number = 1;
  public cooldownMultiplier: number = 1;
  public amountBonus: number = 0;
  public armor: number = 0;
  public hpRegen: number = 0;
  public luck: number = 0;
  public growth: number = 0;
  public magnetRange: number = 1;
  public revivals: number = 0;

  // Mobile joystick input
  private joystickVector: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);

  // 상태머신 (설계 §3.1)
  private animState: AnimState = 'idle';
  private hurtUntil: number = 0;
  private isMoving: boolean = false;
  private shadow!: Phaser.GameObjects.Sprite;
  private bobOffset: number = 0;
  private walkTimer: number = 0;
  private recoilX: number = 0;
  private recoilY: number = 0;
  private appliedRecoilX: number = 0;
  private appliedRecoilY: number = 0;
  private squashTween?: Phaser.Tweens.Tween;
  private dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private facingLeft: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Native-size pixel-art hero (Phase 3C); no more 1024px 0.1-scale hack.
    super(scene, x, y, HERO_IDLE_KEY);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 히어로가 화면에서 잘 읽히도록 native(≈48×68px) 대비 약간 확대
    this.setScale(BASE_SCALE);

    // idle 루프 재생 (Phase 4에서 상태머신으로 확장)
    if (scene.anims.exists(HERO_IDLE_KEY)) {
      this.play(HERO_IDLE_KEY);
    }

    // walk 애니메이션 4프레임마다 먼지 퍼프 (설계 §3.1 코드 마이크로 모션)
    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, (anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if (anim.key === HERO_WALK_KEY && frame.index % 4 === 0) {
        this.spawnDustPuff();
      }
    });

    // Hitbox를 sprite 시각 영역의 40%로 축소하고 중앙 정렬 (투명 padding 충돌 방지)
    const body = this.body as Phaser.Physics.Arcade.Body;
    const hitboxRatio = 0.4;
    const bodyWidth = this.width * hitboxRatio;
    const bodyHeight = this.height * hitboxRatio;
    body.setSize(bodyWidth, bodyHeight);
    body.setOffset(
      (this.width - bodyWidth) / 2,
      (this.height - bodyHeight) / 2
    );

    this.setCollideWorldBounds(false);
    this.setDepth(10);

    // 그림자/먼지는 this.depth 기준 상대 depth를 쓰므로 반드시 setDepth(10) 이후에 생성
    // (이전엔 depth 0일 때 생성돼 -1이 되어 장식물·젬·몬스터에 가려졌음)
    this.setupShadow(scene, x, y);
    this.setupDustEmitter(scene);

    // Initialize stats
    this.maxHp = GAME_CONFIG.player.maxHp;
    this.currentHp = this.maxHp;
    this.moveSpeed = GAME_CONFIG.player.speed;
    this.pickupRange = GAME_CONFIG.player.pickupRange;

    // Setup input
    this.setupInput();

    // Listen for joystick input from React
    EventBus.on('joystick-move', this.onJoystickMove, this);
  }

  private setupInput(): void {
    if (this.scene.input.keyboard) {
      this.cursors = this.scene.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }
  }

  private onJoystickMove(data: { x: number; y: number }): void {
    this.joystickVector.set(data.x, data.y);
  }

  private setupShadow(scene: Phaser.Scene, x: number, y: number): void {
    if (!scene.textures.exists(SHADOW_KEY)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(16, 8, 32, 16);
      g.generateTexture(SHADOW_KEY, 32, 16);
      g.destroy();
    }
    this.shadow = scene.add.sprite(x, y, SHADOW_KEY);
    this.shadow.setAlpha(0.5);
    this.shadow.setDepth(this.depth - 1);
  }

  // 걷기 먼지 퍼프용 최소 파티클 이미터 (전용 fx 시트가 없어 로컬 텍스처로 생성)
  private setupDustEmitter(scene: Phaser.Scene): void {
    const key = 'fx_dust_puff_local';
    if (!scene.textures.exists(key)) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xd8c9a3, 0.8);
      g.fillCircle(4, 4, 4);
      g.generateTexture(key, 8, 8);
      g.destroy();
    }
    this.dustEmitter = scene.add.particles(0, 0, key, {
      lifespan: 300,
      speed: { min: 10, max: 30 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.6, end: 0 },
      quantity: 0,
      emitting: false,
    });
    this.dustEmitter.setDepth(this.depth - 1);
  }

  private spawnDustPuff(): void {
    this.dustEmitter?.explode(2, this.x, this.y + this.height * 0.42);
  }

  update(): void {
    this.handleMovement();
    this.handleRegen();
    this.updateAnimState();
    this.applyFacing();
    this.updateRecoilOffset();
    this.updateShadow();
  }

  // hero_walk_strip.png가 hero_idle_strip.png와 반대 방향(좌우)으로 생성되어 있어,
  // walk 상태일 때만 좌우 반전을 뒤집어 실제 이동 방향과 일치시킨다.
  private applyFacing(): void {
    const walkArtIsMirrored = this.animState === 'walk';
    this.setFlipX(walkArtIsMirrored ? !this.facingLeft : this.facingLeft);
  }

  private handleMovement(): void {
    let velocityX = 0;
    let velocityY = 0;

    // Keyboard input
    if (this.scene.input.keyboard) {
      if (this.cursors.left.isDown || this.wasd.A.isDown) {
        velocityX = -1;
      } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
        velocityX = 1;
      }

      if (this.cursors.up.isDown || this.wasd.W.isDown) {
        velocityY = -1;
      } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
        velocityY = 1;
      }
    }

    // Joystick input (override if present)
    if (this.joystickVector.length() > 0.1) {
      velocityX = this.joystickVector.x;
      velocityY = this.joystickVector.y;
    }

    // Normalize and apply speed
    const velocity = new Phaser.Math.Vector2(velocityX, velocityY);
    if (velocity.length() > 0) {
      velocity.normalize();
      this.setVelocity(
        velocity.x * this.moveSpeed * this.speedMultiplier,
        velocity.y * this.moveSpeed * this.speedMultiplier
      );

      // Flip sprite based on direction (실제 좌우 반전은 applyFacing()에서 적용)
      if (velocity.x < 0) {
        this.facingLeft = true;
      } else if (velocity.x > 0) {
        this.facingLeft = false;
      }

      this.isMoving = true;
    } else {
      this.setVelocity(0, 0);
      this.isMoving = false;
    }
  }

  // 상태머신 전이 (설계 §3.1): velocity>0 → walk, HP 0 → dead(die()에서 처리),
  // 피격 → hurt(120ms 후 원래 상태로 자동 복귀)
  private updateAnimState(): void {
    if (this.animState === 'dead') return;

    if (this.animState === 'hurt') {
      if (this.scene.time.now < this.hurtUntil) return;
      const next: AnimState = this.isMoving ? 'walk' : 'idle';
      this.setAnimState(next, true);
      this.updateWalkMotion();
      return;
    }

    const next: AnimState = this.isMoving ? 'walk' : 'idle';
    this.setAnimState(next);
    this.updateWalkMotion();
  }

  private setAnimState(state: AnimState, force: boolean = false): void {
    if (this.animState === state && !force) return;
    const wasWalking = this.animState === 'walk';
    this.animState = state;

    switch (state) {
      case 'idle':
        if (this.scene.anims.exists(HERO_IDLE_KEY)) this.play(HERO_IDLE_KEY);
        if (wasWalking) this.playSquashStretch();
        break;
      case 'walk':
        if (this.scene.anims.exists(HERO_WALK_KEY)) this.play(HERO_WALK_KEY);
        this.playSquashStretch();
        break;
      case 'hurt':
        this.hurtUntil = this.scene.time.now + 120;
        if (this.scene.textures.exists(HERO_HURT_KEY)) {
          this.anims.stop();
          this.setTexture(HERO_HURT_KEY);
        }
        this.setTintFill(0xffffff);
        this.scene.time.delayedCall(80, () => {
          if (this.active && this.animState === 'hurt') this.clearTint();
        });
        break;
      case 'dead':
        if (this.scene.anims.exists(HERO_DEATH_KEY)) {
          this.play(HERO_DEATH_KEY).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.scene.tweens.add({ targets: this, alpha: 0, duration: 150 });
          });
        } else {
          this.setTint(0x555555);
          this.scene.tweens.add({ targets: this, alpha: 0.4, scale: this.scale * 0.85, duration: 400 });
        }
        break;
    }
  }

  // 이동 시작/정지 squash-stretch (scale 1.0 → 0.92 → 1.0, 120ms)
  private playSquashStretch(): void {
    this.squashTween?.stop();
    this.setScale(BASE_SCALE);
    this.squashTween = this.scene.tweens.add({
      targets: this,
      scaleX: BASE_SCALE * 0.92,
      scaleY: BASE_SCALE * 0.92,
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  // walk bob(±1px, hero_walk 6f@8fps 사이클에 동기화) — 물리 위치 드리프트 방지를 위해
  // 매 프레임 이전 오프셋을 제거 후 재계산
  private updateWalkMotion(): void {
    this.y -= this.bobOffset;
    if (this.animState === 'walk') {
      this.walkTimer += this.scene.game.loop.delta;
      this.bobOffset = Math.sin(this.walkTimer * 0.00838) * 1;
    } else {
      this.walkTimer = 0;
      this.bobOffset = 0;
    }
    this.y += this.bobOffset;
  }

  // 발밑 그림자 블롭: bob과 반대로 미세 스케일
  private updateShadow(): void {
    this.shadow.setPosition(this.x, this.y + this.height * 0.42);
    this.shadow.setScale(1 - Math.abs(this.bobOffset) * 0.08);
    this.shadow.setVisible(this.visible);
  }

  // 발사 반동: 조준 반대 방향 2px nudge (WeaponManager/GameScene.addProjectile에서 버스트당 1회 호출)
  // this.x/y를 직접 트윈하면 arcade physics의 속도 기반 이동과 충돌해 이동 중 사격 시
  // 위치가 되튕기므로, bobOffset과 같은 방식으로 별도 offset을 트윈해 매 프레임 합성한다.
  recoil(aimAngle: number): void {
    const dx = -Math.cos(aimAngle) * 2;
    const dy = -Math.sin(aimAngle) * 2;
    this.scene.tweens.add({
      targets: this,
      recoilX: dx,
      recoilY: dy,
      duration: 40,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private updateRecoilOffset(): void {
    this.x -= this.appliedRecoilX;
    this.y -= this.appliedRecoilY;
    this.appliedRecoilX = this.recoilX;
    this.appliedRecoilY = this.recoilY;
    this.x += this.appliedRecoilX;
    this.y += this.appliedRecoilY;
  }

  private regenTimer: number = 0;
  private handleRegen(): void {
    if (this.hpRegen > 0) {
      this.regenTimer += this.scene.game.loop.delta;
      if (this.regenTimer >= 1000) {
        this.heal(this.hpRegen);
        this.regenTimer = 0;
      }
    }
  }

  takeDamage(amount: number): void {
    if (this.isInvincible) return;

    const finalDamage = Math.max(1, amount - this.armor);
    this.currentHp = Math.max(0, this.currentHp - finalDamage);

    // 피격 SFX (캐릭터 - 몬스터와 톤 차별화)
    (this.scene as any).playSfx?.('sfx_player_hit', 0.5);

    // hurt 상태 전이 (120ms 후 자동 복귀) — 즉사면 die()가 dead 상태로 바로 전이
    if (this.currentHp > 0) {
      this.setAnimState('hurt');
    }

    // Invincibility frames (세대 카운터로 늦게 걸린 무적을 조기 해제하지 않음)
    this.isInvincible = true;
    this.setAlpha(0.5);
    const gen = ++this.invincibleGen;
    this.scene.time.delayedCall(GAME_CONFIG.player.invincibilityDuration, () => {
      if (!this.active || this.invincibleGen !== gen) return;
      this.isInvincible = false;
      this.setAlpha(1);
    });

    EventBus.emit(GameEvents.PLAYER_DAMAGE, { hp: this.currentHp, maxHp: this.maxHp, damage: finalDamage });

    if (this.currentHp <= 0) {
      this.die();
    }
  }

  heal(amount: number): void {
    const oldHp = this.currentHp;
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);

    if (this.currentHp > oldHp) {
      // Green flash for healing
      this.setTint(0x00ff00);
      this.scene.time.delayedCall(100, () => {
        this.clearTint();
      });

      EventBus.emit(GameEvents.PLAYER_HEAL, { hp: this.currentHp, maxHp: this.maxHp, healed: this.currentHp - oldHp });
    }
  }

  private die(): void {
    // 응원 부적: 부활 1회 (체력 50% + 2초 무적)
    if (this.revivals > 0) {
      this.revivals--;
      this.currentHp = Math.floor(this.maxHp * 0.5);
      this.setTemporaryInvincible(2000);
      this.setTint(0xffe066);
      this.scene.time.delayedCall(400, () => {
        if (this.active) this.clearTint();
      });
      this.scene.cameras.main.flash(400, 255, 224, 102);
      (this.scene as any).playSfx?.('sfx_levelup', 0.5);
      EventBus.emit(GameEvents.PLAYER_HEAL, {
        hp: this.currentHp,
        maxHp: this.maxHp,
        healed: this.currentHp,
      });
      return;
    }

    // death 4f → 페이드 → 게임오버 오버레이 (설계 §3.1). 애니메이션이 끝날 때까지
    // 추가 피격은 무시(isInvincible 유지)하고, 재생 시간만큼 GAME_OVER emit을 늦춘다.
    this.isInvincible = true;
    this.setVelocity(0, 0);
    this.setAnimState('dead');
    const deathDuration = this.scene.anims.exists(HERO_DEATH_KEY) ? 500 : 400;
    this.scene.time.delayedCall(deathDuration, () => {
      EventBus.emit(GameEvents.GAME_OVER, {});
      this.setActive(false);
      this.setVisible(false);
    });
  }

  getPickupRange(): number {
    return this.pickupRange * this.magnetRange;
  }

  // Apply passive stat bonuses
  applyStat(stat: string, value: number, isPercentage: boolean): void {
    switch (stat) {
      case 'maxHp':
        this.maxHp += isPercentage ? this.maxHp * value : value;
        this.currentHp = Math.min(this.currentHp, this.maxHp);
        break;
      case 'hpRegen':
        this.hpRegen += value;
        break;
      case 'armor':
        this.armor += value;
        break;
      case 'moveSpeed':
        this.speedMultiplier += isPercentage ? value : value / 100;
        break;
      case 'damage':
        this.damageMultiplier += isPercentage ? value : value / 100;
        break;
      case 'area':
        this.areaMultiplier += isPercentage ? value : value / 100;
        break;
      case 'speed':
        this.projectileSpeedMultiplier += isPercentage ? value : value / 100;
        break;
      case 'duration':
        this.durationMultiplier += isPercentage ? value : value / 100;
        break;
      case 'cooldown':
        this.cooldownMultiplier -= isPercentage ? value : value / 100;
        this.cooldownMultiplier = Math.max(0.1, this.cooldownMultiplier);
        break;
      case 'amount':
        this.amountBonus += value;
        break;
      case 'luck':
        this.luck += value;
        break;
      case 'growth':
        this.growth += isPercentage ? value : value / 100;
        break;
      case 'magnet':
        this.magnetRange += isPercentage ? value : value / 100;
        break;
      case 'revival':
        this.revivals += value;
        break;
    }
  }

  /** 행운 연동 치명타 확률 (행운 10%당 치명타 +5%, 최대 50%) */
  getCritChance(): number {
    return Math.min(0.5, this.luck * 0.5);
  }

  private invincibleGen: number = 0;

  /** 일정 시간 무적 (퀴즈 재개 보호, 부활 등) */
  setTemporaryInvincible(durationMs: number): void {
    this.isInvincible = true;
    this.setAlpha(0.6);
    const gen = ++this.invincibleGen;
    this.scene.time.delayedCall(durationMs, () => {
      if (!this.active || this.invincibleGen !== gen) return;
      this.isInvincible = false;
      this.setAlpha(1);
    });
  }

  destroy(fromScene?: boolean): void {
    EventBus.off('joystick-move', this.onJoystickMove, this);
    this.shadow?.destroy();
    this.dustEmitter?.destroy();
    super.destroy(fromScene);
  }
}
