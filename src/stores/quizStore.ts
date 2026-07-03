import { create } from 'zustand';
import type { Quiz, QuizDifficulty, QuizResult, UnitBank } from '../types/quiz';
import { loadBank } from '../data/unit';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 웨이브 진행도 → 난이도 가중치 (설계 §1.4 난이도 페이싱) */
function difficultyWeights(wave: number): Record<QuizDifficulty, number> {
  if (wave <= 3) return { 1: 0.7, 2: 0.25, 3: 0.05 };
  if (wave <= 8) return { 1: 0.3, 2: 0.5, 3: 0.2 };
  return { 1: 0.15, 2: 0.45, 3: 0.4 };
}

const RECENT_EXCLUDE = 20;

interface QuizState {
  bank: UnitBank | null;
  remaining: Quiz[];
  recentIds: string[];
  currentQuiz: Quiz | null;
  quizResults: QuizResult[];
  streak: number;

  loadUnitBank: () => Promise<boolean>;
  drawQuiz: (wave: number) => Quiz | null;
  submitAnswer: (selectedIndex: number, timeSpent: number) => boolean;
  resetQuizSession: () => void;
}

export const useQuizStore = create<QuizState>()((set, get) => ({
  bank: null,
  remaining: [],
  recentIds: [],
  currentQuiz: null,
  quizResults: [],
  streak: 0,

  loadUnitBank: async () => {
    const bank = await loadBank();
    if (!bank || bank.quizzes.length === 0) return false;
    set({
      bank,
      remaining: shuffle(bank.quizzes),
      recentIds: [],
      currentQuiz: null,
      quizResults: [],
      streak: 0,
    });
    return true;
  },

  /** 한 판 무중복 소진 + 웨이브 기반 난이도 가중 추첨. 소진 시 최근 20문 제외 재셔플 */
  drawQuiz: (wave: number) => {
    const { bank, remaining, recentIds } = get();
    if (!bank) return null;

    let pool = remaining;
    if (pool.length === 0) {
      const recent = new Set(recentIds.slice(-RECENT_EXCLUDE));
      pool = shuffle(bank.quizzes.filter((q) => !recent.has(q.id)));
      if (pool.length === 0) pool = shuffle(bank.quizzes);
    }

    const weights = difficultyWeights(wave);
    const roll = Math.random();
    let targetDiff: QuizDifficulty = 1;
    if (roll < weights[3]) targetDiff = 3;
    else if (roll < weights[3] + weights[2]) targetDiff = 2;

    let idx = pool.findIndex((q) => q.difficulty === targetDiff);
    if (idx < 0) idx = 0; // 해당 난이도 소진 시 아무거나

    const quiz = pool[idx];
    const nextRemaining = pool.slice(0, idx).concat(pool.slice(idx + 1));
    set({
      remaining: nextRemaining,
      currentQuiz: quiz,
      recentIds: [...get().recentIds, quiz.id].slice(-RECENT_EXCLUDE * 2),
    });
    return quiz;
  },

  submitAnswer: (selectedIndex: number, timeSpent: number) => {
    const quiz = get().currentQuiz;
    if (!quiz) return false;
    const isCorrect = selectedIndex === quiz.correctIndex;
    set((state) => ({
      quizResults: [
        ...state.quizResults,
        { quizId: quiz.id, selectedIndex, isCorrect, timeSpent },
      ],
      streak: isCorrect ? state.streak + 1 : 0,
    }));
    return isCorrect;
  },

  resetQuizSession: () => {
    const { bank } = get();
    set({
      remaining: bank ? shuffle(bank.quizzes) : [],
      recentIds: [],
      currentQuiz: null,
      quizResults: [],
      streak: 0,
    });
  },
}));
