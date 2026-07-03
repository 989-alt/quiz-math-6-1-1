import type { Player } from '../entities/Player';

// 어린이 테마 패시브 12종 (설계 §5.1 — VS 복붙 20종 전면 교체, 전부 실제 효과 구현)
export type PassiveId =
  | 'milk' | 'backpack' | 'vitamin' | 'bandage' | 'alarm_clock' | 'reading_glasses'
  | 'slingshot' | 'sneakers' | 'magnet_case' | 'clover' | 'gold_star' | 'cheer_charm';

export interface PassiveInfo {
  id: PassiveId;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  maxLevel: number;
  stat: string;
  valuePerLevel: number;
  isPercentage: boolean;
}

export const PassiveInfoList: PassiveInfo[] = [
  { id: 'milk', name: 'Milk', nameKo: '우유', description: '+10% Damage', descriptionKo: '공격력 +10%', maxLevel: 5, stat: 'damage', valuePerLevel: 0.1, isPercentage: true },
  { id: 'backpack', name: 'Backpack', nameKo: '책가방', description: '+1 Armor', descriptionKo: '방어력 +1', maxLevel: 5, stat: 'armor', valuePerLevel: 1, isPercentage: false },
  { id: 'vitamin', name: 'Vitamin', nameKo: '비타민', description: '+20% Max HP', descriptionKo: '최대 체력 +20%', maxLevel: 5, stat: 'maxHp', valuePerLevel: 0.2, isPercentage: true },
  { id: 'bandage', name: 'Bandage', nameKo: '반창고', description: '+0.2 HP/s', descriptionKo: '초당 체력 회복 +0.2', maxLevel: 5, stat: 'hpRegen', valuePerLevel: 0.2, isPercentage: false },
  { id: 'alarm_clock', name: 'Alarm Clock', nameKo: '알람시계', description: '-8% Cooldown', descriptionKo: '공격 간격 -8%', maxLevel: 5, stat: 'cooldown', valuePerLevel: 0.08, isPercentage: true },
  { id: 'reading_glasses', name: 'Reading Glasses', nameKo: '돋보기안경', description: '+10% Area', descriptionKo: '공격 범위 +10%', maxLevel: 5, stat: 'area', valuePerLevel: 0.1, isPercentage: true },
  { id: 'slingshot', name: 'Slingshot Band', nameKo: '새총 고무줄', description: '+10% Projectile Speed', descriptionKo: '투사체 속도 +10%', maxLevel: 5, stat: 'speed', valuePerLevel: 0.1, isPercentage: true },
  { id: 'sneakers', name: 'Sneakers', nameKo: '운동화', description: '+10% Move Speed', descriptionKo: '이동 속도 +10%', maxLevel: 5, stat: 'moveSpeed', valuePerLevel: 0.1, isPercentage: true },
  { id: 'magnet_case', name: 'Magnet Case', nameKo: '자석 필통', description: '+50% Pickup Range', descriptionKo: '수정 획득 범위 +50%', maxLevel: 5, stat: 'magnet', valuePerLevel: 0.5, isPercentage: true },
  { id: 'clover', name: 'Clover', nameKo: '네잎클로버', description: '+10% Luck (crit)', descriptionKo: '행운 +10% (치명타 확률 +5%)', maxLevel: 5, stat: 'luck', valuePerLevel: 0.1, isPercentage: true },
  { id: 'gold_star', name: 'Gold Star Sticker', nameKo: '금별 스티커', description: '+8% XP Gain', descriptionKo: '경험치 획득 +8%', maxLevel: 5, stat: 'growth', valuePerLevel: 0.08, isPercentage: true },
  { id: 'cheer_charm', name: 'Cheer Charm', nameKo: '응원 부적', description: 'Revive once', descriptionKo: '쓰러져도 한 번 부활 (체력 50%)', maxLevel: 1, stat: 'revival', valuePerLevel: 1, isPercentage: false },
];

export class PassiveManager {
  private player: Player;
  private passives: Map<PassiveId, number> = new Map();
  private maxPassives: number = 6;

  constructor(player: Player) {
    this.player = player;
  }

  addPassive(id: PassiveId): boolean {
    if (this.passives.has(id)) {
      return this.upgradePassive(id);
    }

    if (this.passives.size >= this.maxPassives) {
      return false;
    }

    const info = PassiveInfoList.find((p) => p.id === id);
    if (!info) return false;

    this.passives.set(id, 1);
    this.applyPassiveEffect(info, 1);
    return true;
  }

  upgradePassive(id: PassiveId): boolean {
    const currentLevel = this.passives.get(id);
    if (currentLevel === undefined) return false;

    const info = PassiveInfoList.find((p) => p.id === id);
    if (!info) return false;

    if (currentLevel >= info.maxLevel) return false;

    const newLevel = currentLevel + 1;
    this.passives.set(id, newLevel);
    this.applyPassiveEffect(info, 1); // Apply one more level
    return true;
  }

  private applyPassiveEffect(info: PassiveInfo, levels: number): void {
    const totalValue = info.valuePerLevel * levels;
    this.player.applyStat(info.stat, totalValue, info.isPercentage);
  }

  hasPassive(id: PassiveId): boolean {
    return this.passives.has(id);
  }

  getPassiveLevel(id: PassiveId): number {
    return this.passives.get(id) ?? 0;
  }

  isMaxLevel(id: PassiveId): boolean {
    const level = this.passives.get(id);
    if (level === undefined) return false;

    const info = PassiveInfoList.find((p) => p.id === id);
    return info ? level >= info.maxLevel : false;
  }

  getPassiveCount(): number {
    return this.passives.size;
  }

  getMaxPassives(): number {
    return this.maxPassives;
  }

  getActivePassives(): Array<{ id: PassiveId; level: number; maxLevel: number }> {
    const result: Array<{ id: PassiveId; level: number; maxLevel: number }> = [];

    this.passives.forEach((level, id) => {
      const info = PassiveInfoList.find((p) => p.id === id);
      if (info) {
        result.push({ id, level, maxLevel: info.maxLevel });
      }
    });

    return result;
  }

  getAvailablePassives(): PassiveId[] {
    return PassiveInfoList
      .filter((p) => !this.passives.has(p.id))
      .map((p) => p.id);
  }
}
