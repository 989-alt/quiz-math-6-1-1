import { useEffect, useState } from 'react';
import { UNIT } from '../../data/unit';
import { DIFFICULTY_CONFIG, type Difficulty } from '../../game/difficulty';
import { GAME_MODE_CONFIG, GAME_MODE_ORDER, type GameMode } from '../../game/gameMode';
import { TutorialBooklet, TutorialPrompt } from './TutorialBooklet';

const NICKNAME_KEY = 'sqb:nickname';
const TUTORIAL_SEEN_KEY = 'sqb:tutorialSeen';

/** 쿠키/사이트데이터 차단 브라우저 등에서 localStorage 접근이 예외를 던져도 시작 화면이 크래시하지 않도록 보호 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장 실패는 무시(다음 세션에 값이 유지되지 않을 뿐)
  }
}

// 주 포인터가 터치인 기기(폰/태블릿) 판정 — GameContainer.detectMobile()과 동일 로직
function isTouchDevice(): boolean {
  const q = window.matchMedia?.('(pointer: coarse)');
  if (q) return q.matches;
  return window.innerWidth < 768 || 'ontouchstart' in window;
}

/** [게임 시작] 클릭(사용자 제스처) 안에서 호출 — 설치된 앱처럼 전체화면 진입 후 가로 모드 고정을
 *  시도한다. 카카오톡 등 인앱 브라우저는 요청 자체를 거부하므로 실패는 조용히 무시한다. */
function enterFullscreenAndLockLandscape(): void {
  try {
    const el = document.documentElement as unknown as {
      requestFullscreen?: () => Promise<void>;
      webkitRequestFullscreen?: () => void;
    };
    const lockLandscape = () => {
      const orientation = screen.orientation as unknown as {
        lock?: (orientation: string) => Promise<void>;
      };
      orientation.lock?.('landscape')?.catch(() => {});
    };
    if (el.requestFullscreen) {
      el.requestFullscreen().then(lockLandscape).catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      lockLandscape();
    }
  } catch {
    // 전체화면 미지원/거부 — 무시
  }
}

interface StartScreenProps {
  onStart: (nickname: string, difficulty: Difficulty, mode: GameMode) => void;
  onOpenLeaderboard: () => void;
  onBack: () => void;
}

const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];
const DIFFICULTY_EMOJI: Record<Difficulty, string> = { easy: '🟢', normal: '🟡', hard: '🔴' };

/** 단일 단원 프로젝트의 시작 화면 — 닉네임만 입력하면 바로 게임 (프로젝트당 1단원 아키텍처) */
export function StartScreen({ onStart, onOpenLeaderboard, onBack }: StartScreenProps) {
  const [nickname, setNickname] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [mode, setMode] = useState<GameMode>('adventure');
  const [showPrompt, setShowPrompt] = useState(false);
  const [showBooklet, setShowBooklet] = useState(false);

  useEffect(() => {
    const saved = safeGetItem(NICKNAME_KEY);
    if (saved) setNickname(saved);
    if (!safeGetItem(TUTORIAL_SEEN_KEY)) setShowPrompt(true);
  }, []);

  const answerPrompt = (openBooklet: boolean) => {
    safeSetItem(TUTORIAL_SEEN_KEY, '1');
    setShowPrompt(false);
    if (openBooklet) setShowBooklet(true);
  };

  const trimmed = nickname.trim();
  const canStart = trimmed.length >= 1 && trimmed.length <= 12;

  const handleStart = () => {
    if (!canStart) return;
    safeSetItem(NICKNAME_KEY, trimmed);
    if (isTouchDevice()) {
      enterFullscreenAndLockLandscape();
    }
    onStart(trimmed, difficulty, mode);
  };

  return (
    <div
      className="app-viewport"
      style={{
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

      <div
        className="animate-slide-up"
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 440,
        }}
      >
        <div className="clean-card" style={{ padding: 'clamp(28px, 4vw, 44px)', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: 999,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)',
              fontSize: 12,
              fontWeight: 700,
              color: '#a5b4fc',
              marginBottom: 20,
            }}
          >
            {UNIT.grade}학년 {UNIT.semester}학기 · 수학
          </div>

          <h1
            style={{
              fontSize: 'clamp(24px, 4vw, 34px)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#fafafa',
              marginBottom: 8,
            }}
          >
            {UNIT.unitNumber}단원 <span className="gradient-text">{UNIT.title}</span>
          </h1>
          <p style={{ fontSize: 13, color: '#71717a', marginBottom: 28, lineHeight: 1.7 }}>
            퀴즈를 맞혀 무기를 강화하고
            <br />
            몬스터의 파도에서 살아남으세요!
          </p>

          <div style={{ textAlign: 'left', marginBottom: 20 }}>
            <label
              htmlFor="nickname-input"
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 8 }}
            >
              닉네임 (1~12자)
            </label>
            <input
              id="nickname-input"
              className="clean-input"
              type="text"
              value={nickname}
              maxLength={12}
              placeholder="닉네임을 입력하세요"
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStart();
              }}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 15,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fafafa',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ textAlign: 'left', marginBottom: 20 }}>
            <label
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 8 }}
            >
              난이도
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {DIFFICULTY_ORDER.map((d) => {
                const cfg = DIFFICULTY_CONFIG[d];
                const selected = difficulty === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 10px',
                      borderRadius: 12,
                      background: selected ? `${cfg.badgeColor}1a` : 'rgba(255,255,255,0.03)',
                      border: selected ? `1.5px solid ${cfg.badgeColor}` : '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: selected ? cfg.badgeColor : '#e4e4e7',
                        marginBottom: 6,
                      }}
                    >
                      {DIFFICULTY_EMOJI[d]} {cfg.label}
                    </div>
                    <div style={{ fontSize: 10, color: '#8a8a94', lineHeight: 1.5 }}>
                      {cfg.descriptions.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ textAlign: 'left', marginBottom: 20 }}>
            <label
              style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 8 }}
            >
              모드
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {GAME_MODE_ORDER.map((m) => {
                const cfg = GAME_MODE_CONFIG[m];
                const selected = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 10px',
                      borderRadius: 12,
                      background: selected ? `${cfg.badgeColor}1a` : 'rgba(255,255,255,0.03)',
                      border: selected ? `1.5px solid ${cfg.badgeColor}` : '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: selected ? cfg.badgeColor : '#e4e4e7',
                        marginBottom: 6,
                      }}
                    >
                      {cfg.emoji} {cfg.label}
                    </div>
                    <div style={{ fontSize: 10, color: '#8a8a94', lineHeight: 1.5 }}>{cfg.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="btn-clean btn-indigo"
            style={{
              width: '100%',
              padding: '16px',
              fontSize: 16,
              fontWeight: 800,
              opacity: canStart ? 1 : 0.4,
              cursor: canStart ? 'pointer' : 'not-allowed',
              marginBottom: 12,
            }}
          >
            게임 시작
          </button>

          <button
            onClick={() => setShowBooklet(true)}
            className="btn-clean btn-ghost"
            style={{ width: '100%', padding: '12px', fontSize: 13, marginBottom: 8 }}
          >
            📖 게임 방법
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              onClick={onOpenLeaderboard}
              className="btn-clean btn-cyan"
              style={{ padding: '12px', fontSize: 13, fontWeight: 700 }}
            >
              내 기록
            </button>
            <button
              onClick={onBack}
              className="btn-clean btn-ghost"
              style={{ padding: '12px', fontSize: 13 }}
            >
              ← 홈으로
            </button>
          </div>
        </div>
      </div>

      {showPrompt && <TutorialPrompt onYes={() => answerPrompt(true)} onNo={() => answerPrompt(false)} />}
      {showBooklet && <TutorialBooklet onClose={() => setShowBooklet(false)} />}
    </div>
  );
}
