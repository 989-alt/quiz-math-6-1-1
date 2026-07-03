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

/** quiz.type별 제한시간(초) */
export function quizTimeLimit(type: QuizType): number {
  switch (type) {
    case 'word':
    case 'fact':
    case 'order':
      return 20;
    default:
      return 15;
  }
}
