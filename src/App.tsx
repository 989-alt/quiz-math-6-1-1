import { useCallback, useEffect, useState } from 'react';
import { GameContainer } from './components/student/GameContainer';
import { StartScreen } from './components/student/StartScreen';
import { LeaderboardView } from './components/leaderboard/LeaderboardView';
import { UNIT } from './data/unit';

type AppView = 'home' | 'play' | 'game' | 'leaderboard';

function DotCluster({
  x,
  y,
  color,
  delay = 0,
  size = 'md',
}: {
  x: string;
  y: string;
  color: string;
  delay?: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: { dot: 4, gap: 4 },
    md: { dot: 6, gap: 6 },
    lg: { dot: 8, gap: 8 },
  };
  const s = sizes[size];

  return (
    <div
      className="dot-cluster"
      style={{
        left: x,
        top: y,
        color,
        animationDelay: `${delay}s`,
        gap: s.gap,
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="dot"
          style={{ width: s.dot, height: s.dot, animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

function App() {
  const [view, setView] = useState<AppView>('home');
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/play')) setView('play');
      else if (hash.startsWith('#/leaderboard')) setView('leaderboard');
      else setView('home');
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigateHome = useCallback(() => {
    setNickname(null);
    window.location.hash = '/';
    setView('home');
  }, []);

  const handleStartGame = useCallback((name: string) => {
    setNickname(name);
    setView('game');
  }, []);

  if (view === 'play') {
    return (
      <StartScreen
        onStart={handleStartGame}
        onOpenLeaderboard={() => setView('leaderboard')}
        onBack={navigateHome}
      />
    );
  }

  if (view === 'game' && nickname) {
    return (
      <GameContainer
        nickname={nickname}
        onExit={navigateHome}
        onShowLeaderboard={() => setView('leaderboard')}
      />
    );
  }

  if (view === 'leaderboard') {
    return <LeaderboardView onBack={navigateHome} />;
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(20px, 5vw, 80px)',
        position: 'relative',
        overflow: 'hidden',
        background: '#0a0a0f',
      }}
    >
      <div className="fantasy-bg-image" />
      <div className="fantasy-aurora" />
      <div className="fantasy-stars" />
      <div className="dot-grid-bg" />
      <div className="floating-dots" style={{ inset: 0, position: 'absolute' }}>
        <DotCluster x="8%" y="15%" color="#a78bfa" delay={0} size="lg" />
        <DotCluster x="85%" y="20%" color="#22d3ee" delay={1.5} size="md" />
        <DotCluster x="12%" y="75%" color="#fbbf24" delay={2} size="md" />
        <DotCluster x="80%" y="70%" color="#f59e0b" delay={0.5} size="lg" />
        <DotCluster x="50%" y="8%" color="#8b5cf6" delay={3} size="sm" />
        <DotCluster x="25%" y="45%" color="#a5b4fc" delay={1} size="sm" />
        <DotCluster x="75%" y="45%" color="#22d3ee" delay={2.5} size="sm" />
      </div>

      <div
        className="animate-slide-up"
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 'clamp(340px, 55vw, 680px)',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 'clamp(32px, 6vh, 72px)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'clamp(20px, 3vh, 36px)' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 'clamp(6px, 1vw, 12px)',
                padding: 'clamp(12px, 2vw, 24px)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 'clamp(16px, 2vw, 24px)',
              }}
            >
              {[
                '#6366f1', '#8b5cf6', '#a78bfa', '#8b5cf6', '#6366f1',
                '#22d3ee', '#6366f1', '#f43f5e', '#6366f1', '#22d3ee',
                '#10b981', '#f59e0b', '#6366f1', '#f59e0b', '#10b981',
              ].map((color, i) => (
                <div
                  key={i}
                  style={{
                    width: 'clamp(10px, 1.5vw, 16px)',
                    height: 'clamp(10px, 1.5vw, 16px)',
                    borderRadius: '50%',
                    background: color,
                    opacity: 0.8,
                    animation: 'dot-pulse 2s ease-in-out infinite',
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          </div>

          <h1
            style={{
              fontSize: 'clamp(32px, 7vw, 80px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              marginBottom: 'clamp(8px, 1.5vh, 16px)',
            }}
          >
            <span className="gradient-text">Quiz</span>
          </h1>
          <h2
            style={{
              fontSize: 'clamp(20px, 4.5vw, 52px)',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: '#fafafa',
            }}
          >
            Survivor
          </h2>
        </div>

        <p
          style={{
            fontSize: 'clamp(13px, 1.5vw, 18px)',
            color: '#71717a',
            marginBottom: 'clamp(32px, 6vh, 72px)',
            lineHeight: 1.7,
            fontWeight: 500,
          }}
        >
          {UNIT.grade}학년 {UNIT.semester}학기 「{UNIT.title}」 퀴즈로 무기를 얻고
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              background: '#6366f1',
              borderRadius: '50%',
              margin: '0 12px',
              verticalAlign: 'middle',
            }}
          />
          몬스터의 파도에서 살아남아라!
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 'clamp(16px, 2.5vw, 32px)',
            maxWidth: 'clamp(320px, 45vw, 560px)',
            margin: '0 auto',
          }}
        >
          <button
            onClick={() => {
              window.location.hash = '/play';
              setView('play');
            }}
            className="clean-card card-indigo"
            style={{
              padding: 'clamp(24px, 4vw, 48px) clamp(16px, 2.5vw, 32px)',
              textAlign: 'center',
              cursor: 'pointer',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            }}
          >
            <div
              style={{
                display: 'inline-grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 4,
                padding: 12,
                background: 'rgba(99, 102, 241, 0.1)',
                borderRadius: 16,
                marginBottom: 'clamp(12px, 2vh, 20px)',
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1' }} />
            </div>
            <div
              style={{
                fontSize: 'clamp(15px, 1.8vw, 20px)',
                fontWeight: 700,
                color: '#a5b4fc',
                marginBottom: 'clamp(6px, 1vh, 12px)',
              }}
            >
              시작하기
            </div>
            <div
              style={{
                fontSize: 'clamp(11px, 1vw, 14px)',
                color: '#6b7280',
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              닉네임 입력
              <br />
              게임 플레이
            </div>
          </button>

          <button
            onClick={() => {
              window.location.hash = '/leaderboard';
              setView('leaderboard');
            }}
            className="clean-card card-cyan"
            style={{
              padding: 'clamp(24px, 4vw, 48px) clamp(16px, 2.5vw, 32px)',
              textAlign: 'center',
              cursor: 'pointer',
              border: '1px solid rgba(34, 211, 238, 0.2)',
            }}
          >
            <div
              style={{
                display: 'inline-grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 4,
                padding: 12,
                background: 'rgba(34, 211, 238, 0.1)',
                borderRadius: 16,
                marginBottom: 'clamp(12px, 2vh, 20px)',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22d3ee' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4' }} />
            </div>
            <div
              style={{
                fontSize: 'clamp(15px, 1.8vw, 20px)',
                fontWeight: 700,
                color: '#67e8f9',
                marginBottom: 'clamp(6px, 1vh, 12px)',
              }}
            >
              랭킹 보기
            </div>
            <div
              style={{
                fontSize: 'clamp(11px, 1vw, 14px)',
                color: '#6b7280',
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              Top 100
              <br />
              내 등수 확인
            </div>
          </button>
        </div>

        <div style={{ marginTop: 'clamp(32px, 6vh, 72px)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.15)',
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', color: '#52525b', fontWeight: 500 }}>
            © 2026 Quiz Survivor
          </p>
          <p style={{ fontSize: 'clamp(9px, 0.8vw, 11px)', color: '#3f3f46', marginTop: 6 }}>
            22개정 교육과정 · {UNIT.grade}학년 {UNIT.semester}학기 수학 「{UNIT.title}」 · Phaser 3 + React + Firebase
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
