export interface WeaponStats {
  damage: number;
  cooldown: number;
  area: number;
  speed: number;
  duration: number;
  amount: number;
  pierce: number;
  knockback: number;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  icon: string;
  maxLevel: number;
  baseStats: WeaponStats;
  levelUpgrades: Partial<WeaponStats>[];
  evolutionPair?: string;
  evolvedForm?: string;
}

export interface PassiveDefinition {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  icon: string;
  maxLevel: number;
  effects: PassiveEffect[];
}

export interface PassiveEffect {
  stat: keyof PlayerStats;
  value: number;
  isPercentage: boolean;
}

export interface PlayerStats {
  maxHp: number;
  hpRegen: number;
  armor: number;
  moveSpeed: number;
  damage: number;
  area: number;
  speed: number;
  duration: number;
  amount: number;
  cooldown: number;
  luck: number;
  growth: number;
  greed: number;
  magnet: number;
  revival: number;
  critChance: number;
  critDamage: number;
}

export interface EvolutionRecipe {
  weaponId: string;
  passiveId: string;
  resultId: string;
  resultName: string;
  resultNameKo: string;
}

export const WEAPON_IDS = [
  'whip', 'magic_wand', 'knife', 'axe', 'cross',
  'king_bible', 'fire_wand', 'garlic', 'santa_water', 'runetracer',
  'lightning', 'pentagram', 'peachone', 'ebony_wings', 'phiera',
  'gatti', 'song', 'arrow', 'bone', 'cherry'
] as const;

export const PASSIVE_IDS = [
  'spinach', 'armor', 'hollow_heart', 'pummarola', 'empty_tome',
  'candelabrador', 'bracer', 'spellbinder', 'duplicator', 'wings',
  'attractorb', 'clover', 'crown', 'stone_mask', 'skull',
  'silver_ring', 'gold_ring', 'metaglio_left', 'metaglio_right', 'tiragisu'
] as const;

export type WeaponId = typeof WEAPON_IDS[number];
export type PassiveId = typeof PASSIVE_IDS[number];
