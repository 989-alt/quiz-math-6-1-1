// 난이도 3단 모드 단일 소스 (설계 docs/plans/2026-07-13-difficulty-modes-design.md §2)
// 게임(Phaser) 측 배율·상한·시간 가속 정의. 순수 데이터/함수만 두어 어디서든 참조 가능.
// Monster.ts는 순수 config 함수로 유지 — 배율은 스폰 직전 GameScene에서 곱한다.

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  label: string;
  badgeColor: string; // HUD 난이도 배지 색
  statMul: { hp: number; speed: number; damage: number };
  spawnIntervalMul: number; // 스폰 간격 배율 (작을수록 빠른 스폰)
  maxActive: number; // 평시 동시 활성 몬스터 상한 (러시 상한과 별개)
  // 생존 시간 기반 자동 가속 — 분당 증가율(비율)과 상한(비율). cap은 speed/hp 램프에 공통 적용.
  timeRamp: { speedPerMin: number; hpPerMin: number; cap: number };
  wrongPenalty: boolean; // 오답 페널티 발동 여부 (어려움 전용)
  descriptions: string[]; // 선택 화면에 표시할 차이점 설명
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: '쉬움',
    badgeColor: '#4ade80',
    statMul: { hp: 1.0, speed: 1.0, damage: 1.0 },
    spawnIntervalMul: 1.0,
    maxActive: 100,
    timeRamp: { speedPerMin: 0.02, hpPerMin: 0.03, cap: 0.2 },
    wrongPenalty: false,
    descriptions: [
      '기존 밸런스 그대로',
      '몬스터 속도·체력 기본',
      '시간 가속: 약하게',
      '오답 페널티 없음',
    ],
  },
  normal: {
    label: '보통',
    badgeColor: '#facc15',
    statMul: { hp: 1.2, speed: 1.15, damage: 1.1 },
    spawnIntervalMul: 0.8,
    maxActive: 120,
    timeRamp: { speedPerMin: 0.03, hpPerMin: 0.05, cap: 0.35 },
    wrongPenalty: false,
    descriptions: [
      '몬스터 체력·속도·공격력 상향',
      '스폰 간격이 짧아 물량 증가',
      '시간 가속: 중간',
      '오답 페널티 없음',
    ],
  },
  hard: {
    label: '어려움',
    badgeColor: '#f87171',
    statMul: { hp: 1.4, speed: 1.3, damage: 1.25 },
    spawnIntervalMul: 0.65,
    maxActive: 140,
    timeRamp: { speedPerMin: 0.04, hpPerMin: 0.07, cap: 0.5 },
    wrongPenalty: true,
    descriptions: [
      '몬스터 대폭 강화 + 최다 물량',
      '시간 가속: 강하게',
      '오답 시 페널티 3종 발동:',
      '· 체력 -10%',
      '· 몬스터 광폭화',
      '· 몬스터 습격',
    ],
  },
};

// 난이도 배율 × 생존 시간 가속을 결합한 최종 배율. 순수 함수(부수효과 없음).
// = statMul × (1 + min(perMin × 분, cap)). damage는 시간 가속 없이 statMul만 적용.
export function getDifficultyMods(
  d: Difficulty,
  survivalTimeSec: number,
): { hpMul: number; speedMul: number; damageMul: number } {
  const cfg = DIFFICULTY_CONFIG[d];
  const minutes = survivalTimeSec / 60;
  const { speedPerMin, hpPerMin, cap } = cfg.timeRamp;
  const speedRamp = Math.min(speedPerMin * minutes, cap);
  const hpRamp = Math.min(hpPerMin * minutes, cap);
  return {
    hpMul: cfg.statMul.hp * (1 + hpRamp),
    speedMul: cfg.statMul.speed * (1 + speedRamp),
    damageMul: cfg.statMul.damage,
  };
}
