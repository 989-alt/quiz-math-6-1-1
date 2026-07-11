import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Monster, MonsterTypes, getMonsterConfigForWave, getMonsterConfigForRotation, FULL_ROTATION_LENGTH, SPAWNS_PER_TYPE, ROTATION_LENGTH, getBossConfigForWave, isBossWave } from '../entities/Monster';
import { XPGem, MagnetGem } from '../entities/XPGem';
import { WeaponManager, WeaponInfoList, PetInfoList, BonusInfoList } from '../weapons/WeaponManager';
import { PassiveInfoList } from '../weapons/PassiveManager';
import { EventBus, GameEvents } from '../utils/EventBus';
import { GAME_CONFIG } from '../config';
import { GROUND_TILE_KEY, MONSTER_WALK_KEYS } from '../assetKeys';
import { EffectManager } from '../effects/EffectManager';
import { getSoundSettings } from '../../stores/soundSettings';

// 청크 좌표 → 결정적 시드 해시 (같은 월드 위치엔 항상 같은 장식)
function hashChunk(cx: number, cy: number): number {
  let h = (cx * 374761393 + cy * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// mulberry32 시드 PRNG
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private monsters!: Phaser.Physics.Arcade.Group;
  private xpGems!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group; // 필드 드랍 아이템 (자석 등)
  private projectiles!: Phaser.Physics.Arcade.Group;
  private weaponManager!: WeaponManager;
  public fx!: EffectManager;

  private survivalTime: number = 0;
  private currentWave: number = 1;
  private monstersKilled: number = 0;
  private playerLevel: number = 1;
  private playerXp: number = 0;
  private xpToNextLevel: number = GAME_CONFIG.xp.baseToLevel;
  private score: number = 0;
  private quizStreak: number = 0; // 연속 정답 (XP 배율 +5%/스택, 최대 +25%)

  private isPaused: boolean = false;
  // 탭/창 이탈로 자동 일시정지됐는지 (복귀 시 React 일시정지 오버레이 트리거용, Task 4)
  private autoPausedByVisibility: boolean = false;
  private spawnTimer: number = 0;
  private spawnRotationIndex: number = 0; // 순차 로테이션 스폰 인덱스 (세트 = index / FULL_ROTATION_LENGTH)
  private finishAfterResume: boolean = false; // 문제은행 완주 — 퀴즈/강화 흐름이 끝나면 종료
  private finalBossTriggered: boolean = false; // 무기 6종 만렙 → 최종 보스 소환 (1회만)
  private finalBossDefeated: boolean = false; // 최종 보스 처치 = 클리어 (집계 시 cleared 강제)
  private gameFinished: boolean = false; // 결과 집계 완료 — GAME_FINISHED 중복 발행 방지
  private stateUpdateTimer: number = 0;
  private pendingLevelUp: boolean = false; // Track if level up is waiting for quiz
  private levelUpQueue: number = 0; // Stacked level ups awaiting quiz processing
  private bgm: Phaser.Sound.BaseSound | null = null;
  private bgmEnabled: boolean = true;
  private sfxEnabled: boolean = true;

  // === 몬스터 물량 상한 3단 체계 (평시 천장 100 / 러시 버스트 천장 160 / 왕관 하수인 캡 40 별도)
  // → 최악의 경우 동시 활성 몬스터는 대략 100(평시) + 60(러시 버스트 여유분) + 40(하수인, 별도 카운트 없이 같은 그룹 상한 공유) ≈ 200 수준으로 억제
  private static readonly NORMAL_SPAWN_MAX_ACTIVE = 100; // 평시 스포너 천장
  private static readonly RUSH_MAX_ACTIVE = 160;         // 러시 버스트 천장 (평시 천장 + 60 헤드룸, 후반부에도 항상 확보)

  // === 몬스터 러시 이벤트 (Task 7) — 타이머 전부 delta 누적(일시정지 안전) ===
  private static readonly RUSH_FIRST_MS = 90000;   // 첫 러시 = 90초
  private static readonly RUSH_WARNING_MS = 1500;   // 경고 페이즈 1.5초
  private static readonly RUSH_ACTIVE_MS = 8000;    // 러시 페이즈 8초
  private static readonly RUSH_SPAWN_INTERVAL = 70; // 러시 스폰 간격 ~70ms (체감 가속)
  private static readonly RUSH_BURST_COUNT = 12;    // 액티브 페이즈 진입 즉시 터지는 초기 물량
  private static readonly RUSH_TEXTURE_KEY = 'rush_vignette';

  // idle: 다음 러시까지 카운트업 / warning: 경고 배너+사이렌 / active: 폭풍 스폰
  private rushPhase: 'idle' | 'warning' | 'active' = 'idle';
  private rushTimer: number = 0;              // idle 단계에서 다음 러시까지 누적(ms)
  private rushTriggerAt: number = GameScene.RUSH_FIRST_MS; // 다음 러시 발동 임계(ms)
  private rushPhaseTimer: number = 0;         // warning/active 단계 내 경과(ms)
  private rushSpawnTimer: number = 0;         // 러시 전용 스폰 간격 누적(ms)
  private lastBossSpawnAt: number = -999;     // 마지막 보스 웨이브 시각(survivalTime 초)
  private rushBgm: Phaser.Sound.BaseSound | null = null;
  private rushVignette: Phaser.GameObjects.Image | null = null;
  private rushBanner: Phaser.GameObjects.Container | null = null;

  private background!: Phaser.GameObjects.TileSprite;
  // 결정적 청크 장식: "cx,cy" → 그 청크에 배치된 deco 오브젝트들(일반 이미지 + solid 정적 이미지)
  private decoChunks: Map<string, Phaser.GameObjects.GameObject[]> = new Map();
  // solid deco의 정적 충돌 바디 그룹 (플레이어·몬스터가 통과 못 함)
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private static readonly CHUNK_SIZE = 512;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Remove world bounds constraints
    this.physics.world.setBounds(0, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);

    // Create infinite background
    this.createBackground();

    // Create groups
    this.monsters = this.physics.add.group({ classType: Monster });
    this.xpGems = this.physics.add.group({ classType: XPGem });
    this.pickups = this.physics.add.group();
    this.projectiles = this.physics.add.group();
    // solid deco 정적 장애물 그룹 (청크 라이프사이클로 멤버가 생성/파괴됨)
    this.obstacles = this.physics.add.staticGroup();

    this.fx = new EffectManager(this);

    // Check for textures and create fallbacks if needed
    if (!this.textures.exists('player')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x00ff00);
      g.fillRect(0, 0, 32, 32);
      g.generateTexture('player', 32, 32);
      g.destroy();
    }

    if (!this.textures.exists('monster_basic')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xff0000);
      g.fillRect(0, 0, 32, 32);
      g.generateTexture('monster_basic', 32, 32);
      g.destroy();
    }

    // Create player at startup center
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    this.player = new Player(this, centerX, centerY);

    // Setup camera
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Create weapon manager and give starting weapon
    this.weaponManager = new WeaponManager(this, this.player);
    this.weaponManager.addWeapon('pencil'); // 시작 무기 = 연필 (설계 §5.2)

    // Setup collisions
    this.setupCollisions();

    // 몬스터 vs solid 장애물 충돌은 그룹끼리라 단 한 번만 등록 (몬스터 그룹은 리셋 시
    // 파괴되지 않고 clear만 되므로 재등록 불필요 — 중복 등록하면 분리가 두 번 적용됨)
    // processCallback: 유령처럼 passesObstacles인 몬스터는 장애물과 분리하지 않고 통과시킴
    this.physics.add.collider(
      this.monsters,
      this.obstacles,
      undefined,
      (m, _o) => !(m as Monster).passesObstacles
    );

    // 저장된 브금/효과음 설정 적용 (기본값 둘 다 true)
    const soundSettings = getSoundSettings();
    this.bgmEnabled = soundSettings.bgm;
    this.sfxEnabled = soundSettings.sfx;

    // Setup event listeners
    this.setupEventListeners();

    // 탭/창 이탈 자동 일시정지 (Task 4) — RAF 스로틀 중에도 몬스터만 계속 움직여
    // 복귀 시 즉사하는 상황 방지
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Phaser는 유저 정의 shutdown()을 자동 호출하지 않음 — 씬 라이프사이클 이벤트에
    // 직접 배선해야 EventBus/document 리스너가 실제로 정리된다 (홈으로→재시작 누적 방지).
    // game.destroy(true)는 SHUTDOWN 없이 DESTROY만 emit하므로 둘 다 건다.
    // 씬 restart(shutdown→create 재호출) 시 가드 리셋 후 재배선.
    this.shutdownDone = false;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

    // Start BGM (loop)
    this.startBgm();

    // Emit game ready
    EventBus.emit(GameEvents.GAME_READY);

    // Initial state update
    this.emitPlayerState();

    // dev 전용 디버그 훅: 자동화 검증(Playwright)에서 무기 강제 장착/레벨업에 사용
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__gs = this;
    }
  }

  // 외부 호출용 SFX 헬퍼 (Monster, Player에서 사용)
  playSfx(key: string, volume = 0.4): void {
    if (!this.sfxEnabled) return;
    if (this.cache.audio.exists(key)) {
      this.sound.play(key, { volume });
    }
  }

  private startBgm(): void {
    if (!this.bgmEnabled) return;
    if (this.bgm) return;
    if (this.cache.audio.exists('bgm')) {
      this.bgm = this.sound.add('bgm', { loop: true, volume: 0.3 });
      this.bgm.play();
    }
  }

  private stopBgm(): void {
    if (this.bgm) {
      this.bgm.stop();
      this.bgm.destroy();
      this.bgm = null;
    }
  }

  private createBackground(): void {
    // 바닥: 이음매 없는 512px ground_tile을 카메라 고정 TileSprite로 스크롤 (안개 불필요)
    const tileKey = this.textures.exists(GROUND_TILE_KEY)
      ? GROUND_TILE_KEY
      : this.generateFallbackGround();

    this.background = this.add.tileSprite(
      0, 0,
      this.scale.width,
      this.scale.height,
      tileKey
    );
    this.background.setOrigin(0, 0);
    this.background.setScrollFactor(0); // Fix to camera
    this.background.setDepth(-10);

    // Resize background on window resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.background.setSize(gameSize.width, gameSize.height);
      // 러시 비네트도 카메라 크기에 맞춰 재배치/스케일 (배경과 동일 규약)
      if (this.rushVignette) {
        this.rushVignette.setPosition(gameSize.width / 2, gameSize.height / 2);
        this.rushVignette.setDisplaySize(gameSize.width, gameSize.height);
      }
    });
  }

  /** ground_tile 로드 실패 시 안전망: 밋밋한 풀밭 타일 (512px seamless) */
  private generateFallbackGround(): string {
    const tileKey = 'fallback-ground';
    if (this.textures.exists(tileKey)) return tileKey;

    const size = 512;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x2f5d3a, 1);
    g.fillRect(0, 0, size, size);

    // 결정적 도트 노이즈 (렌더 안정성)
    let seed = 20260704;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const shades = [0x274d31, 0x376b44, 0x2a5537];
    for (let i = 0; i < 900; i++) {
      const x = Math.floor(rand() * size);
      const y = Math.floor(rand() * size);
      const s = rand() < 0.85 ? 2 : 3;
      g.fillStyle(shades[Math.floor(rand() * shades.length)], 0.6);
      g.fillRect(x, y, s, s);
    }

    g.generateTexture(tileKey, size, size);
    g.destroy();
    return tileKey;
  }

  /**
   * 배경 장식 (설계 §4): 월드를 512px 청크로 나누고, 각 가시 청크마다 청크 좌표
   * 시드 PRNG로 deco 종류·위치·개수를 결정적으로 배치. 같은 월드 위치엔 항상 같은
   * 장식이 나오고, 화면 밖 청크는 컬링. depth 1 → 바닥 위, 엔티티 아래.
   */
  private updateDecorations(): void {
    const CHUNK = GameScene.CHUNK_SIZE;
    const view = this.cameras.main.worldView;
    const minCx = Math.floor(view.x / CHUNK) - 1;
    const maxCx = Math.floor(view.right / CHUNK) + 1;
    const minCy = Math.floor(view.y / CHUNK) - 1;
    const maxCy = Math.floor(view.bottom / CHUNK) + 1;

    const needed = new Set<string>();
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = `${cx},${cy}`;
        needed.add(key);
        if (!this.decoChunks.has(key)) {
          this.spawnChunkDecorations(cx, cy, key);
        }
      }
    }

    // 범위 밖 청크 컬링 (일반 이미지 + solid 정적 이미지 모두 destroy → 바디 누수 없음.
    // 정적 이미지는 destroy 시 obstacles 그룹에서 자동 제거됨)
    for (const [key, objs] of this.decoChunks) {
      if (!needed.has(key)) {
        objs.forEach((o) => o.destroy());
        this.decoChunks.delete(key);
      }
    }
  }

  // 작은 잡초·바위·버섯: 흔함(자연 산개). 종류별 가중치.
  private static readonly DECO_TABLE: ReadonlyArray<{ key: string; w: number }> = [
    { key: 'deco_rock', w: 10 },
    { key: 'deco_mushrooms', w: 9 },
    { key: 'deco_flower_bush', w: 9 },
    { key: 'deco_bush', w: 8 },
    { key: 'deco_crystals', w: 4 },
    { key: 'deco_stump', w: 4 },
    { key: 'deco_fallen_log', w: 3 },
  ];
  // 큰 랜드마크: 희소(매 화면 반복 방지) — 룬석·연못·이정표
  private static readonly DECO_LANDMARKS: readonly string[] = [
    'deco_rune_stone', 'deco_pond', 'deco_signpost',
  ];

  // 종류별 기준 화면 폭(px). 랜드마크는 크게, 작은 잡동사니는 작게. 실제 스케일은
  // (기준폭 / 텍스처 native 폭) × 넓은 랜덤배율[0.6–1.5]로 같은 종류도 눈에 띄게 달라짐.
  private static readonly DECO_BASE_SIZE: Record<string, number> = {
    deco_pond: 150, deco_rune_stone: 130, deco_fallen_log: 140, deco_signpost: 110,
    deco_rock: 78, deco_stump: 68,
    deco_crystals: 62, deco_bush: 60, deco_flower_bush: 56, deco_mushrooms: 54,
  };
  // 군집으로 뭉쳐 자연스러운 덤불을 이루는 식생/광물(같은 에셋 2–5개 겹쳐 배치).
  private static readonly DECO_CLUMP_KEYS: ReadonlySet<string> = new Set<string>([
    'deco_bush', 'deco_flower_bush', 'deco_mushrooms', 'deco_crystals',
  ]);

  private pickWeightedDeco(rand: () => number): string {
    const table = GameScene.DECO_TABLE;
    const total = table.reduce((s, d) => s + d.w, 0);
    let roll = rand() * total;
    for (const d of table) {
      roll -= d.w;
      if (roll <= 0) return d.key;
    }
    return table[0].key;
  }

  // 텍스처별 불투명(alpha>임계) 픽셀 경계 캐시 — 충돌 바디를 그림 외곽에 맞추는 데 사용.
  private opaqueBoundsCache: Map<string, { x: number; y: number; w: number; h: number }> = new Map();

  /** 텍스처의 불투명 영역 bbox(텍스처 픽셀 좌표). 투명 padding을 제외한 실제 그림 테두리. */
  private getOpaqueBounds(key: string): { x: number; y: number; w: number; h: number } {
    const cached = this.opaqueBoundsCache.get(key);
    if (cached) return cached;

    const src = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const tw = src.width;
    const th = src.height;
    let minX = tw, minY = th, maxX = -1, maxY = -1;

    // 소스 이미지를 캔버스에 그려 픽셀 alpha를 한 번만 스캔(키당 캐시).
    const canvas = Phaser.Display.Canvas.CanvasPool.create(this, tw, th);
    const ctx = canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings)!;
    ctx.drawImage(src as CanvasImageSource, 0, 0);
    const data = ctx.getImageData(0, 0, tw, th).data;
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        if (data[(y * tw + x) * 4 + 3] > 12) { // alpha 임계 (fringe 무시)
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    Phaser.Display.Canvas.CanvasPool.remove(canvas);

    const bounds = maxX < 0
      ? { x: 0, y: 0, w: tw, h: th } // 전부 투명이면(비정상) 전체 사용
      : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    this.opaqueBoundsCache.set(key, bounds);
    return bounds;
  }

  /**
   * 단일 deco 배치. 모든 deco를 obstacles 정적 그룹에 넣고, 충돌 바디를 그림 외곽
   * (불투명 픽셀 bbox)에 맞춰 생성한다 — 투명 padding 제외, 오브젝트 전체를 덮어
   * 위로 통과되지 않게. 크기는 종류별 기준 × 넓은 랜덤배율.
   */
  private placeDeco(
    decoKey: string,
    px: number,
    py: number,
    rand: () => number,
    objs: Phaser.GameObjects.GameObject[]
  ): void {
    if (!this.textures.exists(decoKey)) return;

    const base = GameScene.DECO_BASE_SIZE[decoKey] ?? 70;
    const sprite = this.obstacles.create(px, py, decoKey) as Phaser.Physics.Arcade.Sprite;

    // 크기 변주: (기준 화면폭 / native 폭) × 랜덤배율[0.6–1.5]
    const nativeW = sprite.width || base;
    const scale = (base / nativeW) * (0.6 + rand() * 0.9);
    const flipped = rand() < 0.5;
    sprite.setScale(scale);
    sprite.setAlpha(0.95);
    if (flipped) sprite.setFlipX(true); // 좌우 뒤집기로 반복감 감소
    // y가 클수록(아래=가까움) 위에 그려 겹침을 자연스럽게. 엔티티(depth≥2) 아래 유지.
    sprite.setDepth(1 + (((py % 100000) + 100000) % 100000) / 1e8);

    // 충돌 바디를 그림 외곽(불투명 bbox)에 맞춰 배치 (스케일·좌우반전 반영)
    const b = this.getOpaqueBounds(decoKey);
    const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
    const bw = b.w * scale;
    const bh = b.h * scale;
    // 불투명 영역 중심의, 텍스처 중심 대비 오프셋(픽셀) → 월드 좌표(스케일 적용)
    let dx = (b.x + b.w / 2 - sprite.width / 2) * scale;
    const dy = (b.y + b.h / 2 - sprite.height / 2) * scale;
    if (flipped) dx = -dx; // 좌우반전 시 x 오프셋도 반전
    const worldCx = px + dx;
    const worldCy = py + dy;
    body.setSize(bw, bh);
    body.position.set(worldCx - bw / 2, worldCy - bh / 2);
    body.updateCenter();

    objs.push(sprite);
  }

  /**
   * clump 친화 종류(덤불·꽃·버섯·수정)는 45% 확률로 같은 에셋 2–5개를 작은 오프셋·다른
   * 스케일·랜덤 좌우반전으로 겹쳐 배치해 빽빽한 덤불을 이룬다. 그 외엔 단일 배치.
   */
  private placeDecoOrClump(
    decoKey: string,
    px: number,
    py: number,
    rand: () => number,
    objs: Phaser.GameObjects.GameObject[]
  ): void {
    if (GameScene.DECO_CLUMP_KEYS.has(decoKey) && rand() < 0.45) {
      const copies = 2 + Math.floor(rand() * 4); // 2–5개
      for (let i = 0; i < copies; i++) {
        const ox = (rand() - 0.5) * 64;
        const oy = (rand() - 0.5) * 44;
        this.placeDeco(decoKey, px + ox, py + oy, rand, objs);
      }
    } else {
      this.placeDeco(decoKey, px, py, rand, objs);
    }
  }

  /**
   * 자연스러운 장식 배치 (설계 §4): 균일 산포 대신
   * ① 큰 랜드마크는 청크당 ~8% 확률로 최대 1개(희소),
   * ② 작은 잡초·바위는 밀도 가변(빈터 25% / 1군집 45% / 2군집 30%)으로
   *    군집 중심 주변에 모아 배치. 같은 월드 위치엔 항상 같은 결과(결정적).
   */
  private spawnChunkDecorations(cx: number, cy: number, key: string): void {
    const CHUNK = GameScene.CHUNK_SIZE;
    const rand = mulberry32(hashChunk(cx, cy));
    const baseX = cx * CHUNK;
    const baseY = cy * CHUNK;
    const objs: Phaser.GameObjects.GameObject[] = [];

    // ① 희소 랜드마크
    if (rand() < 0.08) {
      const lm = GameScene.DECO_LANDMARKS[Math.floor(rand() * GameScene.DECO_LANDMARKS.length)];
      this.placeDeco(lm, baseX + (0.2 + rand() * 0.6) * CHUNK, baseY + (0.2 + rand() * 0.6) * CHUNK, rand, objs);
    }

    // ② 작은 잡초·바위 군집 (일부는 같은 에셋 clump으로 빽빽하게)
    const densityRoll = rand();
    const clusters = densityRoll < 0.25 ? 0 : densityRoll < 0.7 ? 1 : 2;
    for (let c = 0; c < clusters; c++) {
      const ccx = baseX + rand() * CHUNK;
      const ccy = baseY + rand() * CHUNK;
      const n = 1 + Math.floor(rand() * 3); // 군집당 1–3개
      for (let i = 0; i < n; i++) {
        const ox = (rand() - 0.5) * 140;
        const oy = (rand() - 0.5) * 140;
        this.placeDecoOrClump(this.pickWeightedDeco(rand), ccx + ox, ccy + oy, rand, objs);
      }
    }

    this.decoChunks.set(key, objs);
  }

  // ... (setupCollisions, handlePlayerMonsterCollision, etc. remain the same) ...
  private setupCollisions(): void {
    // Player vs solid 장애물 (통과 불가). 플레이어는 리셋마다 재생성되므로 여기서 재등록해
    // 새 플레이어에 연결한다(구 플레이어는 파괴돼 이전 collider는 자연 무력화).
    this.physics.add.collider(this.player, this.obstacles);

    // Player vs Monsters
    this.physics.add.overlap(
      this.player,
      this.monsters,
      this.handlePlayerMonsterCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // Player vs XP Gems
    this.physics.add.overlap(
      this.player,
      this.xpGems,
      this.handlePlayerGemCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // Player vs 필드 드랍 아이템 (자석: 화면의 모든 수정 흡인)
    this.physics.add.overlap(
      this.player,
      this.pickups,
      this.handlePlayerPickupCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );

    // Projectiles vs Monsters
    this.physics.add.overlap(
      this.projectiles,
      this.monsters,
      this.handleProjectileMonsterCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    );
  }

  private handlePlayerMonsterCollision(
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    monster: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ): void {
    const m = monster as Monster;
    if (!m.active || !this.player.active) return;

    // 몬스터 접촉 시 플레이어 피격 (Player.takeDamage 내부에서 무적시간 처리)
    // source 좌표는 로봇 펫 GUARD_BURST의 복수 조준용 (PLAYER_DAMAGE payload 경유)
    this.player.takeDamage(m.damage, { x: m.x, y: m.y });
    this.emitPlayerState();
  }

  private handlePlayerGemCollision(
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    gem: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ): void {
    const g = gem as XPGem;
    if (!g.active) return;

    const xp = g.collect();
    this.addXp(xp);
    this.playSfx('sfx_pickup', 0.18);
    // Immediately emit state update so HUD reflects XP gain
    this.emitPlayerState();
  }

  // 자석 아이템 획득: 화면의 모든 수정을 플레이어에게 흡인 (magnet_pulse 보상 카드와 동일 효과)
  private handlePlayerPickupCollision(
    _player: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    pickup: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ): void {
    const item = pickup as MagnetGem;
    if (!item.active) return;

    item.collect();
    this.xpGems.getChildren().forEach((gem) => {
      const g = gem as XPGem;
      if (g.active && !g.isCollecting()) g.startCollection(this.player);
    });
    this.fx.burst('collect', this.player.x, this.player.y);
    this.playSfx('sfx_pickup', 0.4);
  }

  private handleProjectileMonsterCollision(
    projectile: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile,
    monster: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile
  ): void {
    const p = projectile as Phaser.Physics.Arcade.Sprite;
    const m = monster as Monster;

    if (!p.active || !m.active || m.hp <= 0) return;

    // 같은 (projectile, monster) 쌍 중복 충돌 방지: 매 프레임 overlap 콜백이 호출되어
    // 한 발이 동일 몬스터를 여러 번 때리는 현상 차단
    const hitSet: Set<Monster> = (p as any).__hitMonsters || ((p as any).__hitMonsters = new Set<Monster>());
    if (hitSet.has(m)) return;
    hitSet.add(m);

    const damage = (p as any).damage || 10;
    const pierce = (p as any).pierce || 1;

    const killed = m.takeDamage(damage);

    if (killed) {
      this.onMonsterKilled(m);
    }

    // Handle pierce
    const newPierce = pierce - 1;
    if (newPierce <= 0) {
      p.destroy();
    } else {
      (p as any).pierce = newPierce;
    }
  }

  private onMonsterKilled(monster: Monster): void {
    this.monstersKilled++;
    // 점수: 보스 큰 보너스, 일반은 xpValue×5
    const bonusMultiplier = monster.isBoss ? 50 : 5;
    this.score += monster.xpValue * bonusMultiplier;

    // Spawn XP gem based on current wave (not monster xpValue)
    const gem = XPGem.createForWave(this, monster.x, monster.y, this.currentWave);
    this.xpGems.add(gem);

    // 자석 아이템 드랍 (2.5%, 필드에 1개만) — 획득 시 화면의 모든 수정 흡인
    if (Math.random() < 0.025 && this.pickups.countActive(true) === 0) {
      this.pickups.add(new MagnetGem(this, monster.x, monster.y));
    }

    // 최종 보스 처치 = 게임 클리어: 클리어 보너스 +2000 후 사망 연출을 잠깐 보여주고 집계
    if (monster.isFinalBoss) {
      this.score += 2000;
      this.finalBossDefeated = true; // 이후 어떤 종료 경로든 cleared 강제
      this.playSfx('sfx_levelup', 0.6);
      this.time.delayedCall(700, () => this.handleGameOver(true));
      EventBus.emit(GameEvents.MONSTER_KILLED, { total: this.monstersKilled });
      return;
    }

    // 보스 처치 보상: 무조건 1레벨업 (남은 필요 XP를 즉시 충전 → 퀴즈/업그레이드 흐름 진입)
    if (monster.isBoss) {
      this.addXp(Math.max(1, this.xpToNextLevel - this.playerXp));
    }

    EventBus.emit(GameEvents.MONSTER_KILLED, { total: this.monstersKilled });
  }

  private setupEventListeners(): void {
    EventBus.on(GameEvents.PAUSE_GAME, this.pauseGame, this);
    EventBus.on(GameEvents.RESUME_GAME, this.resumeGame, this);
    EventBus.on(GameEvents.UPGRADE_SELECTED, this.handleUpgradeSelected, this);
    EventBus.on(GameEvents.QUIZ_RESULT, this.handleQuizResult, this);
    EventBus.on(GameEvents.GAME_OVER, this.handleGameOver, this);
    EventBus.on(GameEvents.GAME_START, this.resetGame, this);
    // 학생 "그만하기": 즉시 결과 집계 (게임오버와 동일 흐름, 사망 아님)
    EventBus.on(GameEvents.STOP_GAME, this.handleGameOver, this);
    // 문제은행 완주: 진행 중인 퀴즈/강화 흐름이 끝나고 재개되면 종료
    EventBus.on(GameEvents.QUIZ_BANK_EXHAUSTED, this.handleBankExhausted, this);
    // 브금/효과음 on-off 토글 (React HUD → GameScene)
    EventBus.on(GameEvents.SOUND_SETTINGS_CHANGED, this.handleSoundSettingsChanged, this);
    // 탭 이탈 자동 일시정지 복귀: React 일시정지 오버레이 [계속하기] → 3·2·1 보호 재개
    EventBus.on(GameEvents.RESUME_WITH_PROTECTION, this.resumeWithProtection, this);
  }

  private handleBankExhausted(): void {
    this.finishAfterResume = true;
  }

  private handleSoundSettingsChanged(data: { bgm: boolean; sfx: boolean }): void {
    this.sfxEnabled = data.sfx;
    this.bgmEnabled = data.bgm;
    // 러시 중이면 브금 대상은 러시 브금(일반 브금 아님)
    const inRush = this.rushPhase !== 'idle';
    if (this.bgmEnabled) {
      if (inRush) {
        this.startRushBgm();
      } else {
        this.startBgm();
      }
    } else {
      this.stopBgm();
      this.stopRushBgm(false); // 러시 브금도 함께 무음, 일반 브금 복원하지 않음
    }
  }

  private resetGame(): void {
    // 이전 판 무기의 자체 관리 리소스 정리 (예: RobotToy가 그룹 밖에서 직접 들고 있는 로봇 스프라이트)
    this.weaponManager?.destroyAll();

    // Clear all entities
    this.monsters.clear(true, true);
    this.xpGems.clear(true, true);
    this.pickups.clear(true, true);
    this.projectiles.clear(true, true);

    // 이전 판의 배경 장식·정적 장애물 바디 제거 (다음 판으로 남지 않게). decoChunks가
    // 일반 이미지 + solid 정적 이미지를 모두 들고 있으므로 여기서 전부 destroy → 비우고,
    // obstacles 그룹은 안전차원에서 한 번 더 비운다(이미 비어 있음).
    this.decoChunks.forEach((objs) => objs.forEach((o) => o.destroy()));
    this.decoChunks.clear();
    this.obstacles.clear(true, true);

    // Reset state
    this.survivalTime = 0;
    this.currentWave = 1;
    this.monstersKilled = 0;
    this.playerLevel = 1;
    this.playerXp = 0;
    this.xpToNextLevel = GAME_CONFIG.xp.baseToLevel;
    this.score = 0;
    this.spawnTimer = 0;
    this.spawnRotationIndex = 0;
    this.finishAfterResume = false;
    this.finalBossTriggered = false;
    this.finalBossDefeated = false;
    this.gameFinished = false;
    this.stateUpdateTimer = 0;
    this.pendingLevelUp = false;
    this.levelUpQueue = 0;
    this.quizStreak = 0;
    this.isPaused = false;
    this.autoPausedByVisibility = false;

    // 몬스터 러시 상태 전체 초기화 (비네트/배너 제거, 러시 브금 정지, 첫 러시 임계 복원)
    this.resetRushState();

    // Recreate player at center
    if (this.player) {
      this.player.destroy();
    }
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    this.player = new Player(this, centerX, centerY);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Recreate weapon manager and starting weapon
    this.weaponManager = new WeaponManager(this, this.player);
    this.weaponManager.addWeapon('pencil');

    // Re-setup collisions for new player
    this.setupCollisions();

    // Resume physics
    this.physics.resume();

    // Restart BGM
    this.stopBgm();
    this.startBgm();

    this.emitPlayerState();
  }

  // cleared=true면 "게임 클리어"로 집계. 사망/그만하기/완주 경로는 인자 없이 호출되어 false.
  // 최종 보스를 잡았다면(finalBossDefeated) 다른 경로가 먼저 불려도 클리어로 강제.
  private handleGameOver(cleared: boolean = false): void {
    if (this.gameFinished) return; // 중복 집계 방지
    this.gameFinished = true;
    // isPaused를 함께 세워 보스 히트스톱 해제 콜백(isGamePaused 가드)이
    // 게임오버 정지를 30ms 뒤 풀어버리지 않게 한다. resetGame()이 false로 복구.
    this.isPaused = true;
    this.physics.pause();
    this.stopBgm();
    // 러시 중 종료(사망/그만하기/클리어/완주): 러시 브금 정지 + 비네트/배너 트윈 정리
    this.stopRushBgm(false);
    this.clearRushVisuals();
    EventBus.emit(GameEvents.GAME_FINISHED, {
      score: this.score,
      level: this.playerLevel,
      survivalTime: this.survivalTime,
      monstersKilled: this.monstersKilled,
      cleared: cleared === true || this.finalBossDefeated,
    });
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.physics.pause();
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.physics.resume();
  }

  /**
   * 탭/창 비활성화(document.hidden) 자동 일시정지 (Task 4): 실제 활성 플레이 중
   * (퀴즈/강화/재개 카운트다운/게임오버가 아님 — 이미 isPaused거나 gameFinished면 무시)
   * 탭을 벗어나면 즉시 일시정지한다. 복귀 시엔 자동 재개하지 않고 AUTO_PAUSE_SHOW로
   * React에게 알려 "일시정지" 오버레이를 띄우게 하며, 사용자가 [계속하기]를 눌러야
   * RESUME_WITH_PROTECTION 경유로 3·2·1 보호 재개가 이어진다(포위 즉사 방지).
   */
  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      if (!this.isPaused && !this.gameFinished) {
        this.autoPausedByVisibility = true;
        this.pauseGame();
      }
    } else if (this.autoPausedByVisibility) {
      this.autoPausedByVisibility = false;
      EventBus.emit(GameEvents.AUTO_PAUSE_SHOW);
    }
  };

  // 퀴즈/레벨업으로 게임이 일시정지된 상태인지 (Monster 히트스톱·Magnet 등 외부에서 조회)
  isGamePaused(): boolean {
    return this.isPaused;
  }

  private handleUpgradeSelected(data: { type: string; id: string }): void {
    if (data.type === 'weapon') {
      this.weaponManager.addWeapon(data.id as any);
    } else if (data.type === 'passive') {
      this.weaponManager.addPassive(data.id as any);
    } else if (data.type === 'pet') {
      this.weaponManager.addPet(data.id as any);
    } else if (data.type === 'bonus') {
      this.applyBonusCard(data.id);
    }

    // 강화 적용 직후 무기 6종 만렙 완성 여부 검사 → 완성되면 최종 보스 소환
    this.checkWeaponCompletion();

    // 큐에 다음 레벨업이 남아있으면 바로 다음 퀴즈 노출, 아니면 보호 재개
    if (this.levelUpQueue > 0) {
      // 약간의 지연 후 다음 레벨업 처리
      this.time.delayedCall(100, () => {
        this.processNextLevelUp();
      });
    } else {
      this.resumeWithProtection();
    }
  }

  /**
   * 게임 클리어 조건 검사: 무기 슬롯을 전부(6종) 채우고 모두 만렙이면 최종 보스 소환.
   * 강화 적용 직후(handleUpgradeSelected)에 호출. finalBossTriggered로 1회만 발동.
   */
  private checkWeaponCompletion(): void {
    if (this.finalBossTriggered) return;
    const allMax =
      this.weaponManager.getWeaponCount() === GAME_CONFIG.game.maxWeapons &&
      this.weaponManager.getActiveWeapons().every((w) => w.isMaxLevel());
    if (!allMax) return;

    this.finalBossTriggered = true;
    this.triggerFinalBoss();
  }

  /**
   * 최종 보스 등장 연출 + 소환 (설계 클리어 조건): 배너 → 1.8초 뒤 강화 보스 1기.
   * 현재 웨이브(최소 3)의 보스 config를 기반으로 HP·XP ×3, 크기 ×1.5, 보라빛 틴트.
   */
  private triggerFinalBoss(): void {
    this.showFinalBossBanner();

    this.time.delayedCall(1800, () => {
      // 대기 중 사망→재시작(resetGame)하면 타이머가 새 게임으로 새어 들어올 수 있다 —
      // 리셋된 상태(finalBossTriggered=false)나 이미 집계된 상태면 소환하지 않음
      if (!this.player.active || !this.finalBossTriggered || this.gameFinished) return;
      const bossWave = Math.max(this.currentWave, 3);
      const base = getBossConfigForWave(bossWave);
      const config = {
        ...base,
        hp: base.hp * 3,
        xpValue: base.xpValue * 3,
        scale: (base.scale ?? 1.4) * 1.5,
      };

      const angle = Math.random() * Math.PI * 2;
      const dist = 500;
      const x = this.player.x + Math.cos(angle) * dist;
      const y = this.player.y + Math.sin(angle) * dist;

      const boss = new Monster(this, x, y, config);
      boss.isFinalBoss = true;
      boss.persistentTint = 0xb45cff; // 최종 보스 식별용 보라빛 틴트 (피격 후에도 유지)
      boss.setTint(0xb45cff);
      boss.setTarget(this.player);
      this.monsters.add(boss);

      this.cameras.main.shake(500, 0.012);
    });
  }

  /** 최종 보스 등장 배너 (보스 배너보다 크고 금빛 — 절정임을 알림) */
  private showFinalBossBanner(): void {
    const cam = this.cameras.main;
    const banner = this.add
      .text(cam.width / 2, cam.height * 0.3, '최종 보스 등장!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#fde047',
        stroke: '#3b0764',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setAlpha(0)
      .setScale(0.6);

    this.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1200, () => {
          this.tweens.add({
            targets: banner,
            alpha: 0,
            duration: 350,
            onComplete: () => banner.destroy(),
          });
        });
      },
    });
  }

  /** 대체 보상 카드 (설계 §5.3 — 전부 만렙·만슬롯일 때) */
  private applyBonusCard(id: string): void {
    if (id === 'heal') {
      this.player.heal(Math.floor(this.player.maxHp * 0.3));
    } else if (id === 'score') {
      this.score += 500;
    } else if (id === 'magnet_pulse') {
      // 화면의 모든 수정을 플레이어에게 끌어옴
      this.xpGems.getChildren().forEach((gem) => {
        const g = gem as XPGem;
        if (g.active && !g.isCollecting()) g.startCollection(this.player);
      });
    }
    this.emitPlayerState();
  }

  /**
   * 퀴즈 루프 (설계 §6 — 페널티 완화):
   * - 정답: 업그레이드 3택 + 점수 보너스 + 콤보 스트릭 (XP 배율 +5%/연속, 최대 +25%)
   * - 오답/타임아웃: 레벨업 소모(업그레이드 없음)로 단순화 — XP 몰수·레벨 회수 폐지
   */
  private handleQuizResult(data: { correct: boolean; speedBonus?: number }): void {
    if (data.correct) {
      this.score += 50;
      // 정답을 빨리 맞힐수록 커지는 스피드 보너스 (React에서 계산해 전달)
      if (data.speedBonus && data.speedBonus > 0) {
        this.score += data.speedBonus;
      }
      this.quizStreak++;
      this.pendingLevelUp = false;
      this.playSfx('sfx_quiz_correct', 0.45);
      this.playSfx('sfx_levelup', 0.5);
      // 다음 처리는 handleUpgradeSelected에서 (업그레이드 선택 후)
    } else {
      this.playSfx('sfx_quiz_wrong', 0.45);
      this.quizStreak = 0;
      this.pendingLevelUp = false; // 레벨업 소모 — 레벨·XP는 그대로 유지
      this.emitPlayerState();
      // 큐에 남은 레벨업이 있으면 다음 퀴즈, 없으면 보호 재개
      if (this.levelUpQueue > 0) {
        this.time.delayedCall(600, () => {
          this.processNextLevelUp();
        });
      } else {
        this.resumeWithProtection();
      }
    }
  }

  /**
   * 재개 보호 (설계 §6): 3·2·1 카운트다운 → 반경 200px 몬스터 밀쳐내기 +
   * 1.5초 무적 후 물리 재개. 퀴즈 직후 포위 즉사 방지.
   */
  private resumeWithProtection(): void {
    const cam = this.cameras.main;
    const countdownText = this.add
      .text(cam.width / 2, cam.height / 2, '3', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '96px',
        fontStyle: 'bold',
        color: '#fbbf24',
        stroke: '#0a0a0f',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    let count = 3;
    const tick = () => {
      if (count <= 0) {
        countdownText.destroy();
        this.pushbackMonsters(200);
        this.player.setTemporaryInvincible(1500);
        this.resumeGame();
        return;
      }
      countdownText.setText(String(count));
      countdownText.setScale(1.4);
      this.tweens.add({ targets: countdownText, scale: 1, duration: 250, ease: 'Back.easeOut' });
      count--;
      this.time.delayedCall(400, tick);
    };
    tick();
  }

  /** 플레이어 주변 radius 내 몬스터를 바깥으로 밀쳐냄 */
  private pushbackMonsters(radius: number): void {
    this.monsters.getChildren().forEach((monster) => {
      const m = monster as Monster;
      if (!m.active) return;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, m.x, m.y);
      if (dist < radius) {
        const angle = Math.atan2(m.y - this.player.y, m.x - this.player.x);
        const pushDist = radius + 60 - dist;
        m.x += Math.cos(angle) * pushDist;
        m.y += Math.sin(angle) * pushDist;
      }
    });
  }

  update(time: number, delta: number): void {
    if (this.isPaused || !this.player.active) return;

    // Update survival time
    this.survivalTime += delta / 1000;

    // Update background scroll position based on camera
    this.background.setTilePosition(this.cameras.main.scrollX, this.cameras.main.scrollY);

    // 결정적 청크 장식 배치/컬링
    this.updateDecorations();

    // Update player
    this.player.update();

    // Update monsters (특성 타이머는 delta 누적 방식 — 일시정지 중 자동 동결)
    this.monsters.getChildren().forEach((monster) => {
      (monster as Monster).update(delta);
    });

    // Update weapons
    this.weaponManager.update(delta);

    // Update XP gems attraction
    this.updateXpGemAttraction();

    // Spawn monsters
    this.updateMonsterSpawning(delta);

    // 몬스터 러시 이벤트 스케줄/진행 (delta 누적 — 일시정지 중 자동 동결)
    this.updateRushEvent(delta);

    // Cleanup distant entities
    this.cleanupEntities();

    // 문제은행 완주 — 퀴즈/강화 오버레이가 닫히고 재개된 첫 프레임에 결과 집계로 전환
    if (this.finishAfterResume) {
      this.finishAfterResume = false;
      this.handleGameOver();
      return;
    }

    // Emit state updates periodically
    this.stateUpdateTimer += delta;
    if (this.stateUpdateTimer >= 500) {
      this.emitPlayerState();
      this.stateUpdateTimer = 0;
    }
  }

  // ... (updateXpGemAttraction remains the same) ...
  private updateXpGemAttraction(): void {
    const attractRange = this.player.getPickupRange() * 2;

    this.xpGems.getChildren().forEach((gem) => {
      const g = gem as XPGem;
      if (!g.active) return;

      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        g.x,
        g.y
      );

      if (dist < attractRange && !g.isCollecting()) {
        g.startCollection(this.player);
      }

      g.update();
    });
  }

  private updateMonsterSpawning(delta: number): void {
    this.spawnTimer += delta;

    const spawnInterval = Math.max(200, 1000 - this.currentWave * 50);

    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      // 평시 천장 도달 시 스폰만 스킵 (로테이션 인덱스/세트 진급은 spawnMonster 내부에서
      // 처리되므로, 여기서 호출 자체를 막아야 인덱스가 소모되지 않는다)
      if (this.monsters.countActive(true) >= GameScene.NORMAL_SPAWN_MAX_ACTIVE) return;
      this.spawnMonster();
    }
  }

  private spawnMonster(): void {
    // Spawn just outside camera view
    const camera = this.cameras.main;
    const padding = 100; // Extra padding outside camera

    // Random angle and distance from player
    // This creates a circle around the player for spawning, ensuring monsters come from all directions
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    // Distance should be at least half the diagonal of screen + padding
    const minDistance = Math.sqrt(Math.pow(camera.width, 2) + Math.pow(camera.height, 2)) / 2 + padding;
    const distance = minDistance + Phaser.Math.Between(0, 100);

    const x = this.player.x + Math.cos(angle) * distance;
    const y = this.player.y + Math.sin(angle) * distance;

    // 순차 로테이션 스폰: 로스터(15종)를 약한 종부터 차례로 돌고,
    // 한 세트가 끝날 때마다 세트(=wave) 번호가 올라 전체가 강해진다
    const config = getMonsterConfigForRotation(this.spawnRotationIndex);
    this.spawnRotationIndex++;

    const monster = new Monster(this, x, y, config);
    monster.setTarget(this.player);
    this.monsters.add(monster);

    // 세트 완주 → 다음 세트 진급 (+3세트마다 보스)
    if (this.spawnRotationIndex % FULL_ROTATION_LENGTH === 0) {
      this.currentWave++;
      if (isBossWave(this.currentWave)) {
        this.spawnBossWave();
      }
    }
  }

  // 왕관 슬라임 등 소환형 몬스터가 씬 경유로 호출하는 하수인 스폰.
  // 화면 내 몬스터 40기 이상이면 스킵 (물량 폭주 방지)
  public spawnMinion(x: number, y: number): void {
    if (this.isPaused || !this.player.active) return;
    if (this.monsters.countActive(true) >= 40) return;

    const base = getMonsterConfigForWave(this.currentWave);
    const minion = new Monster(this, x, y, {
      ...base,
      spriteKey: MONSTER_WALK_KEYS[0], // 일반 초록 슬라임
      hp: Math.max(1, Math.floor(base.hp * 0.6)),
      xpValue: 1,
      scale: 0.9,
    });
    minion.setTarget(this.player);
    this.monsters.add(minion);

    // 소환 연출: 스폰 팝(스케일 트윈)은 Monster 생성자에 내장 — 여기선 poof만 추가
    this.fx?.poof(x, y);
  }

  private cleanupEntities(): void {
    const cleanupDistance = 2000; // Entities further than this from player are removed
    const playerPos = new Phaser.Math.Vector2(this.player.x, this.player.y);

    // Cleanup monsters
    this.monsters.getChildren().forEach((monster) => {
      const m = monster as Monster;
      if (m.active && Phaser.Math.Distance.BetweenPoints(playerPos, new Phaser.Math.Vector2(m.x, m.y)) > cleanupDistance) {
        m.destroy();
      }
    });

    // Cleanup gems
    this.xpGems.getChildren().forEach((gem) => {
      const g = gem as XPGem;
      if (g.active && Phaser.Math.Distance.BetweenPoints(playerPos, new Phaser.Math.Vector2(g.x, g.y)) > cleanupDistance) {
        g.destroy();
      }
    });

    // Cleanup projectiles (usually handle own destruction, but safety check)
    this.projectiles.getChildren().forEach((proj) => {
      const p = proj as Phaser.Physics.Arcade.Sprite;
      if (p.active && Phaser.Math.Distance.BetweenPoints(playerPos, new Phaser.Math.Vector2(p.x, p.y)) > cleanupDistance) {
        p.destroy();
      }
    });
  }

  // (세트 진급은 spawnMonster의 로테이션 완주 시점에 처리 — 시간 기반 웨이브 폐지)

  private spawnBossWave(): void {
    // Boss wave spawning around player
    // Number of bosses increases with wave (1 boss per 3 waves)
    const bossCount = Math.max(1, Math.floor(this.currentWave / 6));

    // 러시 스케줄러가 "보스 직후 5초 이내"를 회피하도록 발생 시각 기록
    this.lastBossSpawnAt = this.survivalTime;

    this.showBossBanner();

    for (let i = 0; i < bossCount; i++) {
      this.time.delayedCall(i * 800, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 500;
        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;

        // Get boss config based on current wave
        const config = getBossConfigForWave(this.currentWave);

        const monster = new Monster(this, x, y, config);
        monster.setTarget(this.player);
        this.monsters.add(monster);

        // Boss spawn announcement effect
        this.cameras.main.shake(300, 0.01);
      });
    }
  }

  /** 보스 등장 배너 (설계 §3.2 — 카메라 셰이크와 함께 등장을 명확히 알림) */
  private showBossBanner(): void {
    const cam = this.cameras.main;
    const banner = this.add
      .text(cam.width / 2, cam.height * 0.3, '보스 등장!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#fca5a5',
        stroke: '#450a0a',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(101)
      .setAlpha(0)
      .setScale(0.6);

    this.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1,
      duration: 250,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(900, () => {
          this.tweens.add({
            targets: banner,
            alpha: 0,
            duration: 300,
            onComplete: () => banner.destroy(),
          });
        });
      },
    });
  }

  // ===================== 몬스터 러시 이벤트 (Task 7) =====================

  /**
   * 러시 스케줄러/상태머신 (delta 누적, 일시정지 안전).
   * idle → (임계 도달) warning(1.5s) → active(8s, 폭풍 스폰) → idle(재무장).
   * 보스 스폰 직후 5초 이내면 발동을 10초 뒤로 미룬다.
   */
  private updateRushEvent(delta: number): void {
    if (this.rushPhase === 'idle') {
      this.rushTimer += delta;
      if (this.rushTimer >= this.rushTriggerAt) {
        // 보스 직후엔 시작하지 않고 임계만 뒤로 밀어 재시도(카운터는 유지)
        if (this.survivalTime - this.lastBossSpawnAt < 5) {
          this.rushTriggerAt += 10000;
          return;
        }
        this.startRushWarning();
      }
    } else if (this.rushPhase === 'warning') {
      this.rushPhaseTimer += delta;
      if (this.rushPhaseTimer >= GameScene.RUSH_WARNING_MS) {
        this.startRushActive();
      }
    } else if (this.rushPhase === 'active') {
      this.rushPhaseTimer += delta;
      this.rushSpawnTimer += delta;
      if (this.rushSpawnTimer >= GameScene.RUSH_SPAWN_INTERVAL) {
        this.rushSpawnTimer = 0;
        this.spawnRushMonster();
      }
      if (this.rushPhaseTimer >= GameScene.RUSH_ACTIVE_MS) {
        this.endRush();
      }
    }
  }

  /** 경고 페이즈 시작: 배너 + 사이렌 + 붉은 비네트 페이드인 + 급박 브금 전환 */
  private startRushWarning(): void {
    this.rushPhase = 'warning';
    this.rushPhaseTimer = 0;
    this.rushSpawnTimer = 0;

    this.showRushBanner();
    this.playSfx('sfx_rush_warning', 0.5);
    this.cameras.main.shake(400, 0.008);

    // 붉은 비네트 페이드인 (0 → 0.24, 경고 시간에 맞춰)
    this.ensureRushVignette();
    if (this.rushVignette) {
      this.tweens.killTweensOf(this.rushVignette);
      this.rushVignette.setAlpha(0);
      this.tweens.add({
        targets: this.rushVignette,
        alpha: 0.24,
        duration: GameScene.RUSH_WARNING_MS,
        ease: 'Sine.easeIn',
      });
    }

    // 일반 브금 → 급박 러시 브금 (브금 설정 존중)
    this.startRushBgm();
  }

  /** 러시 페이즈 시작: 즉시 물량 버스트 스폰 + 비네트 알파 펄스(요요) 개시 (이후 스폰은 updateRushEvent에서) */
  private startRushActive(): void {
    this.rushPhase = 'active';
    this.rushPhaseTimer = 0;
    this.rushSpawnTimer = 0;

    // 러시 체감을 즉각적으로 만들기 위해 페이즈 시작 순간 몬스터 무더기를 한 번에 스폰
    for (let i = 0; i < GameScene.RUSH_BURST_COUNT; i++) {
      this.spawnRushMonster();
    }

    if (this.rushVignette) {
      this.tweens.killTweensOf(this.rushVignette);
      this.rushVignette.setAlpha(0.20);
      this.tweens.add({
        targets: this.rushVignette,
        alpha: 0.35,
        duration: 650,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }
  }

  /** 러시 종료: 비네트 페이드아웃 + 브금 복원 + 다음 러시 재무장(60–120초) */
  private endRush(): void {
    this.rushPhase = 'idle';
    this.rushTimer = 0;
    this.rushPhaseTimer = 0;
    this.rushSpawnTimer = 0;
    this.rushTriggerAt = Phaser.Math.Between(60000, 120000);

    if (this.rushVignette) {
      this.tweens.killTweensOf(this.rushVignette);
      this.tweens.add({
        targets: this.rushVignette,
        alpha: 0,
        duration: 600,
        ease: 'Sine.easeOut',
      });
    }

    // 급박 브금 정지 → 일반 브금 복원 (설정 존중)
    this.stopRushBgm(true);
  }

  /**
   * 러시 전용 스폰 (spawnRotationIndex 미소모). 현재 로테이션 종류 인덱스 기준
   * max(0, ti-2)..ti 범위(약한 쪽 편향)에서 랜덤 선택, 현재 세트 스탯 유지.
   * 스폰 위치는 spawnMonster처럼 플레이어 주변 링. 물량 상한 RUSH_MAX_ACTIVE(160).
   */
  private spawnRushMonster(): void {
    if (this.monsters.countActive(true) >= GameScene.RUSH_MAX_ACTIVE) return;

    const camera = this.cameras.main;
    const padding = 100;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const minDistance = Math.sqrt(Math.pow(camera.width, 2) + Math.pow(camera.height, 2)) / 2 + padding;
    const distance = minDistance + Phaser.Math.Between(0, 100);
    const x = this.player.x + Math.cos(angle) * distance;
    const y = this.player.y + Math.sin(angle) * distance;

    // 현재 종류 인덱스(spawnRotationIndex 파생) 근처의 약한 쪽 편향 타입
    const currentTypeIndex = Math.floor(this.spawnRotationIndex / SPAWNS_PER_TYPE) % ROTATION_LENGTH;
    const lo = Math.max(0, currentTypeIndex - 2);
    const typeIndex = Phaser.Math.Between(lo, currentTypeIndex);
    // 현재 세트를 유지하는 합성 인덱스로 config 생성 (인덱스 소모 없음 — spawnMinion과 동일한 별도 경로)
    const set0 = Math.floor(this.spawnRotationIndex / FULL_ROTATION_LENGTH); // 0-based 세트
    const synthIndex = set0 * FULL_ROTATION_LENGTH + typeIndex * SPAWNS_PER_TYPE;
    const config = getMonsterConfigForRotation(synthIndex);

    const monster = new Monster(this, x, y, config);
    monster.setTarget(this.player);
    this.monsters.add(monster);
  }

  /** 붉은 비네트 텍스처 생성(1회): 중앙 투명 → 가장자리 붉음 방사형 그라디언트 */
  private createRushVignetteTexture(): void {
    const key = GameScene.RUSH_TEXTURE_KEY;
    if (this.textures.exists(key)) return;

    const w = 512;
    const h = 512;
    const tex = this.textures.createCanvas(key, w, h);
    if (!tex) return;
    const ctx = tex.getContext();
    const cx = w / 2;
    const cy = h / 2;
    // 어두운 초원 위에서도 "붉은 기운"이 체감되도록 중심 가까이까지 그라데이션을 끌어오고
    // 가장자리 농도를 높인다 (알파 0.35 피크 기준으로 시각 튜닝 — 검증 스크린샷 참고)
    const grad = ctx.createRadialGradient(cx, cy, w * 0.12, cx, cy, w * 0.55);
    grad.addColorStop(0, 'rgba(255,30,30,0)');
    grad.addColorStop(0.45, 'rgba(255,20,20,0.30)');
    grad.addColorStop(0.75, 'rgba(230,10,10,0.62)');
    grad.addColorStop(1, 'rgba(180,0,0,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
  }

  /** 비네트 이미지 준비 (풀스크린, 카메라 고정, 데미지 숫자[depth20] 아래) */
  private ensureRushVignette(): void {
    this.createRushVignetteTexture();
    if (this.rushVignette) return;
    const cam = this.cameras.main;
    this.rushVignette = this.add
      .image(cam.width / 2, cam.height / 2, GameScene.RUSH_TEXTURE_KEY)
      .setScrollFactor(0)
      .setDepth(18) // 엔티티/이펙트(≤15) 위, 데미지 숫자(20)·배너(101) 아래
      .setAlpha(0);
    this.rushVignette.setDisplaySize(cam.width, cam.height);
  }

  /** 러시 경고 배너: 붉은 WARNING! + 부제 '몬스터 러시!', 슬라이드 인/아웃 + 공격적 펄스 */
  private showRushBanner(): void {
    const cam = this.cameras.main;
    const title = this.add
      .text(0, -22, 'WARNING!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '58px',
        fontStyle: 'bold',
        color: '#ff2d2d',
        stroke: '#450a0a',
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(0, 34, '몬스터 러시!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#fecaca',
        stroke: '#450a0a',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const targetY = cam.height * 0.28;
    const banner = this.add
      .container(cam.width / 2, targetY - 80, [title, sub])
      .setScrollFactor(0)
      .setDepth(101)
      .setAlpha(0);
    this.rushBanner = banner;

    // 슬라이드 인(위→목표) + 페이드
    this.tweens.add({
      targets: banner,
      y: targetY,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
    // 공격적 펄스 (스케일/알파 요요)
    this.tweens.add({
      targets: banner,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 180,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: 3,
    });
    // 슬라이드 아웃 후 파괴 (경고 시간 종료 즈음)
    this.time.delayedCall(GameScene.RUSH_WARNING_MS - 250, () => {
      if (!this.rushBanner) return;
      this.tweens.add({
        targets: banner,
        y: targetY - 80,
        alpha: 0,
        duration: 250,
        onComplete: () => {
          banner.destroy();
          if (this.rushBanner === banner) this.rushBanner = null;
        },
      });
    });
  }

  /** 급박 러시 브금 시작 (일반 브금 정지 후 대체). 브금 설정 OFF면 무음. */
  private startRushBgm(): void {
    if (!this.bgmEnabled) return;
    this.stopBgm(); // 러시 동안 일반 브금은 대체
    if (this.rushBgm) return;
    if (this.cache.audio.exists('rush_bgm')) {
      this.rushBgm = this.sound.add('rush_bgm', { loop: true, volume: 0.35 });
      this.rushBgm.play();
    }
  }

  /** 러시 브금 정지. resumeNormal=true면 설정에 따라 일반 브금 복원. */
  private stopRushBgm(resumeNormal: boolean): void {
    if (this.rushBgm) {
      this.rushBgm.stop();
      this.rushBgm.destroy();
      this.rushBgm = null;
    }
    if (resumeNormal) this.startBgm(); // startBgm 내부에서 bgmEnabled 체크
  }

  /** 러시 시각 요소(비네트/배너)의 트윈을 죽이고 파괴 — 게임오버/리셋 정리용 */
  private clearRushVisuals(): void {
    if (this.rushVignette) {
      this.tweens.killTweensOf(this.rushVignette);
      this.rushVignette.destroy();
      this.rushVignette = null;
    }
    if (this.rushBanner) {
      this.rushBanner.list.forEach((c) => this.tweens.killTweensOf(c));
      this.tweens.killTweensOf(this.rushBanner);
      this.rushBanner.destroy();
      this.rushBanner = null;
    }
  }

  /** 러시 상태 전체 리셋 (resetGame) — 첫 러시 임계로 되돌림 */
  private resetRushState(): void {
    this.clearRushVisuals();
    this.stopRushBgm(false);
    this.rushPhase = 'idle';
    this.rushTimer = 0;
    this.rushTriggerAt = GameScene.RUSH_FIRST_MS;
    this.rushPhaseTimer = 0;
    this.rushSpawnTimer = 0;
    this.lastBossSpawnAt = -999;
  }

  // ... (addXp, levelUp, getUpgradeInfo, emitPlayerState, public methods, shutdown remain the same) ...
  private addXp(amount: number): void {
    // 금별 스티커(growth) + 콤보 스트릭 (연속 정답당 +5%, 최대 +25%)
    const growthBonus = 1 + this.player.growth;
    const streakBonus = 1 + Math.min(this.quizStreak * 0.05, 0.25);
    this.playerXp += Math.floor(amount * growthBonus * streakBonus);

    // 한 번에 여러 레벨업이 발생할 수 있음 → 큐에 쌓고 1개씩 처리
    while (this.playerXp >= this.xpToNextLevel) {
      this.playerXp -= this.xpToNextLevel;
      this.playerLevel++;
      // 완만한 지수 곡선: 20 × 1.085^(level-1). baseToLevel·multiplier는 젬 소득 곡선에
      // 맞춰 튜닝됨(퀴즈 간격 25~75초, 25분 내 스킬 플레이 시 50레벨 달성) — config.ts 주석 참고.
      this.xpToNextLevel = Math.floor(
        GAME_CONFIG.xp.baseToLevel * Math.pow(GAME_CONFIG.xp.multiplier, this.playerLevel - 1)
      );
      this.levelUpQueue++;
    }

    // 첫 레벨업 처리 시작
    if (this.levelUpQueue > 0 && !this.pendingLevelUp) {
      this.processNextLevelUp();
    }

    EventBus.emit(GameEvents.XP_GAINED, {
      xp: this.playerXp,
      xpToNext: this.xpToNextLevel,
      level: this.playerLevel,
    });
  }

  private processNextLevelUp(): void {
    if (this.levelUpQueue <= 0 || this.pendingLevelUp) return;

    this.levelUpQueue--;
    this.pendingLevelUp = true;

    // Get available upgrades
    const upgrades = this.weaponManager.getAvailableUpgrades(3);

    // Pause and show level up UI
    this.pauseGame();

    EventBus.emit(GameEvents.LEVEL_UP, {
      level: this.playerLevel,
      upgrades: upgrades.map((u) => ({
        ...u,
        ...this.getUpgradeInfo(u.type, u.id),
      })),
    });
  }

  private getUpgradeInfo(type: string, id: string): { name: string; nameKo: string; description: string; descriptionKo: string; currentLevel: number; maxLevel: number } {
    if (type === 'bonus') {
      const bonusInfo = BonusInfoList.find((b) => b.id === id);
      return {
        name: id,
        nameKo: bonusInfo?.nameKo || id,
        description: bonusInfo?.descriptionKo || '',
        descriptionKo: bonusInfo?.descriptionKo || '',
        currentLevel: 0,
        maxLevel: 0,
      };
    }
    if (type === 'pet') {
      const pet = this.weaponManager.getPet(id as any);
      if (pet) {
        const info = pet.getInfo();
        return {
          name: info.name,
          nameKo: info.nameKo,
          description: info.description,
          descriptionKo: info.descriptionKo,
          currentLevel: info.level,
          maxLevel: info.maxLevel,
        };
      }
      // New pet
      const petInfo = PetInfoList.find((p) => p.id === id);
      return {
        name: petInfo?.name || id,
        nameKo: petInfo?.nameKo || id,
        description: petInfo?.description || '',
        descriptionKo: petInfo?.descriptionKo || '',
        currentLevel: 0,
        maxLevel: petInfo?.maxLevel || 8,
      };
    }
    if (type === 'weapon') {
      const weapon = this.weaponManager.getWeapon(id as any);
      if (weapon) {
        const info = weapon.getInfo();
        return {
          name: info.name,
          nameKo: info.nameKo,
          description: info.description,
          descriptionKo: info.descriptionKo,
          currentLevel: info.level,
          maxLevel: info.maxLevel,
        };
      }
      // New weapon
      // WeaponInfoList imported at top of file
      const weaponInfo = WeaponInfoList.find((w: any) => w.id === id);
      return {
        name: weaponInfo?.name || id,
        nameKo: weaponInfo?.nameKo || id,
        description: weaponInfo?.description || '',
        descriptionKo: weaponInfo?.descriptionKo || '',
        currentLevel: 0,
        maxLevel: weaponInfo?.maxLevel || 8,
      };
    } else {
      // PassiveInfoList imported at top of file
      const passiveInfo = PassiveInfoList.find((p: any) => p.id === id);
      return {
        name: passiveInfo?.name || id,
        nameKo: passiveInfo?.nameKo || id,
        description: passiveInfo?.description || '',
        descriptionKo: passiveInfo?.descriptionKo || '',
        currentLevel: this.weaponManager.hasPassive(id as any) ? 1 : 0,
        maxLevel: passiveInfo?.maxLevel || 5,
      };
    }
  }

  private emitPlayerState(): void {
    EventBus.emit(GameEvents.PLAYER_STATE_UPDATE, {
      hp: this.player.currentHp,
      maxHp: this.player.maxHp,
      level: this.playerLevel,
      xp: this.playerXp,
      xpToNext: this.xpToNextLevel,
      score: this.score,
      survivalTime: this.survivalTime,
      wave: this.currentWave,
      monstersKilled: this.monstersKilled,
    });
  }

  // Public methods for weapons to use
  addProjectile(projectile: Phaser.GameObjects.GameObject): void {
    // Phaser PhysicsGroup.add()는 그룹 defaults(velocity 0, bounce 0 등)를 기존 body에도
    // 덮어쓰므로(PhysicsGroup.createCallbackHandler), 무기 코드가 먼저 설정한
    // 속도/바운스를 보존했다가 그룹 등록 후 복원한다.
    const body = (projectile as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body | undefined;
    const vx = body?.velocity.x ?? 0;
    const vy = body?.velocity.y ?? 0;
    const bx = body?.bounce.x ?? 0;
    const by = body?.bounce.y ?? 0;
    this.projectiles.add(projectile);
    if (body) {
      body.setVelocity(vx, vy);
      body.setBounce(bx, by);
    }
    this.triggerFireRecoil(projectile);
  }

  // 발사 반동 (설계 §3.1): 무기 발사 지점(WeaponBase.createProjectile → addProjectile)을
  // 훅으로 사용. 같은 버스트에서 여러 발이 나가도(amount>1) 60ms 내 재호출은 스킵해
  // "버스트당 1회"를 보장. 속도 없는 투사체(궤도형 등)는 조준각을 알 수 없어 스킵.
  private lastRecoilTime: number = 0;
  private triggerFireRecoil(projectile: Phaser.GameObjects.GameObject): void {
    const now = this.time.now;
    if (now - this.lastRecoilTime < 60) return;

    const body = (projectile as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body | undefined;
    if (!body || (Math.abs(body.velocity.x) < 5 && Math.abs(body.velocity.y) < 5)) return;

    this.lastRecoilTime = now;
    const angle = Math.atan2(body.velocity.y, body.velocity.x);
    this.player.recoil(angle);
  }

  getMonsters(): Phaser.Physics.Arcade.Group {
    return this.monsters;
  }

  // 햄스터 펫의 젬 배달(FETCH) 후보 탐색용
  getXpGems(): Phaser.Physics.Arcade.Group {
    return this.xpGems;
  }

  // 도토리 반사용
  getObstacles(): Phaser.Physics.Arcade.StaticGroup {
    return this.obstacles;
  }

  getPlayer(): Player {
    return this.player;
  }

  // SHUTDOWN·DESTROY 둘 다에 배선돼 있어 두 번 불릴 수 있음 — 재진입 가드
  private shutdownDone: boolean = false;

  shutdown(): void {
    if (this.shutdownDone) return;
    this.shutdownDone = true;
    EventBus.off(GameEvents.PAUSE_GAME, this.pauseGame, this);
    EventBus.off(GameEvents.RESUME_GAME, this.resumeGame, this);
    EventBus.off(GameEvents.UPGRADE_SELECTED, this.handleUpgradeSelected, this);
    EventBus.off(GameEvents.QUIZ_RESULT, this.handleQuizResult, this);
    EventBus.off(GameEvents.GAME_OVER, this.handleGameOver, this);
    EventBus.off(GameEvents.GAME_START, this.resetGame, this);
    EventBus.off(GameEvents.STOP_GAME, this.handleGameOver, this);
    EventBus.off(GameEvents.QUIZ_BANK_EXHAUSTED, this.handleBankExhausted, this);
    EventBus.off(GameEvents.SOUND_SETTINGS_CHANGED, this.handleSoundSettingsChanged, this);
    EventBus.off(GameEvents.RESUME_WITH_PROTECTION, this.resumeWithProtection, this);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
