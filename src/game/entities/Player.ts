import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { EventBus, GameEvents } from '../utils/EventBus';
import { HERO_IDLE_KEY } from '../assetKeys';

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

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Native-size pixel-art hero (Phase 3C); no more 1024px 0.1-scale hack.
    super(scene, x, y, HERO_IDLE_KEY);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // 히어로가 화면에서 잘 읽히도록 native(≈48×68px) 대비 약간 확대
    this.setScale(1.3);

    // idle 루프 재생 (Phase 4에서 상태머신으로 확장)
    if (scene.anims.exists(HERO_IDLE_KEY)) {
      this.play(HERO_IDLE_KEY);
    }

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

  update(): void {
    this.handleMovement();
    this.handleRegen();
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

      // Flip sprite based on direction
      if (velocity.x < 0) {
        this.setFlipX(true);
      } else if (velocity.x > 0) {
        this.setFlipX(false);
      }
    } else {
      this.setVelocity(0, 0);
    }
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

    // Flash effect
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      this.clearTint();
    });

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
    EventBus.emit(GameEvents.GAME_OVER, {});
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
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
    super.destroy(fromScene);
  }
}
