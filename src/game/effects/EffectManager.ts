import Phaser from 'phaser';

// 이펙트 시트 9종 (설계 §2.6/§3.4) → anim 키는 매니페스트 id와 동일 (BootScene에서 등록).
const HIT_SPARK_KEYS = { small: 'fx_hit_spark_small', large: 'fx_hit_spark_big' } as const;
const DEATH_POOF_KEY = 'fx_death_poof';
const BURST_KEYS: Record<string, string> = {
  explosion: 'fx_explosion',
  splash: 'fx_splash',
  burn: 'fx_burn',
  levelup: 'fx_levelup',
  heal: 'fx_heal',
  collect: 'fx_collect',
  plane_explosion: 'fx_plane_explosion',
};

const HIT_POOL_SIZE = 10;
const POOF_POOL_SIZE = 8;
const BURST_POOL_SIZE = 4;
const EFFECT_DEPTH = 15;

// 파티클/임팩트 스프라이트를 생성 시점에 미리 만들어 재사용하는 풀 (크롬북 GC 스파이크 방지).
export class EffectManager {
  private scene: Phaser.Scene;
  private pools: Map<string, Phaser.GameObjects.Sprite[]> = new Map();
  private cursors: Map<string, number> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createPool(HIT_SPARK_KEYS.small, HIT_POOL_SIZE);
    this.createPool(HIT_SPARK_KEYS.large, HIT_POOL_SIZE);
    this.createPool(DEATH_POOF_KEY, POOF_POOL_SIZE);
    for (const key of Object.values(BURST_KEYS)) {
      this.createPool(key, BURST_POOL_SIZE);
    }
  }

  hit(x: number, y: number, size: 'small' | 'large'): void {
    this.playFromPool(HIT_SPARK_KEYS[size], x, y);
  }

  poof(x: number, y: number): void {
    this.playFromPool(DEATH_POOF_KEY, x, y);
  }

  burst(kind: string, x: number, y: number): void {
    const key = BURST_KEYS[kind];
    if (!key) return;
    this.playFromPool(key, x, y);
  }

  private createPool(animKey: string, size: number): void {
    if (!this.scene.textures.exists(animKey)) return;
    const sprites: Phaser.GameObjects.Sprite[] = [];
    for (let i = 0; i < size; i++) {
      const sprite = this.scene.add.sprite(0, 0, animKey);
      sprite.setDepth(EFFECT_DEPTH);
      sprite.setActive(false).setVisible(false);
      sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        sprite.setActive(false).setVisible(false);
      });
      sprites.push(sprite);
    }
    this.pools.set(animKey, sprites);
    this.cursors.set(animKey, 0);
  }

  private playFromPool(animKey: string, x: number, y: number): void {
    const pool = this.pools.get(animKey);
    if (!pool || pool.length === 0) return;
    const cursor = this.cursors.get(animKey) ?? 0;
    const sprite = pool[cursor];
    this.cursors.set(animKey, (cursor + 1) % pool.length);
    sprite.setPosition(x, y);
    sprite.setActive(true).setVisible(true);
    if (this.scene.anims.exists(animKey)) {
      sprite.play(animKey);
    }
  }
}
