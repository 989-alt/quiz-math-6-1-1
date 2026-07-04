import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Monster, MonsterTypes, getMonsterConfigForWave, getBossConfigForWave, isBossWave } from '../entities/Monster';
import { XPGem } from '../entities/XPGem';
import { WeaponManager, WeaponInfoList, BonusInfoList } from '../weapons/WeaponManager';
import { PassiveInfoList } from '../weapons/PassiveManager';
import { EventBus, GameEvents } from '../utils/EventBus';
import { GAME_CONFIG } from '../config';
import { GROUND_TILE_KEY } from '../assetKeys';

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
  private projectiles!: Phaser.Physics.Arcade.Group;
  private weaponManager!: WeaponManager;

  private survivalTime: number = 0;
  private currentWave: number = 1;
  private monstersKilled: number = 0;
  private playerLevel: number = 1;
  private playerXp: number = 0;
  private xpToNextLevel: number = GAME_CONFIG.xp.baseToLevel;
  private score: number = 0;
  private quizStreak: number = 0; // 연속 정답 (XP 배율 +5%/스택, 최대 +25%)

  private isPaused: boolean = false;
  private spawnTimer: number = 0;
  private waveTimer: number = 0;
  private stateUpdateTimer: number = 0;
  private pendingLevelUp: boolean = false; // Track if level up is waiting for quiz
  private levelUpQueue: number = 0; // Stacked level ups awaiting quiz processing
  private bgm: Phaser.Sound.BaseSound | null = null;

  private background!: Phaser.GameObjects.TileSprite;
  // 결정적 청크 장식: "cx,cy" → 그 청크에 배치된 deco 이미지들
  private decoChunks: Map<string, Phaser.GameObjects.Image[]> = new Map();
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
    this.projectiles = this.physics.add.group();

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

    // Setup event listeners
    this.setupEventListeners();

    // Start BGM (loop)
    this.startBgm();

    // Emit game ready
    EventBus.emit(GameEvents.GAME_READY);

    // Initial state update
    this.emitPlayerState();
  }

  // 외부 호출용 SFX 헬퍼 (Monster, Player에서 사용)
  playSfx(key: string, volume = 0.4): void {
    if (this.cache.audio.exists(key)) {
      this.sound.play(key, { volume });
    }
  }

  private startBgm(): void {
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

    // 범위 밖 청크 컬링
    for (const [key, imgs] of this.decoChunks) {
      if (!needed.has(key)) {
        imgs.forEach((im) => im.destroy());
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

  private placeDeco(
    decoKey: string,
    px: number,
    py: number,
    rand: () => number,
    imgs: Phaser.GameObjects.Image[]
  ): void {
    if (!this.textures.exists(decoKey)) return;
    const img = this.add.image(px, py, decoKey);
    img.setScale(0.85 + rand() * 0.4);
    img.setAlpha(0.95);
    if (rand() < 0.5) img.setFlipX(true); // 좌우 뒤집기로 반복감 감소
    // y가 클수록(아래=가까움) 위에 그려 겹침을 자연스럽게. 엔티티(depth≥2) 아래 유지.
    img.setDepth(1 + (((py % 100000) + 100000) % 100000) / 1e8);
    imgs.push(img);
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
    const imgs: Phaser.GameObjects.Image[] = [];

    // ① 희소 랜드마크
    if (rand() < 0.08) {
      const lm = GameScene.DECO_LANDMARKS[Math.floor(rand() * GameScene.DECO_LANDMARKS.length)];
      this.placeDeco(lm, baseX + (0.2 + rand() * 0.6) * CHUNK, baseY + (0.2 + rand() * 0.6) * CHUNK, rand, imgs);
    }

    // ② 작은 잡초·바위 군집
    const densityRoll = rand();
    const clusters = densityRoll < 0.25 ? 0 : densityRoll < 0.7 ? 1 : 2;
    for (let c = 0; c < clusters; c++) {
      const ccx = baseX + rand() * CHUNK;
      const ccy = baseY + rand() * CHUNK;
      const n = 1 + Math.floor(rand() * 3); // 군집당 1–3개
      for (let i = 0; i < n; i++) {
        const ox = (rand() - 0.5) * 140;
        const oy = (rand() - 0.5) * 140;
        this.placeDeco(this.pickWeightedDeco(rand), ccx + ox, ccy + oy, rand, imgs);
      }
    }

    this.decoChunks.set(key, imgs);
  }

  // ... (setupCollisions, handlePlayerMonsterCollision, etc. remain the same) ...
  private setupCollisions(): void {
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
    this.player.takeDamage(m.damage);
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

    EventBus.emit(GameEvents.MONSTER_KILLED, { total: this.monstersKilled });
  }

  private setupEventListeners(): void {
    EventBus.on(GameEvents.PAUSE_GAME, this.pauseGame, this);
    EventBus.on(GameEvents.RESUME_GAME, this.resumeGame, this);
    EventBus.on(GameEvents.UPGRADE_SELECTED, this.handleUpgradeSelected, this);
    EventBus.on(GameEvents.QUIZ_RESULT, this.handleQuizResult, this);
    EventBus.on(GameEvents.GAME_OVER, this.handleGameOver, this);
    EventBus.on(GameEvents.GAME_START, this.resetGame, this);
  }

  private resetGame(): void {
    // Clear all entities
    this.monsters.clear(true, true);
    this.xpGems.clear(true, true);
    this.projectiles.clear(true, true);

    // Reset state
    this.survivalTime = 0;
    this.currentWave = 1;
    this.monstersKilled = 0;
    this.playerLevel = 1;
    this.playerXp = 0;
    this.xpToNextLevel = GAME_CONFIG.xp.baseToLevel;
    this.score = 0;
    this.spawnTimer = 0;
    this.waveTimer = 0;
    this.stateUpdateTimer = 0;
    this.pendingLevelUp = false;
    this.levelUpQueue = 0;
    this.quizStreak = 0;
    this.isPaused = false;

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

  private handleGameOver(): void {
    this.physics.pause();
    this.stopBgm();
    EventBus.emit(GameEvents.GAME_FINISHED, {
      score: this.score,
      level: this.playerLevel,
      survivalTime: this.survivalTime,
      monstersKilled: this.monstersKilled,
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

  private handleUpgradeSelected(data: { type: string; id: string }): void {
    if (data.type === 'weapon') {
      this.weaponManager.addWeapon(data.id as any);
    } else if (data.type === 'passive') {
      this.weaponManager.addPassive(data.id as any);
    } else if (data.type === 'bonus') {
      this.applyBonusCard(data.id);
    }

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
  private handleQuizResult(data: { correct: boolean }): void {
    if (data.correct) {
      this.score += 50;
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

    // Update monsters
    this.monsters.getChildren().forEach((monster) => {
      (monster as Monster).update();
    });

    // Update weapons
    this.weaponManager.update(delta);

    // Update XP gems attraction
    this.updateXpGemAttraction();

    // Spawn monsters
    this.updateMonsterSpawning(delta);

    // Cleanup distant entities
    this.cleanupEntities();

    // Update wave
    this.updateWave(delta);

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
      this.spawnMonster();
      this.spawnTimer = 0;
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

    // Get monster config based on current wave
    const config = getMonsterConfigForWave(this.currentWave);

    const monster = new Monster(this, x, y, config);
    monster.setTarget(this.player);
    this.monsters.add(monster);
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

  private updateWave(delta: number): void {
    this.waveTimer += delta;

    const waveDuration = GAME_CONFIG.waves.baseDuration * 1000;

    if (this.waveTimer >= waveDuration) {
      this.currentWave++;
      this.waveTimer = 0;

      // Spawn boss every 3 waves
      if (isBossWave(this.currentWave)) {
        this.spawnBossWave();
      }
    }
  }

  private spawnBossWave(): void {
    // Boss wave spawning around player
    // Number of bosses increases with wave (1 boss per 3 waves)
    const bossCount = Math.max(1, Math.floor(this.currentWave / 6));

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
    this.projectiles.add(projectile);
  }

  getMonsters(): Phaser.Physics.Arcade.Group {
    return this.monsters;
  }

  getPlayer(): Player {
    return this.player;
  }

  shutdown(): void {
    EventBus.off(GameEvents.PAUSE_GAME, this.pauseGame, this);
    EventBus.off(GameEvents.RESUME_GAME, this.resumeGame, this);
    EventBus.off(GameEvents.UPGRADE_SELECTED, this.handleUpgradeSelected, this);
    EventBus.off(GameEvents.QUIZ_RESULT, this.handleQuizResult, this);
    EventBus.off(GameEvents.GAME_OVER, this.handleGameOver, this);
  }
}
