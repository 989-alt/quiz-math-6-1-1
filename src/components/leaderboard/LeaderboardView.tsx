import { useEffect, useMemo, useState } from 'react';
import { UNIT } from '../../data/unit';
import {
  dedupeByNicknameBest,
  ensureAnonymousAuth,
  fetchMyBest,
  fetchTopScores,
  type ScoreEntryWithMeta,
} from '../../services/firebase';

interface LeaderboardViewProps {
  onBack?: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function LeaderboardView({ onBack }: LeaderboardViewProps) {
  const unitId = UNIT.unitId;
  const [scores, setScores] = useState<ScoreEntryWithMeta[]>([]);
  const [myBest, setMyBest] = useState<ScoreEntryWithMeta | null>(null);
  const [myUid, setMyUid] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Firebase 미설정이어도 fetchTopScores/fetchMyBest가 내부적으로 localStorage 폴백을
    // 처리하므로, 여기서 조기 반환하지 않고 그대로 진행해 오프라인 기록을 보여준다.
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    (async () => {
      // 인증 실패는 원격 랭킹 조회 자체를 막는 사유가 아니다 — fetchTopScores/fetchMyBest는
      // 각자 내부에서 오프라인(localStorage) 폴백을 처리하므로, 인증 실패와 별개로 계속 진행한다.
      try {
        const user = await ensureAnonymousAuth();
        if (!cancelled) setMyUid(user.uid);
      } catch (err) {
        console.error('[LeaderboardView] 인증 실패, 오프라인 모드로 계속 진행:', err);
      }
      if (cancelled) return;

      try {
        const [top, mine] = await Promise.all([fetchTopScores(unitId, 100), fetchMyBest(unitId)]);
        if (cancelled) return;
        setScores(dedupeByNicknameBest(top.scores));
        setMyBest(mine.entry);
        setOffline(top.offline || mine.offline);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : '랭킹을 불러오지 못했습니다.';
        console.error('[LeaderboardView] 랭킹 조회 실패:', err);
        setErrorMsg(msg);
        setScores([]);
        setMyBest(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const myRank = useMemo(() => {
    if (!myBest) return null;
    let idx = scores.findIndex((s) => s.docId === myBest.docId);
    if (idx < 0) {
      // docId가 어긋나는 경우(로컬↔원격 소스 불일치 등) 닉네임+점수 일치로 폴백한다.
      idx = scores.findIndex(
        (s) => s.nickname === myBest.nickname && s.weightedScore === myBest.weightedScore
      );
    }
    return idx >= 0 ? idx + 1 : null;
  }, [scores, myBest]);

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
              <span className="gradient-text">랭킹</span>
              {offline && (
                <span
                  style={{
                    marginLeft: 10,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fbbf24',
                    background: 'rgba(251,191,36,0.12)',
                    border: '1px solid rgba(251,191,36,0.3)',
                    borderRadius: 999,
                    padding: '3px 10px',
                    verticalAlign: 'middle',
                  }}
                >
                  오프라인 기록
                </span>
              )}
            </h1>
            <p style={{ fontSize: 13, color: '#71717a', marginTop: 4 }}>
              상위 {scores.length}명 (가중점수 기준 · 닉네임당 최고 기록)
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

        {errorMsg && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background: 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(244,63,94,0.25)',
              color: '#fda4af',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#71717a' }}>
            <div className="dot-spinner" style={{ display: 'inline-flex' }}>
              <div className="dot" />
              <div className="dot" />
              <div className="dot" />
            </div>
            <div style={{ marginTop: 16, fontSize: 13 }}>불러오는 중...</div>
          </div>
        ) : (
          <>
            {myBest && (
              <div
                className="clean-card"
                style={{
                  padding: 16,
                  marginBottom: 16,
                  border: '1px solid rgba(34,211,238,0.3)',
                  background: 'rgba(34,211,238,0.05)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#67e8f9', fontWeight: 700, marginBottom: 4 }}>
                      내 최고 기록
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#e4e4e7' }}>
                      {myBest.nickname} {myRank ? `· Top 100 ${myRank}위` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#67e8f9' }}>
                      {myBest.weightedScore.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: '#71717a' }}>
                      점수 {myBest.score} · {formatTime(myBest.survivalTime)} · Lv.{myBest.level}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="clean-card" style={{ padding: 0, overflow: 'hidden' }}>
              {scores.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#71717a', fontSize: 14 }}>
                  아직 등록된 기록이 없습니다.
                  <br />
                  <span style={{ fontSize: 12, color: '#52525b' }}>첫 도전자가 되어보세요!</span>
                </div>
              ) : (
                <div>
                  {scores.map((s, i) => {
                    const isMine = s.authUid === myUid;
                    const rank = i + 1;
                    return (
                      <div
                        key={s.docId}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '48px 1fr auto',
                          gap: 12,
                          padding: '12px 16px',
                          borderBottom: i < scores.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          background: isMine ? 'rgba(34,211,238,0.06)' : 'transparent',
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
                              color: isMine ? '#67e8f9' : '#e4e4e7',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.nickname}
                            {isMine && <span style={{ marginLeft: 8, fontSize: 10, color: '#67e8f9' }}>(나)</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                            점수 {s.score.toLocaleString()} · 생존 {formatTime(s.survivalTime)} · Lv.{s.level} · 처치 {s.kills}
                          </div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#a5b4fc' }}>
                          {s.weightedScore.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
