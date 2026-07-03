import type { UnitBank } from '../types/quiz';

export type Grade = 5 | 6;
export type Semester = 1 | 2;

/** 이 프로젝트가 다루는 유일한 단원 (프로젝트당 1단원 아키텍처) */
export const UNIT = {
  unitId: 'g6-1-1',
  subject: 'math',
  grade: 6 as Grade,
  semester: 1 as Semester,
  unitNumber: 1,
  title: '분수의 나눗셈',
} as const;

export function weightedScore(score: number, survivalTime: number, level: number): number {
  return score + Math.floor(survivalTime) * 10 + level * 100;
}

let _bank: UnitBank | null = null;

/** 문제은행 lazy load (선택 단원 JSON만 번들 분리 로드) */
export async function loadBank(): Promise<UnitBank> {
  if (_bank) return _bank;
  const mod = await import('./banks/math/g6-1-1.json');
  _bank = mod.default as unknown as UnitBank;
  return _bank;
}
