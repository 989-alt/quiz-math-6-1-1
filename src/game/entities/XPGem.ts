import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { GEM_KEYS } from '../assetKeys';

export type GemType = 'xp_small' | 'xp_medium' | 'xp_large' | 'xp_red' | 'xp_rainbow' | 'health' | 'magnet';
export type GemSize = 'small' | 'medium' | 'large' | 'red' | 'rainbow';

export interface GemConfig {
  type: GemType;
  value: number;
  spriteKey: string;
  scale: number;
}

// 웨이브별 5티어 젬 확률표: [파랑1, 초록3, 노랑8, 빨강15, 무지개30] (행 합 = 1.0).
// 값별 색 티어를 부여하되 기대 젬값 E(wave)가 소득 곡선을 따라 완만히 오르게 손튜닝했다
// (= 소득 점프를 없애 퀴즈=레벨업 간격을 25~75초 밴드에 유지).
//
// 설계 핵심(시뮬레이션 scratchpad/final_sim.py):
//  - kills/s ≈ 1000/spawnInterval 이 wave16에서 5/s로 캡되므로, 그 전(1~15)은 사냥 속도가
//    소득을 올리도록 E를 낮게(~1.3) 두고, wave16 killrate 스파이크(4→5/s)는 E 소폭 하강으로 흡수한다.
//  - wave16 이후엔 killrate가 고정이라 소득 성장은 전적으로 E가 담당 → E를 완만히 1.5→5.8로 끌어올린다.
//  - 빨강(15)·무지개(30)는 '희귀 잭팟': 값이 커서 자주 나오면 한 개가 소득을 폭발시켜 간격이 붕괴한다.
//    그래서 wave26+ 빨강 3→9%, wave36+ 무지개 2→5%로 소량만 섞어 시각적 보상과 밴드를 양립시킨다.
//  검증: 전 구간(L2~L50) 기대값 간격 25~36초, 총 게임 ~25분. (final_sim.py 참고)
const GEM_TIER_TABLE: ReadonlyArray<readonly [number, readonly [number, number, number, number, number]]> = [
  [5,   [1.00,  0.00,  0.00, 0.00, 0.00]], // E≈1.00
  [10,  [0.85,  0.15,  0.00, 0.00, 0.00]], // E≈1.30
  [15,  [0.85,  0.15,  0.00, 0.00, 0.00]], // E≈1.30
  [20,  [0.925, 0.075, 0.00, 0.00, 0.00]], // E≈1.15 (killrate 캡 흡수)
  [25,  [0.78,  0.20,  0.02, 0.00, 0.00]], // E≈1.54 (노랑 등장)
  [30,  [0.805, 0.115, 0.05, 0.03, 0.00]], // E≈2.00 (빨강 등장, wave26+)
  [35,  [0.75,  0.12,  0.08, 0.05, 0.00]], // E≈2.50
  [40,  [0.78,  0.06,  0.08, 0.06, 0.02]], // E≈3.10 (무지개 등장, wave36+)
  [45,  [0.675, 0.105, 0.12, 0.07, 0.03]], // E≈3.90
  [50,  [0.52,  0.20,  0.16, 0.08, 0.04]], // E≈4.80
  [Infinity, [0.315, 0.345, 0.20, 0.09, 0.05]], // E≈5.80
];

const GEM_SIZES: readonly GemSize[] = ['small', 'medium', 'large', 'red', 'rainbow'];

// Get gem size based on wave number — 위 확률표에서 티어 추첨.
export function getGemSizeForWave(wave: number): GemSize {
  const row = GEM_TIER_TABLE.find(([hi]) => wave <= hi)?.[1] ?? GEM_TIER_TABLE[GEM_TIER_TABLE.length - 1][1];
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < GEM_SIZES.length; i++) {
    acc += row[i];
    if (r < acc) return GEM_SIZES[i];
  }
  return GEM_SIZES[GEM_SIZES.length - 1];
}

// Get XP value for gem size
export function getXPForGemSize(size: GemSize): number {
  return GAME_CONFIG.gems[size];
}

// XPGem 생성자가 실제로 쓰는 값→스프라이트 매핑. xp 값 임계로 5티어 색을 고른다
// (getGemSizeForWave가 뽑은 티어의 값이 그대로 들어오므로 threshold가 곧 역매핑).
function getGemConfig(xpValue: number): GemConfig {
  if (xpValue >= GAME_CONFIG.gems.rainbow) {
    return { type: 'xp_rainbow', value: xpValue, spriteKey: GEM_KEYS.rainbow, scale: 1.6 };
  } else if (xpValue >= GAME_CONFIG.gems.red) {
    return { type: 'xp_red', value: xpValue, spriteKey: GEM_KEYS.red, scale: 1.5 };
  } else if (xpValue >= GAME_CONFIG.gems.large) {
    return { type: 'xp_large', value: xpValue, spriteKey: GEM_KEYS.large, scale: 1.4 };
  } else if (xpValue >= GAME_CONFIG.gems.medium) {
    return { type: 'xp_medium', value: xpValue, spriteKey: GEM_KEYS.medium, scale: 1.3 };
  } else {
    return { type: 'xp_small', value: xpValue, spriteKey: GEM_KEYS.small, scale: 1.2 };
  }
}

export class XPGem extends Phaser.Physics.Arcade.Sprite {
  public xpValue: number;
  public gemType: GemType;
  private isBeingCollected: boolean = false;
  private collectTarget: Phaser.Physics.Arcade.Sprite | null = null;
  private targetScale: number;

  constructor(scene: Phaser.Scene, x: number, y: number, xpValue: number = 1) {
    const config = getGemConfig(xpValue);
    super(scene, x, y, config.spriteKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.xpValue = xpValue;
    this.gemType = config.type;
    this.targetScale = config.scale;

    // Set scale for actual sprite
    this.setScale(config.scale);

    // Set physics body size to match full sprite for reliable collection
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.width, this.height);
    body.setOffset(0, 0);

    this.setDepth(2);

    // Spawn animation
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: config.scale,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // 사망 지점에서 살짝 튕겨 나가는 포물선 낙하 (설계 §3.2) — 안착 후 기존 부유 애니메이션 시작
    const tossX = x + (Math.random() - 0.5) * 50;
    const tossPeakY = y - 24 - Math.random() * 16;
    scene.tweens.add({
      targets: this,
      x: tossX,
      y: tossPeakY,
      duration: 160,
      ease: 'Sine.easeOut',
      onComplete: () => {
        // 체인 진행 중 이미 collect()로 파괴됐으면 다음 트윈을 만들지 않음 (트윈 누수 방지)
        if (!this.active) return;
        scene.tweens.add({
          targets: this,
          y,
          duration: 160,
          ease: 'Sine.easeIn',
          onComplete: () => {
            if (!this.active) return;
            // Floating animation
            scene.tweens.add({
              targets: this,
              y: y - 5,
              duration: 1000,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
          },
        });
      },
    });
  }

  update(): void {
    if (this.isBeingCollected && this.collectTarget && this.collectTarget.active) {
      // Move towards target
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.collectTarget.x, this.collectTarget.y);
      const speed = 400;
      this.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
    } else if (this.isBeingCollected) {
      // 타깃이 사라짐(비활성/파괴) — 마지막 속도로 영구 직진하며 고착되지 않도록 원상 복귀
      this.isBeingCollected = false;
      this.collectTarget = null;
      this.setVelocity(0, 0);
    }
  }

  startCollection(target: Phaser.Physics.Arcade.Sprite): void {
    if (this.isBeingCollected) return;

    this.isBeingCollected = true;
    this.collectTarget = target;

    // Speed up animation when being collected
    this.scene.tweens.killTweensOf(this);
  }

  collect(): number {
    if (!this.active) return 0;
    // 즉시 비활성화 — 100ms 축소 트윈 동안 overlap이 매 프레임 재발화해
    // 젬 1개가 XP를 6~7회 지급하던 버그 차단 (핸들러의 active 가드가 재진입을 막는다)
    this.setActive(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    // startCollection을 거치지 않고 직접 밟아 수집되는 경로(플레이어 overlap 즉시 collect)에서도
    // 생성자의 스폰/부유 트윈 체인을 확실히 정지 (누적 트윈 누수 방지)
    this.scene.tweens.killTweensOf(this);

    const value = this.xpValue;

    // Collection effect
    this.scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      duration: 100,
      onComplete: () => {
        this.destroy();
      }
    });

    return value;
  }

  isCollecting(): boolean {
    return this.isBeingCollected;
  }

  // Factory method for wave-based gem creation
  static createForWave(scene: Phaser.Scene, x: number, y: number, wave: number): XPGem {
    const size = getGemSizeForWave(wave);
    const xpValue = getXPForGemSize(size);
    return new XPGem(scene, x, y, xpValue);
  }
}

export class MagnetGem extends Phaser.Physics.Arcade.Sprite {
  private isBeingCollected: boolean = false;
  private collectTarget: Phaser.Physics.Arcade.Sprite | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, GEM_KEYS.magnet);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(1.3);
    this.setDepth(2);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.displayWidth * 0.8, this.displayHeight * 0.8);

    // Spawn animation
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scale: 1.3,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Rotating animation (magnet gems spin)
    scene.tweens.add({
      targets: this,
      rotation: Math.PI * 2,
      duration: 2000,
      repeat: -1,
    });
  }

  startCollection(target: Phaser.Physics.Arcade.Sprite): void {
    if (this.isBeingCollected) return;
    this.isBeingCollected = true;
    this.collectTarget = target;
    this.scene.tweens.killTweensOf(this);
  }

  update(): void {
    if (this.isBeingCollected && this.collectTarget && this.collectTarget.active) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.collectTarget.x, this.collectTarget.y);
      this.setVelocity(Math.cos(angle) * 400, Math.sin(angle) * 400);
    }
  }

  // Magnet effect: collect all XP gems on screen
  collect(): void {
    if (!this.active) return;
    // 축소 트윈 동안 재발화 방지 (자석 효과 중복 발동 차단)
    this.setActive(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    // 회전 반복 트윈(repeat:-1)이 startCollection 없이 직접 collect되는 경로에서도 반드시 정지
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scale: 0,
      alpha: 0,
      duration: 100,
      onComplete: () => this.destroy()
    });
  }

  isCollecting(): boolean {
    return this.isBeingCollected;
  }
}
