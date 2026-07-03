import Phaser from 'phaser';

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

    // Best-effort loader: 파일 없으면 콘솔 워닝만, 게임은 정상 작동
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.type === 'audio') {
        console.warn(`[Audio 미설치] ${file.src} — public/assets/audio/README.md 참고`);
      } else if (file.key === 'bg_fantasy_pixel') {
        console.info(`[배경 이미지 미설치] procedural 픽셀 배경 사용 중. 교체하려면 public/assets/background/README.md 참고`);
      }
    });

    // Load actual image assets
    this.loadActualAssets();
    this.loadAudioAssets();
    this.loadBackgroundAssets();
  }

  private loadBackgroundAssets(): void {
    // 외부 픽셀 아트 배경 이미지 (선택). 없으면 procedural fallback 자동 사용
    this.load.image('bg_fantasy_pixel', 'assets/background/fantasy_pixel.png');
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

  private loadActualAssets(): void {
    // Character assets
    this.load.image('player_idle', 'assets/character/player_idle.png');
    this.load.image('player_walk', 'assets/character/player_walk_1.png');
    this.load.image('player_dead', 'assets/character/player_dead.png');

    // Monster assets (15 regular monsters)
    for (let i = 1; i <= 15; i++) {
      this.load.image(`monster_${i}`, `assets/monster/monster_${i}.png`);
    }

    // Boss assets (5 bosses)
    for (let i = 1; i <= 5; i++) {
      this.load.image(`boss_${i}`, `assets/monster/boss_${i}.png`);
    }

    // Weapon assets
    const weapons = [
      'banana', 'acorn', 'pencil', 'paper_plane', 'marble', 'snowball', 'leaf',
      'ruler', 'eraser', 'crayon', 'lunch_box', 'bubble', 'hamster', 'butterfly',
      'rainbow', 'star', 'magnet', 'magnifying_glass'
    ];
    weapons.forEach(weapon => {
      this.load.image(`weapon_${weapon}`, `assets/weapon/weapon_${weapon}.png`);
    });
    // Special cases with different naming
    this.load.image('weapon_robot_toy', 'assets/weapon/weapon_robot.png');
    this.load.image('weapon_water_balloon', 'assets/weapon/water_balloon.png');

    // Gem assets
    this.load.image('gem_small', 'assets/gem/gem_small.png');
    this.load.image('gem_middle', 'assets/gem/gem_middle.png');
    this.load.image('gem_large', 'assets/gem/gem_large.png');
    this.load.image('gem_health', 'assets/gem/gem_health.png');
    this.load.image('gem_magnet', 'assets/gem/gem_magnet.png');
  }

  create(): void {
    // Create placeholder sprites for fallback (in case images fail to load)
    this.createPlaceholderSprites();
    console.log('Assets loaded, starting game...');

    this.scene.start('GameScene');
  }

  private createPlaceholderSprites(): void {
    // Player sprite (fallback - 32x32, green square with eyes)
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

    // XP Gem (fallback)
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

    // Weapon projectiles (fallback)
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
