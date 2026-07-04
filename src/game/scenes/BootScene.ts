import Phaser from 'phaser';
import { HERO_IDLE_KEY, MONSTER_WALK_KEYS, BOSS_WALK_KEYS, GEM_KEYS } from '../assetKeys';

interface ManifestAsset {
  id: string;
  file: string;
  kind: 'family' | 'single' | 'strip' | 'image';
  frames: number;
  frame_w: number;
  frame_h: number;
}

interface AssetManifest {
  assets: ManifestAsset[];
}

const MANIFEST_KEY = 'asset_manifest';
const ASSET_DIR = 'assets/generated';

// Deterministic key from a manifest entry (see assetKeys.ts).
function keyForAsset(a: ManifestAsset): string {
  return a.kind === 'strip' ? a.id : a.file.replace(/\.[^.]+$/, '');
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5, 0.5);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
    });
    percentText.setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      percentText.setText(Math.floor(value * 100) + '%');
      progressBar.clear();
      progressBar.fillStyle(0x4ade80, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // Best-effort loader: 파일 없으면 콘솔 워닝만, 게임은 procedural fallback으로 정상 작동
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.type === 'audio') {
        console.warn(`[Audio 미설치] ${file.src} — public/assets/audio/README.md 참고`);
      } else {
        console.warn(`[에셋 로드 실패] ${file.key} (${file.src}) — procedural fallback 사용`);
      }
    });

    // 매니페스트를 먼저 로드하고, 완료되면 그 안의 에셋들을 동적으로 큐잉한다.
    this.load.json(MANIFEST_KEY, `${ASSET_DIR}/manifest.json`);
    this.load.once(`filecomplete-json-${MANIFEST_KEY}`, () => {
      const manifest = this.cache.json.get(MANIFEST_KEY) as AssetManifest | undefined;
      if (manifest?.assets) {
        this.queueManifestAssets(manifest);
      } else {
        console.warn('[매니페스트 없음] 생성 에셋 없이 procedural fallback으로 진행');
      }
    });

    this.loadAudioAssets();
  }

  private queueManifestAssets(manifest: AssetManifest): void {
    for (const asset of manifest.assets) {
      const key = keyForAsset(asset);
      const path = `${ASSET_DIR}/${asset.file}`;
      if (asset.kind === 'strip') {
        this.load.spritesheet(key, path, {
          frameWidth: asset.frame_w,
          frameHeight: asset.frame_h,
        });
      } else {
        this.load.image(key, path);
      }
    }
  }

  private loadAudioAssets(): void {
    // 파일이 없으면 자동으로 무시되므로 안전. 사용자가 자산 추가하면 즉시 작동.
    this.load.audio('bgm', 'assets/audio/bgm.mp3');
    this.load.audio('sfx_monster_hit', 'assets/audio/monster_hit.mp3');
    this.load.audio('sfx_monster_die', 'assets/audio/monster_die.mp3');
    this.load.audio('sfx_player_hit', 'assets/audio/player_hit.mp3');
    // 합성 SFX 4종 (scripts/gen_sfx.py로 생성 — 추후 실제 음원으로 교체 가능)
    this.load.audio('sfx_levelup', 'assets/audio/levelup.wav');
    this.load.audio('sfx_pickup', 'assets/audio/pickup.wav');
    this.load.audio('sfx_quiz_correct', 'assets/audio/quiz_correct.wav');
    this.load.audio('sfx_quiz_wrong', 'assets/audio/quiz_wrong.wav');
  }

  create(): void {
    // Register animation clips for every strip in the manifest.
    this.registerStripAnimations();

    // Safety-net placeholders for critical entity keys + legacy projectile/area sprites.
    this.createCriticalFallbacks();
    this.createPlaceholderSprites();

    console.log('Assets loaded, starting game...');
    this.scene.start('GameScene');
  }

  // strip 에셋마다 프레임 수 기반 anim clip 등록 (Phase 4 상태머신이 재생).
  private registerStripAnimations(): void {
    const manifest = this.cache.json.get(MANIFEST_KEY) as AssetManifest | undefined;
    if (!manifest?.assets) return;

    for (const asset of manifest.assets) {
      if (asset.kind !== 'strip') continue;
      const key = asset.id;
      if (!this.textures.exists(key) || this.anims.exists(key)) continue;

      const isOneShot = key.includes('death');
      const frameRate = key.startsWith('fx_') ? 12 : 8;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: asset.frames - 1 }),
        frameRate,
        repeat: isOneShot ? 0 : -1,
      });
    }
  }

  // 실제 에셋 로드 실패 시에도 게임이 깨지지 않도록 핵심 키에 placeholder 박스를 만든다.
  private createCriticalFallbacks(): void {
    this.ensureBox(HERO_IDLE_KEY, 0x4ade80, 40, 56);
    MONSTER_WALK_KEYS.forEach((k, i) => this.ensureBox(k, 0xc84b31 + i * 0x030201, 44, 40));
    BOSS_WALK_KEYS.forEach((k) => this.ensureBox(k, 0xdc2626, 96, 110));
    this.ensureBox(GEM_KEYS.small, 0x3b82f6, 16, 18);
    this.ensureBox(GEM_KEYS.medium, 0x22d3ee, 20, 22);
    this.ensureBox(GEM_KEYS.large, 0xa855f7, 24, 26);
    this.ensureBox(GEM_KEYS.health, 0xef4444, 24, 22);
    this.ensureBox(GEM_KEYS.magnet, 0xf59e0b, 24, 24);
  }

  private ensureBox(key: string, color: number, w: number, h: number): void {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color & 0xffffff, 1);
    g.fillRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private createPlaceholderSprites(): void {
    // Player sprite (legacy fallback key, still referenced by GameScene texture check)
    if (!this.textures.exists('player')) {
      const playerGraphics = this.make.graphics({ x: 0, y: 0 });
      playerGraphics.fillStyle(0x4ade80);
      playerGraphics.fillRect(0, 0, 32, 32);
      playerGraphics.fillStyle(0x000000);
      playerGraphics.fillRect(8, 10, 6, 6);
      playerGraphics.fillRect(18, 10, 6, 6);
      playerGraphics.fillStyle(0xffffff);
      playerGraphics.fillRect(10, 12, 2, 2);
      playerGraphics.fillRect(20, 12, 2, 2);
      playerGraphics.generateTexture('player', 32, 32);
      playerGraphics.destroy();
    }

    // Fallback monster sprites (for legacy keys)
    this.createMonsterSprite('monster_basic', 0xc84b31, 24);
    this.createMonsterSprite('monster_fast', 0xf4a460, 20);
    this.createMonsterSprite('monster_tank', 0x6b21a8, 32);
    this.createMonsterSprite('monster_boss', 0xdc2626, 48);

    // XP Gem (legacy fallback)
    if (!this.textures.exists('xp_gem')) {
      const gemGraphics = this.make.graphics({ x: 0, y: 0 });
      gemGraphics.fillStyle(0x3b82f6);
      gemGraphics.fillRect(4, 0, 8, 4);
      gemGraphics.fillRect(2, 4, 12, 4);
      gemGraphics.fillRect(0, 8, 16, 4);
      gemGraphics.fillRect(2, 12, 12, 4);
      gemGraphics.fillRect(4, 16, 8, 4);
      gemGraphics.generateTexture('xp_gem', 16, 20);
      gemGraphics.destroy();
    }

    // Weapon projectiles (fallback for legacy/unused weapons that lack dedicated art)
    this.createProjectileSprite('projectile_knife', 0xc0c0c0, 16, 4);
    this.createProjectileSprite('projectile_axe', 0x8b4513, 20, 20);
    this.createProjectileSprite('projectile_cross', 0xffd700, 24, 24);
    this.createProjectileSprite('projectile_fireball', 0xff4500, 12, 12);
    this.createProjectileSprite('projectile_arrow', 0x8b4513, 20, 4);
    this.createProjectileSprite('projectile_bone', 0xf5f5dc, 16, 8);

    // Area effects (fallback)
    this.createAreaSprite('area_garlic', 0x90ee90, 64);
    this.createAreaSprite('area_bible', 0xffd700, 24);
    this.createAreaSprite('area_santa_water', 0x87ceeb, 48);
    this.createAreaSprite('area_lightning', 0xffff00, 16);

    // Whip sprite (fallback)
    if (!this.textures.exists('weapon_whip')) {
      const whipGraphics = this.make.graphics({ x: 0, y: 0 });
      whipGraphics.fillStyle(0x8b4513);
      whipGraphics.fillRect(0, 8, 80, 8);
      whipGraphics.fillStyle(0xa0522d);
      whipGraphics.fillRect(0, 10, 80, 4);
      whipGraphics.generateTexture('weapon_whip', 80, 24);
      whipGraphics.destroy();
    }

    // Magic wand projectile (fallback)
    if (!this.textures.exists('projectile_magic')) {
      const wandGraphics = this.make.graphics({ x: 0, y: 0 });
      wandGraphics.fillStyle(0x9370db);
      wandGraphics.fillCircle(8, 8, 8);
      wandGraphics.fillStyle(0xffffff);
      wandGraphics.fillCircle(6, 6, 3);
      wandGraphics.generateTexture('projectile_magic', 16, 16);
      wandGraphics.destroy();
    }
  }

  private createMonsterSprite(key: string, color: number, size: number): void {
    if (this.textures.exists(key)) return;

    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(color);
    graphics.fillRect(0, 0, size, size);
    // Eyes
    graphics.fillStyle(0xffffff);
    const eyeSize = Math.max(2, size / 8);
    const eyeY = size / 3;
    graphics.fillRect(size / 4, eyeY, eyeSize, eyeSize);
    graphics.fillRect(size * 3 / 4 - eyeSize, eyeY, eyeSize, eyeSize);
    // Mouth
    graphics.fillStyle(0x000000);
    graphics.fillRect(size / 4, size * 2 / 3, size / 2, eyeSize);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }

  private createProjectileSprite(key: string, color: number, width: number, height: number): void {
    if (this.textures.exists(key)) return;

    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(color);
    graphics.fillRect(0, 0, width, height);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  private createAreaSprite(key: string, color: number, size: number): void {
    if (this.textures.exists(key)) return;

    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(color, 0.5);
    graphics.fillCircle(size / 2, size / 2, size / 2);
    graphics.lineStyle(2, color, 1);
    graphics.strokeCircle(size / 2, size / 2, size / 2);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }
}
