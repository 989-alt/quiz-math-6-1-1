import { useEffect, useRef, useState } from 'react';
import { UNIT, weightedScore } from '../../data/unit';
import { isFirebaseConfigured, submitScore } from '../../services/firebase';

interface PostGameOverlayProps {
  nickname: string;
  finish: { score: number; level: number; survivalTime: number; monstersKilled: number; cleared: boolean };
  onRestart: () => void;
  onExit: () => void;
  onShowLeaderboard: () => void;
}

type SubmitState = 'idle' | 'submitting' | 'done' | 'error' | 'skipped';

export function PostGameOverlay({
  nickname,
  finish,
  onRestart,
  onExit,
  onShowLeaderboard,
}: PostGameOverlayProps) {
  const unit = UNIT;
  const w = weightedScore(finish.score, finish.survivalTime, finish.level);
  const [state, setState] = useState<SubmitState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setState('skipped');
      return;
    }
    if (submittedRef.current) return;
    submittedRef.current = true;
    setState('submitting');
    submitScore({
      nickname,
      unitId: UNIT.unitId,
      grade: UNIT.grade,
      semester: UNIT.semester,
      score: finish.score,
      survivalTime: finish.survivalTime,
      level: finish.level,
      kills: finish.monstersKilled,
      weightedScore: w,
    })
      .then(() => {
        setState('done');
      })
      .catch((err) => {
        setState('error');
        setErrorMsg(err instanceof Error ? err.message : String(err));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(10,10,15,0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 'clamp(16px, 4vw, 48px)',
      }}
    >
      <div
        className="clean-card animate-scale-in"
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 'clamp(24px, 4vw, 40px)',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(22px, 3.5vw, 32px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: finish.cleared ? '#fbbf24' : '#f43f5e',
            marginBottom: 8,
          }}
        >
          {finish.cleared ? '🎉 게임 클리어!' : '게임 오버'}
        </h2>
        {finish.cleared && (
          <div style={{ fontSize: 13, color: '#fcd34d', fontWeight: 700, marginBottom: 6 }}>
            무기 완성 + 최종 보스 처치
          </div>
        )}
        <div style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>
          {unit.grade}학년 {unit.semester}학기 · {unit.unitNumber}단원 {unit.title}
        </div>

        <div
          style={{
            padding: '20px 16px',
            borderRadius: 14,
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 11, color: '#a5b4fc', fontWeight: 700, marginBottom: 6 }}>가중 점수</div>
          <div style={{ fontSize: 'clamp(32px, 6vw, 48px)', fontWeight: 800, color: '#a5b4fc', lineHeight: 1 }}>
            {w.toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
          <Stat label="점수" value={finish.score.toLocaleString()} />
          <Stat label="생존" value={formatTime(finish.survivalTime)} />
          <Stat label="레벨" value={`Lv.${finish.level}`} />
          <Stat label="처치" value={`${finish.monstersKilled}`} />
        </div>

        <div
          style={{
            fontSize: 12,
            color:
              state === 'done'
                ? '#34d399'
                : state === 'error'
                ? '#fda4af'
                : state === 'skipped'
                ? '#fbbf24'
                : '#71717a',
            marginBottom: 20,
            minHeight: 18,
          }}
        >
          {state === 'submitting' && '랭킹 등록 중...'}
          {state === 'done' && '✓ 랭킹 등록 완료'}
          {state === 'error' && `등록 실패: ${errorMsg}`}
          {state === 'skipped' && 'Firebase 미설정 — 랭킹 등록 생략'}
          {state === 'idle' && ' '}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <button
            onClick={onShowLeaderboard}
            className="btn-clean btn-cyan"
            style={{ padding: '12px 8px', fontSize: 13, fontWeight: 700 }}
            disabled={state === 'submitting'}
          >
            랭킹
          </button>
          <button
            onClick={onRestart}
            className="btn-clean btn-indigo"
            style={{ padding: '12px 8px', fontSize: 13, fontWeight: 700 }}
          >
            다시 하기
          </button>
          <button
            onClick={onExit}
            className="btn-clean btn-ghost"
            style={{ padding: '12px 8px', fontSize: 13 }}
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '12px 10px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ fontSize: 10, color: '#71717a', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#e4e4e7' }}>{value}</div>
    </div>
  );
}
