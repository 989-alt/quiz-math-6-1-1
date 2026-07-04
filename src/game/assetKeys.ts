// Deterministic Phaser texture-key mapping for the Phase 3 generated pixel-art assets.
// Keys mirror the manifest (public/assets/generated/manifest.json):
//   - strips → key = manifest `id`      (e.g. 'hero_idle', 'slime_green_walk')
//   - family/single/image → key = file basename without extension (e.g. 'weapon_pencil')
// Entities reference these small tables instead of hardcoding per-asset strings everywhere.

export const HERO_IDLE_KEY = 'hero_idle';

// 15 regular monsters (walk spritesheets), grouped slime / flying / beast / elite.
export const MONSTER_WALK_KEYS = [
  'slime_green_walk', 'slime_blue_walk', 'slime_red_walk', 'slime_elite_walk',
  'bat_walk', 'wasp_walk', 'ghost_walk', 'crow_walk',
  'boar_walk', 'wolf_walk', 'badger_walk', 'fox_walk',
  'elite_knight_walk', 'elite_mage_walk', 'elite_crowned_walk',
] as const;

// 5 bosses (walk spritesheets).
export const BOSS_WALK_KEYS = [
  'boss_slime_king_walk', 'boss_orc_chief_walk', 'boss_ghost_lord_walk',
  'boss_giant_bat_walk', 'boss_golem_walk',
] as const;

// Collectibles (family singles, keyed by file basename).
export const GEM_KEYS = {
  small: 'xp_gem_small',
  medium: 'xp_gem_mid',
  large: 'xp_gem_large',
  health: 'heal_heart',
  magnet: 'magnet_item',
} as const;

// 10 environment decorations (family singles, keyed by file basename).
export const DECO_KEYS = [
  'deco_rock', 'deco_mushrooms', 'deco_stump', 'deco_rune_stone', 'deco_flower_bush',
  'deco_fallen_log', 'deco_crystals', 'deco_bush', 'deco_signpost', 'deco_pond',
] as const;

// Solid decorations that block movement (get static physics bodies at their base
// footprint). Everything else (deco_mushrooms / deco_flower_bush / deco_bush) is soft
// vegetation and stays walk-through.
export const DECO_SOLID_KEYS: ReadonlySet<string> = new Set<string>([
  'deco_rock', 'deco_stump', 'deco_fallen_log', 'deco_rune_stone',
  'deco_crystals', 'deco_signpost', 'deco_pond',
]);

export const GROUND_TILE_KEY = 'ground_tile';
