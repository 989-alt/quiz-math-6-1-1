import type { GameScene } from '../scenes/GameScene';
import type { Player } from '../entities/Player';
import { WeaponBase } from './WeaponBase';
import { GAME_CONFIG } from '../config';

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
import { Butterfly } from './weapons/Butterfly';
import { PaperStorm } from './weapons/PaperStorm';
import { Star } from './weapons/Star';
import { MagnifyingGlass } from './weapons/MagnifyingGlass';

// 펫 (전용 슬롯 — 무기 6슬롯/클리어 조건과 완전 분리)
import { PetBase } from './pets/PetBase';
import { HamsterPet } from './pets/HamsterPet';
import { RobotPet } from './pets/RobotPet';

import { PassiveManager, PassiveInfoList } from './PassiveManager';
import type { PassiveId } from './PassiveManager';

export type WeaponId =
  | 'banana' | 'acorn' | 'pencil' | 'paper_plane' | 'marble'
  | 'snowball' | 'leaf' | 'ruler' | 'eraser' | 'crayon'
  | 'lunch_box' | 'bubble' | 'water_balloon' | 'butterfly'
  | 'paper_storm' | 'star' | 'magnifying_glass';

export type PetId = 'hamster' | 'robot_toy';

export type WeaponCategory = 'ranged' | 'melee' | 'pet' | 'special';

export interface WeaponInfo {
  id: WeaponId | PetId;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  maxLevel: number;
  category: WeaponCategory;
}

/** 레벨업 선택지 항목. bonus = 무기/패시브가 모두 만렙·만슬롯일 때의 대체 보상 */
export interface UpgradeChoice {
  type: 'weapon' | 'passive' | 'bonus' | 'pet';
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
  butterfly: Butterfly,
  paper_storm: PaperStorm,
  star: Star,
  magnifying_glass: MagnifyingGlass,
};

const PetRegistry: Record<PetId, new (scene: GameScene, player: Player) => PetBase> = {
  hamster: HamsterPet,
  robot_toy: RobotPet,
};

export const WeaponInfoList: WeaponInfo[] = [
  // 원거리 무기 (Ranged)
  { id: 'pencil', name: 'Pencil', nameKo: '연필', description: 'Throws pencils at the nearest monster', descriptionKo: '가장 가까운 몬스터를 향해 연필을 던지는 기본 무기', maxLevel: 8, category: 'ranged' },
  { id: 'banana', name: 'Banana', nameKo: '바나나', description: 'Boomerang banana that returns', descriptionKo: '돌아오는 바나나 부메랑', maxLevel: 8, category: 'ranged' },
  { id: 'acorn', name: 'Acorn', nameKo: '도토리', description: 'Bouncing acorns', descriptionKo: '튕기는 도토리', maxLevel: 8, category: 'ranged' },
  { id: 'paper_plane', name: 'Paper Plane', nameKo: '종이비행기', description: 'Paper plane that explodes on impact', descriptionKo: '명중하면 폭발하는 종이비행기', maxLevel: 8, category: 'ranged' },
  { id: 'marble', name: 'Marble', nameKo: '구슬', description: 'Bounces off walls', descriptionKo: '벽에 반사되는 구슬', maxLevel: 8, category: 'ranged' },
  { id: 'snowball', name: 'Snowball', nameKo: '눈덩이', description: 'Slows enemies', descriptionKo: '맞은 적을 잠시 완전히 얼려버리는 눈덩이', maxLevel: 8, category: 'ranged' },
  { id: 'leaf', name: 'Leaf', nameKo: '나뭇잎', description: 'Drifting leaf projectile', descriptionKo: '바람에 흔들리는 나뭇잎', maxLevel: 8, category: 'ranged' },
  { id: 'ruler', name: 'Ruler', nameKo: '자', description: 'Giant ruler slams down for area damage', descriptionKo: '거대한 자로 내려쳐 넓은 범위를 강타', maxLevel: 8, category: 'ranged' },
  { id: 'butterfly', name: 'Butterfly', nameKo: '나비', description: 'Multiple weak homing butterflies', descriptionKo: '여러 마리가 날아가는 나비 떼', maxLevel: 8, category: 'ranged' },
  // 근접/범위 무기 (Melee/Area)
  { id: 'eraser', name: 'Eraser', nameKo: '지우개', description: 'Erases enemies in area', descriptionKo: '범위 내 적을 지우는 지우개', maxLevel: 8, category: 'melee' },
  { id: 'crayon', name: 'Crayon', nameKo: '크레파스', description: 'Draws rainbow damage', descriptionKo: '무지개 선을 그리는 크레파스', maxLevel: 8, category: 'melee' },
  { id: 'lunch_box', name: 'Lunch Box', nameKo: '도시락', description: 'Explosive area damage', descriptionKo: '폭발하는 도시락', maxLevel: 8, category: 'melee' },
  { id: 'bubble', name: 'Bubble', nameKo: '비눗방울', description: 'Orbiting bubbles', descriptionKo: '주위를 도는 비눗방울', maxLevel: 8, category: 'melee' },
  { id: 'water_balloon', name: 'Water Balloon', nameKo: '물풍선', description: 'Splash damage on impact', descriptionKo: '터지면 튀는 물풍선', maxLevel: 8, category: 'melee' },
  // 특수 무기 (Special)
  { id: 'paper_storm', name: 'Paper Storm', nameKo: '쪽지시험 폭풍', description: 'A storm of quiz papers sweeps the whole screen', descriptionKo: '쪽지시험지 회오리가 화면 전체를 휩쓴다', maxLevel: 8, category: 'special' },
  { id: 'star', name: 'Star', nameKo: '별', description: 'Random lightning strikes', descriptionKo: '무작위 별똥별 공격', maxLevel: 8, category: 'special' },
  { id: 'magnifying_glass', name: 'Magnifying Glass', nameKo: '돋보기', description: 'Focus sunlight to burn enemies', descriptionKo: '햇빛을 모아 적을 태우는 공격', maxLevel: 8, category: 'special' },
];

/** 펫 목록 (전용 슬롯 maxPets=2 — 무기 로스터·클리어 조건과 분리) */
export const PetInfoList: WeaponInfo[] = [
  { id: 'hamster', name: 'Hamster', nameKo: '햄스터', description: 'Charges at enemies and fetches gems', descriptionKo: '적에게 몸통 돌진! 떨어진 수정도 물어다 줘요', maxLevel: 8, category: 'pet' },
  { id: 'robot_toy', name: 'Robot Toy', nameKo: '로봇 장난감', description: 'Guard turret that avenges the player', descriptionKo: '멈춰 서서 레이저 발사! 내가 맞으면 바로 복수해요', maxLevel: 8, category: 'pet' },
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
  // 펫은 별도 Map — getWeaponCount()/getActiveWeapons()가 weapons Map만 순회하므로
  // 클리어 조건(checkWeaponCompletion)에 어떤 영향도 주지 않는다 (설계 불변식)
  private pets: Map<PetId, PetBase> = new Map();
  private passiveManager: PassiveManager;
  private maxWeapons: number = 6;
  private maxPets: number = GAME_CONFIG.game.maxPets;

  constructor(scene: GameScene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.passiveManager = new PassiveManager(player);
  }

  update(delta: number): void {
    this.weapons.forEach((weapon) => {
      weapon.update(delta);
    });
    this.pets.forEach((p) => p.update(delta));
  }

  // 게임 리셋 시 모든 무기/펫의 자체 리소스 정리 훅 호출
  destroyAll(): void {
    this.weapons.forEach((weapon) => weapon.destroy());
    this.pets.forEach((p) => p.destroy());
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

  // Pet management (무기와 대칭 — 단, 슬롯/클리어 조건은 완전 독립)
  addPet(id: PetId): boolean {
    if (this.pets.has(id)) {
      return this.upgradePet(id);
    }

    if (this.pets.size >= this.maxPets) {
      return false;
    }

    const PetClass = PetRegistry[id];
    if (!PetClass) {
      console.warn(`Pet ${id} not found in registry`);
      return false;
    }

    const pet = new PetClass(this.scene, this.player);
    this.pets.set(id, pet);
    return true;
  }

  upgradePet(id: PetId): boolean {
    const pet = this.pets.get(id);
    if (!pet) return false;

    if (pet.isMaxLevel()) return false;

    pet.upgrade();
    return true;
  }

  hasPet(id: PetId): boolean {
    return this.pets.has(id);
  }

  getPet(id: PetId): PetBase | undefined {
    return this.pets.get(id);
  }

  getPetCount(): number {
    return this.pets.size;
  }

  getActivePets(): PetBase[] {
    return Array.from(this.pets.values());
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
   *
   * exclude: 선택형 다시 뽑기(카드 1장 교체)에서 중복을 피하려는 후보 목록(현재 3장,
   * 버린 카드 포함). 제외 후 남는 후보가 count보다 적으면 제외를 무시하고 원래 후보 풀로
   * 되돌린다 — 후보 풀이 좁을 때 카드가 안 나오는 것보다 중복이 낫다.
   */
  getAvailableUpgrades(count: number = 3, exclude: Array<{ type: string; id: string }> = []): UpgradeChoice[] {
    const luck = this.player.luck;

    // 패시브는 descriptionKo가 이미 레벨당 효과 형식("공격력 +10%")이라 그대로 재사용
    const passiveEffectKo = (id: PassiveId): string =>
      PassiveInfoList.find((p) => p.id === id)?.descriptionKo ?? '';

    const owned: UpgradeChoice[] = [];
    this.weapons.forEach((weapon, id) => {
      if (!weapon.isMaxLevel())
        owned.push({ type: 'weapon', id, isNew: false, effectKo: weapon.getNextUpgradeDescKo() ?? '' });
    });
    this.pets.forEach((pet, id) => {
      if (!pet.isMaxLevel())
        owned.push({ type: 'pet', id, isNew: false, effectKo: pet.getNextUpgradeDescKo() ?? '' });
    });
    this.passiveManager.getActivePassives().forEach(({ id, level, maxLevel }) => {
      if (level < maxLevel) owned.push({ type: 'passive', id, isNew: false, effectKo: passiveEffectKo(id) });
    });

    const newWeapons: UpgradeChoice[] =
      this.weapons.size < this.maxWeapons
        ? WeaponInfoList.filter((w) => !this.weapons.has(w.id as WeaponId)).map((w) => ({
            type: 'weapon' as const,
            id: w.id,
            isNew: true,
            effectKo: '새 무기 획득!',
          }))
        : [];

    // 신규 펫은 무기 슬롯 게이트(weapons.size < maxWeapons)와 독립 — 무기 6슬롯이
    // 만석이어도 펫 슬롯이 남아있으면 계속 제안된다 (클리어 여정과 펫 수집의 분리)
    const newPets: UpgradeChoice[] =
      this.pets.size < this.maxPets
        ? PetInfoList.filter((p) => !this.pets.has(p.id as PetId)).map((p) => ({
            type: 'pet' as const,
            id: p.id,
            isNew: true,
            effectKo: '새 친구 획득!',
          }))
        : [];

    const newAcquisitions: UpgradeChoice[] = [...newWeapons, ...newPets];

    const newPassives: UpgradeChoice[] =
      this.passiveManager.getPassiveCount() < this.passiveManager.getMaxPassives()
        ? this.passiveManager.getAvailablePassives().map((p) => ({
            type: 'passive' as const,
            id: p,
            isNew: true,
            effectKo: passiveEffectKo(p),
          }))
        : [];

    const excludeKey = (t: string, id: string): string => `${t}:${id}`;
    const excludeSet = new Set(exclude.map((e) => excludeKey(e.type, e.id)));
    const withoutExcluded = (list: UpgradeChoice[]): UpgradeChoice[] =>
      excludeSet.size === 0 ? list : list.filter((c) => !excludeSet.has(excludeKey(c.type, c.id)));

    let ownedPool = withoutExcluded(owned);
    let newAcqPool = withoutExcluded(newAcquisitions);
    let newPassivesPool = withoutExcluded(newPassives);

    // 제외 적용 후 후보가 count에 못 미치면 완화 단계 ①: 제외를 무시하고 원래 풀 사용
    if (ownedPool.length + newAcqPool.length + newPassivesPool.length < count) {
      ownedPool = owned;
      newAcqPool = newAcquisitions;
      newPassivesPool = newPassives;
    }

    this.shuffleArray(ownedPool);
    this.shuffleArray(newAcqPool);
    this.shuffleArray(newPassivesPool);

    const pools = [
      { list: ownedPool, weight: 55 },
      { list: newAcqPool, weight: 30 * (1 + luck) },
      { list: newPassivesPool, weight: 15 * (1 + luck) },
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

    // 전부 만렙·만슬롯: 대체 보상 카드로 채움 (완화 단계 ② — 제외 목록에 없는 것 우선)
    let bi = 0;
    while (result.length < count && bi < BonusInfoList.length) {
      const bonus = BonusInfoList[bi];
      bi++;
      if (excludeSet.has(excludeKey('bonus', bonus.id))) continue;
      result.push({ type: 'bonus', id: bonus.id, isNew: false, effectKo: bonus.descriptionKo });
    }
    // 대체 보상 후보마저 전부 제외 목록과 겹치는 극단적인 경우 — 제외 무시하고 재채움
    bi = 0;
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
