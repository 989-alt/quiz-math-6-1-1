import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Monster, MonsterTypes, getMonsterConfigForWave, getBossConfigForWave, isBossWave } from '../entities/Monster';
import { XPGem } from '../entities/XPGem';
import { WeaponManager, WeaponInfoList, BonusInfoList } from '../weapons/WeaponManager';
import { PassiveInfoList } from '../weapons/PassiveManager';
import { EventBus, GameEvents } from '../utils/EventBus';
import { GAME_CONFIG } from '../config';

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
  private mistLayer: Phaser.GameObjects.Image[] = [];

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
    // 외부 픽셀 아트 이미지가 로드되어 있으면 우선 사용, 없으면 procedural
    const tileKey = this.textures.exists('bg_fantasy_pixel')
      ? 'bg_fantasy_pixel'
      : this.generateFantasyPixelTexture();

    this.background = this.add.tileSprite(
      0, 0,
      this.scale.width,
      this.scale.height,
      tileKey
    );
    this.background.setOrigin(0, 0);
    this.background.setScrollFactor(0); // Fix to camera
    this.background.setDepth(-10);

    // 이음매 가림용 안개 오버레이 (천천히 부유)
    this.createMistOverlay();

    // Resize background on window resize
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.background.setSize(gameSize.width, gameSize.height);
    });
  }

  private createMistOverlay(): void {
    // 부드러운 cloud 텍스처 생성 (다중 fillCircle alpha 누적으로 가장자리 페이드)
    if (!this.textures.exists('mist_cloud')) {
      const size = 256;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      const cx = size / 2;
      const cy = size / 2;
      const maxR = size / 2;
      // 외곽 → 중심으로 갈수록 alpha 누적되어 진해짐
      for (let r = maxR; r > 0; r -= 2) {
        const t = r / maxR;
        const alpha = (1 - t) * 0.06;
        g.fillStyle(0xffffff, alpha);
        g.fillCircle(cx, cy, r);
      }
      g.generateTexture('mist_cloud', size, size);
      g.destroy();
    }

    // 기존 안개 정리 (resetGame 시)
    this.mistLayer.forEach((m) => m.destroy());
    this.mistLayer = [];

    // 화면을 덮는 안개 구름 8개 (보라/시안 톤)
    const mistColors = [0x4c1d95, 0x6366f1, 0x22d3ee, 0x8b5cf6, 0x312e81];
    const w = this.scale.width;
    const h = this.scale.height;
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const mist = this.add.image(x, y, 'mist_cloud');
      mist.setScale(2.5 + Math.random() * 2.0);
      mist.setAlpha(0.35);
      mist.setTint(mistColors[i % mistColors.length]);
      mist.setBlendMode(Phaser.BlendModes.SCREEN); // 더 자연스러운 글로우
      mist.setScrollFactor(0); // 카메라에 고정 — 이음매가 카메라 밖으로 안 흘러감
      mist.setDepth(-5); // 배경 위, 게임 객체 아래
      this.mistLayer.push(mist);

      // 천천히 부유 (오랜 주기)
      const driftX = (Math.random() - 0.5) * 200;
      const driftY = (Math.random() - 0.5) * 150;
      this.tweens.add({
        targets: mist,
        x: x + driftX,
        y: y + driftY,
        duration: 14000 + Math.random() * 10000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      // 알파 펄스
      this.tweens.add({
        targets: mist,
        alpha: 0.2 + Math.random() * 0.25,
        duration: 6000 + Math.random() * 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private generateFantasyPixelTexture(): string {
    const tileKey = 'fantasy-pixel-bg';
    if (this.textures.exists(tileKey)) return tileKey;

    const tileSize = 512;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // 1) 어두운 보라→네이비 수직 그라데이션 (4px 단위로 줄 그어 grad 흉내)
    for (let y = 0; y < tileSize; y += 4) {
      const t = y / tileSize;
      const r = Math.floor(13 + t * 6);
      const gC = Math.floor(10 + t * 4);
      const b = Math.floor(28 + t * 22);
      const color = (r << 16) | (gC << 8) | b;
      g.fillStyle(color, 1);
      g.fillRect(0, y, tileSize, 4);
    }

    // 2) 작은 픽셀 격자 도트 (옅은 보라)
    for (let x = 8; x < tileSize; x += 16) {
      for (let y = 8; y < tileSize; y += 16) {
        g.fillStyle(0x4c1d95, 0.22);
        g.fillRect(x, y, 1, 1);
      }
    }

    // 결정적 의사난수 (렌더 안정성)
    let seed = 1337;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // 3) 픽셀 별 ~120개 (다양한 크기, 색)
    const starColors = [0xffffff, 0xc4b5fd, 0x67e8f9, 0xfde68a, 0xfca5a5];
    for (let i = 0; i < 120; i++) {
      const x = Math.floor(rand() * tileSize);
      const y = Math.floor(rand() * tileSize);
      const r = rand();
      const size = r < 0.65 ? 1 : (r < 0.92 ? 2 : 3);
      const alpha = 0.45 + rand() * 0.5;
      const color = starColors[Math.floor(rand() * starColors.length)];
      g.fillStyle(color, alpha);
      g.fillRect(x, y, size, size);
    }

    // 4) 십자 모양 빛나는 큰 별 (8개)
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(rand() * (tileSize - 8)) + 4;
      const y = Math.floor(rand() * (tileSize - 8)) + 4;
      // 중심
      g.fillStyle(0xffffff, 0.95);
      g.fillRect(x, y, 1, 1);
      // 십자 1px
      g.fillStyle(0xffffff, 0.7);
      g.fillRect(x - 1, y, 1, 1);
      g.fillRect(x + 1, y, 1, 1);
      g.fillRect(x, y - 1, 1, 1);
      g.fillRect(x, y + 1, 1, 1);
      // 외곽 페이드
      g.fillStyle(0xc4b5fd, 0.35);
      g.fillRect(x - 2, y, 1, 1);
      g.fillRect(x + 2, y, 1, 1);
      g.fillRect(x, y - 2, 1, 1);
      g.fillRect(x, y + 2, 1, 1);
    }

    // 5) 글로우 (보라/시안 부드러운 원, 안개 효과)
    const glowColors = [0x6366f1, 0x8b5cf6, 0x22d3ee, 0xa78bfa];
    for (let i = 0; i < 7; i++) {
      const cx = Math.floor(rand() * tileSize);
      const cy = Math.floor(rand() * tileSize);
      const baseR = 16 + Math.floor(rand() * 24);
      const color = glowColors[Math.floor(rand() * glowColors.length)];
      // 다중 원으로 부드러운 그라데이션 흉내
      g.fillStyle(color, 0.04);
      g.fillCircle(cx, cy, baseR);
      g.fillStyle(color, 0.06);
      g.fillCircle(cx, cy, baseR * 0.7);
      g.fillStyle(color, 0.09);
      g.fillCircle(cx, cy, baseR * 0.4);
    }

    // 6) 픽셀 마법 룬 — 다이아몬드 형태 4개 (코너 분산)
    const drawDiamondRune = (cx: number, cy: number, scale: number, color: number) => {
      g.fillStyle(color, 0.3);
      // 다이아몬드(◆) 모양 픽셀
      const offsets = [
        [0, -3],
        [-1, -2], [0, -2], [1, -2],
        [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
        [-3, 0], [-2, 0], [-1, 0], [1, 0], [2, 0], [3, 0],
        [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
        [-1, 2], [0, 2], [1, 2],
        [0, 3],
      ];
      for (const [dx, dy] of offsets) {
        g.fillRect(cx + dx * scale, cy + dy * scale, scale, scale);
      }
      // 중심 강조
      g.fillStyle(0xffffff, 0.6);
      g.fillRect(cx, cy, scale, scale);
    };
    drawDiamondRune(72, 80, 1, 0xa78bfa);
    drawDiamondRune(tileSize - 88, 96, 1, 0x67e8f9);
    drawDiamondRune(96, tileSize - 104, 1, 0xfde68a);
    drawDiamondRune(tileSize - 72, tileSize - 80, 1, 0xa78bfa);

    g.generateTexture(tileKey, tileSize, tileSize);
    g.destroy();
    return tileKey;
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
