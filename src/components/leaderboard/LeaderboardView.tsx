import { useMemo, useState } from 'react';
import { UNIT } from '../../data/unit';
import { getLocalScores, type ScoreEntryWithMeta } from '../../services/firebase';
import { DIFFICULTY_CONFIG, type Difficulty } from '../../game/difficulty';
import { GAME_MODE_CONFIG, GAME_MODE_ORDER, type GameMode } from '../../game/gameMode';

interface LeaderboardViewProps {
  onBack?: () => void;
}

const DIFFICULTY_TABS: Difficulty[] = ['easy', 'normal', 'hard'];
const MY_RECORDS_TOP_N = 10;

// 구기록(difficulty 필드 없음) = 기존 밸런스 = '쉬움' 탭으로 분류
function tabOf(entry: ScoreEntryWithMeta): Difficulty {
  const d = entry.difficulty;
  return d === 'normal' || d === 'hard' ? d : 'easy';
}

// 구기록(mode 필드 없음) = 모험 모드로 분류
function modeOf(entry: ScoreEntryWithMeta): GameMode {
  return entry.mode === 'timeAttack' ? 'timeAttack' : 'adventure';
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 하루에 여러 판 할 수 있으므로 날짜만이 아니라 시:분까지 보여 기록을 구분한다.
function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

export function LeaderboardView({ onBack }: LeaderboardViewProps) {
  const unitId = UNIT.unitId;
  const [modeTab, setModeTab] = useState<GameMode>('adventure');
  const [tab, setTab] = useState<Difficulty>('normal');

  // 한 기기 = 한 학생 전제. localStorage에 쌓인 기록이 곧 내 기록이므로 동기로 읽는다
  // (원격 조회·인증·로딩 스피너 불필요).
  const allRecords = useMemo(() => getLocalScores(unitId), [unitId]);

  // 선택된 모드·난이도로 필터링 후 가중점수 상위 N개. getLocalScores가 이미 가중점수
  // 내림차순으로 정렬해 돌려주므로 추가 정렬 없이 앞에서 N개만 자른다.
  const myRecords = useMemo(
    () =>
      allRecords
        .filter((s) => modeOf(s) === modeTab && tabOf(s) === tab)
        .slice(0, MY_RECORDS_TOP_N),
    [allRecords, modeTab, tab]
  );

  const best = myRecords[0] ?? null;

  return (
    <div
      style={{
        width: '100vw',
        minHeight: '100vh',
        background: '#0a0a0f',
        position: 'relative',
        padding: 'clamp(20px, 4vw, 56px)',
      }}
    >
      <div className="fantasy-bg-image" />
      <div className="fantasy-aurora" />
      <div className="fantasy-stars" />
      <div className="dot-grid-bg" />

      <div style={{ position: 'relative', zIndex: 10, maxWidth: 880, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 'clamp(22px, 3.5vw, 36px)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#fafafa',
              }}
            >
              <span className="gradient-text">내 기록</span>
            </h1>
            <p style={{ fontSize: 13, color: '#71717a', marginTop: 4 }}>
              이 기기에 저장된 내 최고 기록 · 최대 {MY_RECORDS_TOP_N}개 (점수 기준)
            </p>
          </div>
          {onBack && (
            <button onClick={onBack} className="btn-clean btn-ghost" style={{ padding: '10px 18px', fontSize: 13 }}>
              ← 홈으로
            </button>
          )}
        </header>

        <div
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            marginBottom: 16,
            fontSize: 13,
            color: '#a5b4fc',
            fontWeight: 600,
          }}
        >
          {UNIT.grade}학년 {UNIT.semester}학기 · {UNIT.unitNumber}단원 {UNIT.title}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
          {GAME_MODE_ORDER.map((m) => {
            const cfg = GAME_MODE_CONFIG[m];
            const active = modeTab === m;
            return (
              <button
                key={m}
                onClick={() => setModeTab(m)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: active ? cfg.badgeColor : '#71717a',
                  background: active ? `${cfg.badgeColor}1a` : 'rgba(255,255,255,0.03)',
                  border: active ? `1.5px solid ${cfg.badgeColor}` : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {cfg.emoji} {cfg.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {DIFFICULTY_TABS.map((d) => {
            const cfg = DIFFICULTY_CONFIG[d];
            const active = tab === d;
            return (
              <button
                key={d}
                onClick={() => setTab(d)}
                style={{
                  padding: '10px 8px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: active ? cfg.badgeColor : '#71717a',
                  background: active ? `${cfg.badgeColor}1a` : 'rgba(255,255,255,0.03)',
                  border: active ? `1.5px solid ${cfg.badgeColor}` : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>

        {best && (
          <div
            className="clean-card"
            style={{
              padding: 16,
              marginBottom: 16,
              border: '1px solid rgba(251,191,36,0.35)',
              background: 'rgba(251,191,36,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, marginBottom: 4 }}>
                  🏆 역대 최고 기록
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#e4e4e7', marginBottom: 2 }}>
                  {best.nickname}
                </div>
                <div style={{ fontSize: 13, color: '#a1a1aa' }}>
                  생존 {formatTime(best.survivalTime)} · Lv.{best.level} · 처치 {best.kills}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fbbf24' }}>
                  {best.score.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: '#71717a' }}>{formatDateTime(best.createdAt)} 달성</div>
              </div>
            </div>
          </div>
        )}

        <div className="clean-card" style={{ padding: 0, overflow: 'hidden' }}>
          {myRecords.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#71717a', fontSize: 14 }}>
              아직 기록이 없어요.
              <br />
              <span style={{ fontSize: 12, color: '#52525b' }}>첫 도전을 시작해보세요!</span>
            </div>
          ) : (
            <div>
              {myRecords.map((s, i) => {
                const rank = i + 1;
                return (
                  <div
                    key={s.docId}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '48px 1fr auto',
                      gap: 12,
                      padding: '12px 16px',
                      borderBottom: i < myRecords.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: rank === 1 ? 'rgba(251,191,36,0.05)' : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize: rank <= 3 ? 22 : 14,
                        fontWeight: 800,
                        color:
                          rank === 1
                            ? '#fbbf24'
                            : rank === 2
                            ? '#cbd5e1'
                            : rank === 3
                            ? '#fb923c'
                            : '#52525b',
                        textAlign: 'center',
                      }}
                    >
                      {rank}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#e4e4e7',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.nickname}
                      </div>
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                        {formatDateTime(s.createdAt)} · 생존 {formatTime(s.survivalTime)} · Lv.{s.level} · 처치 {s.kills}
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#a5b4fc' }}>
                      {s.score.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
