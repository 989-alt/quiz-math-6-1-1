import type { GameScene } from '../scenes/GameScene';
import type { Player } from '../entities/Player';
import { WeaponBase } from './WeaponBase';

// Import all weapons - Child-friendly theme (학용품/자연)
import { Banana } from './weapons/Banana';
import { Acorn } from './weapons/Acorn';
import { Pencil } from './weapons/Pencil';
import { PaperPlane } from './weapons/PaperPlane';
import { Marble } from './weapons/Marble';
import { Snowball } from './weapons/Snowball';
import { Leaf } from './weapons/Leaf';
import { Ruler } from './weapons/Ruler';
import { Eraser } from './weapons/Eraser';
import { Crayon } from './weapons/Crayon';
import { LunchBox } from './weapons/LunchBox';
import { Bubble } from './weapons/Bubble';
import { WaterBalloon } from './weapons/WaterBalloon';
import { Hamster } from './weapons/Hamster';
import { Butterfly } from './weapons/Butterfly';
import { RobotToy } from './weapons/RobotToy';
import { Rainbow } from './weapons/Rainbow';
import { Star } from './weapons/Star';
import { MagnifyingGlass } from './weapons/MagnifyingGlass';

import { PassiveManager, PassiveInfoList } from './PassiveManager';
import type { PassiveId } from './PassiveManager';

export type WeaponId =
  | 'banana' | 'acorn' | 'pencil' | 'paper_plane' | 'marble'
  | 'snowball' | 'leaf' | 'ruler' | 'eraser' | 'crayon'
  | 'lunch_box' | 'bubble' | 'water_balloon' | 'hamster' | 'butterfly'
  | 'robot_toy' | 'rainbow' | 'star' | 'magnifying_glass';

export type WeaponCategory = 'ranged' | 'melee' | 'companion' | 'special';

export interface WeaponInfo {
  id: WeaponId;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  maxLevel: number;
  category: WeaponCategory;
}

/** 레벨업 선택지 항목. bonus = 무기/패시브가 모두 만렙·만슬롯일 때의 대체 보상 */
export interface UpgradeChoice {
  type: 'weapon' | 'passive' | 'bonus';
  id: string;
  isNew: boolean;
  /** 이번 선택이 주는 효과 설명 (카드 UI 보조 라인 표기용) */
  effectKo: string;
}

const WeaponRegistry: Record<WeaponId, new (scene: GameScene, player: Player) => WeaponBase> = {
  banana: Banana,
  acorn: Acorn,
  pencil: Pencil,
  paper_plane: PaperPlane,
  marble: Marble,
  snowball: Snowball,
  leaf: Leaf,
  ruler: Ruler,
  eraser: Eraser,
  crayon: Crayon,
  lunch_box: LunchBox,
  bubble: Bubble,
  water_balloon: WaterBalloon,
  hamster: Hamster,
  butterfly: Butterfly,
  robot_toy: RobotToy,
  rainbow: Rainbow,
  star: Star,
  magnifying_glass: MagnifyingGlass,
};

export const WeaponInfoList: WeaponInfo[] = [
  // 원거리 무기 (Ranged)
  { id: 'pencil', name: 'Pencil', nameKo: '연필', description: 'Throws pencils at the nearest monster', descriptionKo: '가장 가까운 몬스터를 향해 연필을 던지는 기본 무기', maxLevel: 8, category: 'ranged' },
  { id: 'banana', name: 'Banana', nameKo: '바나나', description: 'Boomerang banana that returns', descriptionKo: '돌아오는 바나나 부메랑', maxLevel: 8, category: 'ranged' },
  { id: 'acorn', name: 'Acorn', nameKo: '도토리', description: 'Bouncing acorns', descriptionKo: '튕기는 도토리', maxLevel: 8, category: 'ranged' },
  { id: 'paper_plane', name: 'Paper Plane', nameKo: '종이비행기', description: 'Homing paper planes', descriptionKo: '유도하는 종이비행기', maxLevel: 8, category: 'ranged' },
  { id: 'marble', name: 'Marble', nameKo: '구슬', description: 'Bounces off walls', descriptionKo: '벽에 반사되는 구슬', maxLevel: 8, category: 'ranged' },
  { id: 'snowball', name: 'Snowball', nameKo: '눈덩이', description: 'Slows enemies', descriptionKo: '적을 느리게 만드는 눈덩이', maxLevel: 8, category: 'ranged' },
  { id: 'leaf', name: 'Leaf', nameKo: '나뭇잎', description: 'Drifting leaf projectile', descriptionKo: '바람에 흔들리는 나뭇잎', maxLevel: 8, category: 'ranged' },
  { id: 'ruler', name: 'Ruler', nameKo: '자', description: 'Giant ruler slams down for area damage', descriptionKo: '거대한 자로 내려쳐 넓은 범위를 강타', maxLevel: 8, category: 'ranged' },
  // 근접/범위 무기 (Melee/Area)
  { id: 'eraser', name: 'Eraser', nameKo: '지우개', description: 'Erases enemies in area', descriptionKo: '범위 내 적을 지우는 지우개', maxLevel: 8, category: 'melee' },
  { id: 'crayon', name: 'Crayon', nameKo: '크레파스', description: 'Draws rainbow damage', descriptionKo: '무지개 선을 그리는 크레파스', maxLevel: 8, category: 'melee' },
  { id: 'lunch_box', name: 'Lunch Box', nameKo: '도시락', description: 'Explosive area damage', descriptionKo: '폭발하는 도시락', maxLevel: 8, category: 'melee' },
  { id: 'bubble', name: 'Bubble', nameKo: '비눗방울', description: 'Orbiting bubbles', descriptionKo: '주위를 도는 비눗방울', maxLevel: 8, category: 'melee' },
  { id: 'water_balloon', name: 'Water Balloon', nameKo: '물풍선', description: 'Splash damage on impact', descriptionKo: '터지면 튀는 물풍선', maxLevel: 8, category: 'melee' },
  // 보조/동료 무기 (Companion)
  { id: 'hamster', name: 'Hamster', nameKo: '햄스터', description: 'Spinning hamster friend', descriptionKo: '회전하는 햄스터 친구', maxLevel: 8, category: 'companion' },
  { id: 'butterfly', name: 'Butterfly', nameKo: '나비', description: 'Homing butterfly attack', descriptionKo: '유도하는 나비 공격', maxLevel: 8, category: 'companion' },
  { id: 'robot_toy', name: 'Robot Toy', nameKo: '로봇 장난감', description: 'Auto-attacking robot', descriptionKo: '자동으로 공격하는 로봇', maxLevel: 8, category: 'companion' },
  // 특수 무기 (Special)
  { id: 'rainbow', name: 'Rainbow', nameKo: '무지개', description: 'Rainbow wave attack', descriptionKo: '무지개 파동 공격', maxLevel: 8, category: 'special' },
  { id: 'star', name: 'Star', nameKo: '별', description: 'Random lightning strikes', descriptionKo: '무작위 별똥별 공격', maxLevel: 8, category: 'special' },
  { id: 'magnifying_glass', name: 'Magnifying Glass', nameKo: '돋보기', description: 'Focus sunlight to burn enemies', descriptionKo: '햇빛을 모아 적을 태우는 공격', maxLevel: 8, category: 'special' },
];

/** 대체 보상 카드 (설계 §5.3 — 제안할 강화/신규가 없을 때) */
export const BonusInfoList = [
  { id: 'heal', nameKo: '체력 회복', descriptionKo: '체력을 30% 회복합니다' },
  { id: 'score', nameKo: '보너스 점수', descriptionKo: '점수 +500' },
  { id: 'magnet_pulse', nameKo: '자석 발동', descriptionKo: '화면의 모든 수정을 끌어옵니다' },
];

export class WeaponManager {
  private scene: GameScene;
  private player: Player;
  private weapons: Map<WeaponId, WeaponBase> = new Map();
  private passiveManager: PassiveManager;
  private maxWeapons: number = 6;

  constructor(scene: GameScene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.passiveManager = new PassiveManager(player);
  }

  update(delta: number): void {
    this.weapons.forEach((weapon) => {
      weapon.update(delta);
    });
  }

  // 게임 리셋 시 모든 무기의 자체 리소스 정리 훅 호출
  destroyAll(): void {
    this.weapons.forEach((weapon) => weapon.destroy());
  }

  addWeapon(id: WeaponId): boolean {
    if (this.weapons.has(id)) {
      return this.upgradeWeapon(id);
    }

    if (this.weapons.size >= this.maxWeapons) {
      return false;
    }

    const WeaponClass = WeaponRegistry[id];
    if (!WeaponClass) {
      console.warn(`Weapon ${id} not found in registry`);
      return false;
    }

    const weapon = new WeaponClass(this.scene, this.player);
    this.weapons.set(id, weapon);
    return true;
  }

  upgradeWeapon(id: WeaponId): boolean {
    const weapon = this.weapons.get(id);
    if (!weapon) return false;

    if (weapon.isMaxLevel()) return false;

    weapon.upgrade();
    return true;
  }

  hasWeapon(id: WeaponId): boolean {
    return this.weapons.has(id);
  }

  getWeapon(id: WeaponId): WeaponBase | undefined {
    return this.weapons.get(id);
  }

  getWeaponCount(): number {
    return this.weapons.size;
  }

  getActiveWeapons(): WeaponBase[] {
    return Array.from(this.weapons.values());
  }

  // Passive management
  addPassive(id: PassiveId): boolean {
    return this.passiveManager.addPassive(id);
  }

  upgradePassive(id: PassiveId): boolean {
    return this.passiveManager.upgradePassive(id);
  }

  hasPassive(id: PassiveId): boolean {
    return this.passiveManager.hasPassive(id);
  }

  getPassiveCount(): number {
    return this.passiveManager.getPassiveCount();
  }

  getPassiveLevel(id: PassiveId): number {
    return this.passiveManager.getPassiveLevel(id);
  }

  getActivePassives(): Array<{ id: PassiveId; level: number; maxLevel: number }> {
    return this.passiveManager.getActivePassives();
  }

  /**
   * 레벨업 선택지 (설계 §5.3):
   * - 슬롯 규칙 일원화 — 무기 6/패시브 6, 가득 차면 신규 제안 안 함 (보상 증발 버그 제거)
   * - 가중 추첨: 보유 강화 55 / 신규 무기 30 / 신규 패시브 15, 행운은 신규 확률을 높임
   * - 제안할 것이 전혀 없으면 대체 보상(bonus) 카드
   */
  getAvailableUpgrades(count: number = 3): UpgradeChoice[] {
    const luck = this.player.luck;

    // 패시브는 descriptionKo가 이미 레벨당 효과 형식("공격력 +10%")이라 그대로 재사용
    const passiveEffectKo = (id: PassiveId): string =>
      PassiveInfoList.find((p) => p.id === id)?.descriptionKo ?? '';

    const owned: UpgradeChoice[] = [];
    this.weapons.forEach((weapon, id) => {
      if (!weapon.isMaxLevel())
        owned.push({ type: 'weapon', id, isNew: false, effectKo: weapon.getNextUpgradeDescKo() ?? '' });
    });
    this.passiveManager.getActivePassives().forEach(({ id, level, maxLevel }) => {
      if (level < maxLevel) owned.push({ type: 'passive', id, isNew: false, effectKo: passiveEffectKo(id) });
    });

    const newWeapons: UpgradeChoice[] =
      this.weapons.size < this.maxWeapons
        ? WeaponInfoList.filter((w) => !this.weapons.has(w.id)).map((w) => ({
            type: 'weapon' as const,
            id: w.id,
            isNew: true,
            effectKo: '새 무기 획득!',
          }))
        : [];

    const newPassives: UpgradeChoice[] =
      this.passiveManager.getPassiveCount() < this.passiveManager.getMaxPassives()
        ? this.passiveManager.getAvailablePassives().map((p) => ({
            type: 'passive' as const,
            id: p,
            isNew: true,
            effectKo: passiveEffectKo(p),
          }))
        : [];

    this.shuffleArray(owned);
    this.shuffleArray(newWeapons);
    this.shuffleArray(newPassives);

    const pools = [
      { list: owned, weight: 55 },
      { list: newWeapons, weight: 30 * (1 + luck) },
      { list: newPassives, weight: 15 * (1 + luck) },
    ];

    const result: UpgradeChoice[] = [];
    while (result.length < count) {
      const active = pools.filter((p) => p.list.length > 0);
      if (active.length === 0) break;
      const total = active.reduce((s, p) => s + p.weight, 0);
      let roll = Math.random() * total;
      let chosen = active[active.length - 1];
      for (const p of active) {
        roll -= p.weight;
        if (roll <= 0) {
          chosen = p;
          break;
        }
      }
      result.push(chosen.list.shift()!);
    }

    // 전부 만렙·만슬롯: 대체 보상 카드로 채움
    let bi = 0;
    while (result.length < count && bi < BonusInfoList.length) {
      result.push({ type: 'bonus', id: BonusInfoList[bi].id, isNew: false, effectKo: BonusInfoList[bi].descriptionKo });
      bi++;
    }

    return result;
  }

  // Fisher-Yates shuffle
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
