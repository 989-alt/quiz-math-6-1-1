export type QuizType = 'calc' | 'word' | 'concept' | 'fact' | 'order' | 'idiom' | 'spelling';

export type QuizDifficulty = 1 | 2 | 3;

export interface Quiz {
  id: string;
  type: QuizType;
  difficulty: QuizDifficulty;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface UnitBank {
  unitId: string;
  subject: string;
  grade: number;
  semester: number;
  unitNumber: number;
  title: string;
  quizCount: number;
  quizzes: Quiz[];
}

export interface QuizResult {
  quizId: string;
  selectedIndex: number;
  isCorrect: boolean;
  timeSpent: number;
}

/** 난이도별 제한시간(초): 하15/중20/상30 + 장문형(word/fact/order) 5초 가산, 상한 35초 */
export function quizTimeLimit(quiz: Pick<Quiz, 'type' | 'difficulty'>): number {
  const base = quiz.difficulty === 3 ? 30 : quiz.difficulty === 2 ? 20 : 15;
  const isLongText = quiz.type === 'word' || quiz.type === 'fact' || quiz.type === 'order';
  return Math.min(base + (isLongText ? 5 : 0), 35);
}
