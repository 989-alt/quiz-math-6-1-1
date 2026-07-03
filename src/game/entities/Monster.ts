import Phaser from 'phaser';

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
  private target: Phaser.Physics.Arcade.Sprite | null = null;
  private hpBar: Phaser.GameObjects.Graphics | null = null;

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

    if (config.scale) {
      this.setScale(config.scale);
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

    // Create HP bar for bosses
    if (this.isBoss) {
      this.createHpBar();
    }
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

    // Flip sprite based on direction
    if (velocity.x < 0) {
      this.setFlipX(true);
    } else {
      this.setFlipX(false);
    }

    // Update HP bar position for bosses
    if (this.isBoss && this.hpBar) {
      this.updateHpBar();
    }
  }

  takeDamage(amount: number): boolean {
    // 이미 죽음 처리 중이거나 비활성 상태면 추가 데미지 무시 (중복 호출 차단)
    if (!this.active || this.hp <= 0) {
      return false;
    }

    this.hp -= amount;

    // 1) 빨간 hit flash (선명하게, 길게)
    this.setTint(0xff3333);
    this.scene.time.delayedCall(120, () => {
      if (this.active) {
        this.clearTint();
      }
    });

    // 2) 데미지 숫자 floating text
    this.spawnDamageNumber(Math.round(amount));

    // 3) SFX
    (this.scene as any).playSfx?.('sfx_monster_hit', this.isBoss ? 0.35 : 0.22);

    // Knockback (less for bosses)
    if (this.target) {
      const angle = Phaser.Math.Angle.Between(this.target.x, this.target.y, this.x, this.y);
      const knockback = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
      knockback.scale(this.isBoss ? 30 : 100);
      this.setVelocity(knockback.x, knockback.y);
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

  private die(): void {
    // 즉시 비활성화 + 물리 바디 OFF (페이드 중에 다시 충돌·중복 처치되는 것 방지)
    this.setActive(false);
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.enable = false;
    }

    // 처치 SFX (보스는 더 크게)
    (this.scene as any).playSfx?.('sfx_monster_die', this.isBoss ? 0.55 : 0.3);

    // Destroy HP bar
    if (this.hpBar) {
      this.hpBar.destroy();
      this.hpBar = null;
    }

    // Death effect - simple fade
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: this.isBoss ? this.scale * 0.8 : 0.5,
      duration: this.isBoss ? 500 : 200,
      onComplete: () => {
        this.destroy();
      }
    });
  }

  destroy(fromScene?: boolean): void {
    if (this.hpBar) {
      this.hpBar.destroy();
      this.hpBar = null;
    }
    super.destroy(fromScene);
  }
}

// Get monster config based on wave number
export function getMonsterConfigForWave(wave: number): MonsterConfig {
  // Select monster sprite based on wave (cycles through 15 monsters)
  const monsterIndex = ((wave - 1) % 15) + 1;
  const spriteKey = `monster_${monsterIndex}`;

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
      scale: 0.14,
    };
  } else if (wavePhase === 2) {
    // 보스 직전: 빠른 약한 (HP 0.4배, 빠름)
    return {
      hp: Math.max(1, Math.floor(baseHp * 0.4)),
      damage: Math.floor(baseDamage * 0.7),
      speed: baseSpeed * 1.5,
      xpValue: baseXp,
      spriteKey,
      scale: 0.07,
    };
  } else {
    // 일반 웨이브: 균형형
    return {
      hp: baseHp,
      damage: baseDamage,
      speed: baseSpeed,
      xpValue: baseXp,
      spriteKey,
      scale: 0.1,
    };
  }
}

// Get boss config based on wave number
export function getBossConfigForWave(wave: number): MonsterConfig {
  // Boss appears every 3 waves, select boss sprite (cycles through 5 bosses)
  const bossIndex = (Math.floor(wave / 3) % 5) + 1;
  const spriteKey = `boss_${bossIndex}`;

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
    scale: 0.2, // Bosses are larger
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
    spriteKey: 'monster_1',
    scale: 0.1,
  },
  fast: {
    hp: 5,
    damage: 3,
    speed: 100,
    xpValue: 1,
    spriteKey: 'monster_2',
    scale: 0.08,
  },
  tank: {
    hp: 30,
    damage: 10,
    speed: 40,
    xpValue: 3,
    spriteKey: 'monster_3',
    scale: 0.12,
  },
  boss: {
    hp: 200,
    damage: 20,
    speed: 50,
    xpValue: 20,
    spriteKey: 'boss_1',
    scale: 0.2,
    isBoss: true,
  },
};
