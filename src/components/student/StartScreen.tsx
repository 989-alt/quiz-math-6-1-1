import { useEffect, useState } from 'react';
import { UNIT } from '../../data/unit';

const NICKNAME_KEY = 'sqb:nickname';

interface StartScreenProps {
  onStart: (nickname: string) => void;
  onOpenLeaderboard: () => void;
  onBack: () => void;
}

/** 단일 단원 프로젝트의 시작 화면 — 닉네임만 입력하면 바로 게임 (프로젝트당 1단원 아키텍처) */
export function StartScreen({ onStart, onOpenLeaderboard, onBack }: StartScreenProps) {
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(NICKNAME_KEY);
    if (saved) setNickname(saved);
  }, []);

  const trimmed = nickname.trim();
  const canStart = trimmed.length >= 1 && trimmed.length <= 12;

  const handleStart = () => {
    if (!canStart) return;
    localStorage.setItem(NICKNAME_KEY, trimmed);
    onStart(trimmed);
  };

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              onClick={onOpenLeaderboard}
              className="btn-clean btn-cyan"
              style={{ padding: '12px', fontSize: 13, fontWeight: 700 }}
            >
              랭킹 보기
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
    </div>
  );
}
