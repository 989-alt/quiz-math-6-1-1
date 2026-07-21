import { create } from 'zustand';
import type { Quiz, QuizResult, UnitBank } from '../types/quiz';
import { loadBank } from '../data/unit';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 4개 보기를 셔플하고 correctIndex를 리매핑한 사본을 만든다 (원본 뱅크 데이터는 변형하지 않음) */
function shuffleOptions(quiz: Quiz): Quiz {
  const order = shuffle(quiz.options.map((_, i) => i));
  return {
    ...quiz,
    options: order.map((i) => quiz.options[i]),
    correctIndex: order.indexOf(quiz.correctIndex),
  };
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
  drawQuiz: () => Quiz | null;
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

  /** 한 판 무중복 소진 + 완전 랜덤 추첨(셔플된 풀 맨 앞). 소진 시 최근 20문 제외 재셔플 */
  drawQuiz: () => {
    const { bank, remaining, recentIds } = get();
    if (!bank) return null;

    let pool = remaining;
    if (pool.length === 0) {
      const recent = new Set(recentIds.slice(-RECENT_EXCLUDE));
      pool = shuffle(bank.quizzes.filter((q) => !recent.has(q.id)));
      if (pool.length === 0) pool = shuffle(bank.quizzes);
    }

    const quiz = pool[0];
    const nextRemaining = pool.slice(1);
    const displayQuiz = shuffleOptions(quiz);
    set({
      remaining: nextRemaining,
      currentQuiz: displayQuiz,
      recentIds: [...get().recentIds, quiz.id].slice(-RECENT_EXCLUDE * 2),
    });
    return displayQuiz;
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
