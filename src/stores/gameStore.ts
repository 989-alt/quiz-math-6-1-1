import { create } from 'zustand';
import type { PlayerState, UpgradeOption, GameOverData } from '../types/game';
import type { WeaponInstance, PassiveInstance } from '../types/game';

interface GameState {
  // Game status
  isPlaying: boolean;
  isPaused: boolean;
  isGameOver: boolean;

  // Player state
  player: PlayerState;

  // Level up state
  isLevelingUp: boolean;
  availableUpgrades: UpgradeOption[];

  // Quiz state
  isShowingQuiz: boolean;
  currentQuizIndex: number;

  // Game stats
  survivalTime: number;
  monstersKilled: number;

  // Actions
  startGame: (playerName: string) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => GameOverData;

  // Player actions
  updatePlayerHp: (hp: number) => void;
  addXp: (amount: number) => void;
  levelUp: () => void;

  // Level up actions
  showLevelUp: (upgrades: UpgradeOption[]) => void;
  selectUpgrade: (upgrade: UpgradeOption) => void;

  // Quiz actions
  showQuiz: () => void;
  hideQuiz: () => void;
  answerQuiz: (correct: boolean) => void;

  // Weapon/Passive actions
  addWeapon: (weaponId: string) => void;
  upgradeWeapon: (weaponId: string) => void;
  addPassive: (passiveId: string) => void;
  upgradePassive: (passiveId: string) => void;
  evolveWeapon: (weaponId: string, evolvedId: string) => void;

  // Stats actions
  incrementMonstersKilled: () => void;
  updateSurvivalTime: (time: number) => void;
  addScore: (points: number) => void;

  // Reset
  resetGame: () => void;
}

const initialPlayerState: PlayerState = {
  id: '',
  name: '',
  hp: 100,
  maxHp: 100,
  level: 1,
  xp: 0,
  xpToNext: 10,
  score: 0,
  weapons: [],
  passives: [],
  isAlive: true,
};

const calculateXpToNext = (level: number): number => {
  return Math.floor(10 * Math.pow(1.2, level - 1));
};

export const useGameStore = create<GameState>((set, get) => ({
  isPlaying: false,
  isPaused: false,
  isGameOver: false,
  player: { ...initialPlayerState },
  isLevelingUp: false,
  availableUpgrades: [],
  isShowingQuiz: false,
  currentQuizIndex: 0,
  survivalTime: 0,
  monstersKilled: 0,

  startGame: (playerName: string) => {
    set({
      isPlaying: true,
      isPaused: false,
      isGameOver: false,
      player: {
        ...initialPlayerState,
        id: crypto.randomUUID(),
        name: playerName,
      },
      survivalTime: 0,
      monstersKilled: 0,
    });
  },

  pauseGame: () => set({ isPaused: true }),

  resumeGame: () => set({ isPaused: false }),

  endGame: () => {
    const state = get();
    const gameOverData: GameOverData = {
      score: state.player.score,
      level: state.player.level,
      survivalTime: state.survivalTime,
      monstersKilled: state.monstersKilled,
      weapons: state.player.weapons,
    };
    set({ isPlaying: false, isGameOver: true });
    return gameOverData;
  },

  updatePlayerHp: (hp: number) => {
    const { player } = get();
    const newHp = Math.max(0, Math.min(hp, player.maxHp));
    const isAlive = newHp > 0;

    set({
      player: { ...player, hp: newHp, isAlive },
    });

    if (!isAlive) {
      get().endGame();
    }
  },

  addXp: (amount: number) => {
    const { player } = get();
    let newXp = player.xp + amount;
    let newLevel = player.level;
    let xpToNext = player.xpToNext;

    while (newXp >= xpToNext) {
      newXp -= xpToNext;
      newLevel++;
      xpToNext = calculateXpToNext(newLevel);
    }

    const levelsGained = newLevel - player.level;

    set({
      player: {
        ...player,
        xp: newXp,
        level: newLevel,
        xpToNext,
      },
    });

    if (levelsGained > 0) {
      get().levelUp();
    }
  },

  levelUp: () => {
    set({ isLevelingUp: true, isPaused: true });
  },

  showLevelUp: (upgrades: UpgradeOption[]) => {
    set({
      isLevelingUp: true,
      isPaused: true,
      availableUpgrades: upgrades,
    });
  },

  selectUpgrade: (upgrade: UpgradeOption) => {
    if (upgrade.type === 'weapon') {
      if (upgrade.isNew) {
        get().addWeapon(upgrade.id);
      } else if (upgrade.isEvolution) {
        get().evolveWeapon(upgrade.id, upgrade.id);
      } else {
        get().upgradeWeapon(upgrade.id);
      }
    } else {
      if (upgrade.isNew) {
        get().addPassive(upgrade.id);
      } else {
        get().upgradePassive(upgrade.id);
      }
    }

    set({
      isLevelingUp: false,
      isPaused: false,
      availableUpgrades: [],
    });
  },

  showQuiz: () => set({ isShowingQuiz: true, isPaused: true }),

  hideQuiz: () => set({ isShowingQuiz: false }),

  answerQuiz: (correct: boolean) => {
    const { player, currentQuizIndex } = get();

    if (correct) {
      set({
        player: { ...player, score: player.score + 100 },
        currentQuizIndex: currentQuizIndex + 1,
      });
    }

    set({ isShowingQuiz: false, isPaused: false });
  },

  addWeapon: (weaponId: string) => {
    const { player } = get();
    const newWeapon: WeaponInstance = {
      id: weaponId,
      level: 1,
      isEvolved: false,
    };
    set({
      player: {
        ...player,
        weapons: [...player.weapons, newWeapon],
      },
    });
  },

  upgradeWeapon: (weaponId: string) => {
    const { player } = get();
    set({
      player: {
        ...player,
        weapons: player.weapons.map((w) =>
          w.id === weaponId ? { ...w, level: w.level + 1 } : w
        ),
      },
    });
  },

  addPassive: (passiveId: string) => {
    const { player } = get();
    const newPassive: PassiveInstance = {
      id: passiveId,
      level: 1,
    };
    set({
      player: {
        ...player,
        passives: [...player.passives, newPassive],
      },
    });
  },

  upgradePassive: (passiveId: string) => {
    const { player } = get();
    set({
      player: {
        ...player,
        passives: player.passives.map((p) =>
          p.id === passiveId ? { ...p, level: p.level + 1 } : p
        ),
      },
    });
  },

  evolveWeapon: (weaponId: string, evolvedId: string) => {
    const { player } = get();
    set({
      player: {
        ...player,
        weapons: player.weapons.map((w) =>
          w.id === weaponId ? { ...w, id: evolvedId, isEvolved: true } : w
        ),
      },
    });
  },

  incrementMonstersKilled: () => {
    set((state) => ({ monstersKilled: state.monstersKilled + 1 }));
  },

  updateSurvivalTime: (time: number) => {
    set({ survivalTime: time });
  },

  addScore: (points: number) => {
    const { player } = get();
    set({ player: { ...player, score: player.score + points } });
  },

  resetGame: () => {
    set({
      isPlaying: false,
      isPaused: false,
      isGameOver: false,
      player: { ...initialPlayerState },
      isLevelingUp: false,
      availableUpgrades: [],
      isShowingQuiz: false,
      currentQuizIndex: 0,
      survivalTime: 0,
      monstersKilled: 0,
    });
  },
}));
