import { useState, useCallback, useRef, useEffect } from 'react';
import { Timer } from '../shared/Timer';
import { FracText } from '../shared/FracText';
import type { Quiz } from '../../types/quiz';

interface QuizOverlayProps {
  quiz: Quiz;
  timeLimit: number;
  streak?: number;
  onAnswer: (index: number, isCorrect: boolean, timeSpent: number) => void;
}

export function QuizOverlay({ quiz, timeLimit, streak = 0, onAnswer }: QuizOverlayProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // 문제가 표시된 시각. 문제가 바뀔 때마다 리셋 → 정답 잠금 시점까지의 실제 소요 시간 측정
  const shownAtRef = useRef<number>(performance.now());
  // 정답 잠금(선택) 순간에 측정한 소요 시간(초) — 오답 [확인]까지의 해설 대기시간은 제외
  const lockedTimeRef = useRef<number>(0);
  // 정답 시 1.2초 후 onAnswer를 호출하는 setTimeout id — 언마운트 시 정리해 소멸 후 콜백 실행을 방지
  const advanceTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    shownAtRef.current = performance.now();
  }, [quiz]);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current !== null) {
        clearTimeout(advanceTimeoutRef.current);
      }
    };
  }, []);

  // 문제 표시~지금까지의 경과 시간(초). [0, timeLimit]로 클램프
  const elapsedSeconds = useCallback(() => {
    const s = (performance.now() - shownAtRef.current) / 1000;
    return Math.min(Math.max(s, 0), timeLimit);
  }, [timeLimit]);

  const optionLabels = ['A', 'B', 'C', 'D'];
  const optionColors = ['#f43f5e', '#6366f1', '#f59e0b', '#10b981'];

  const isCorrect = !timedOut && selectedIndex === quiz.correctIndex;

  // 설계 §6: 정답은 1.2초 자동 진행, 오답/타임아웃은 [확인] 버튼까지 해설 유지 (읽기 시간 보장)
  const handleSelect = useCallback((index: number) => {
    if (isAnswered) return;
    // 소요 시간은 선택(잠금) 순간에 측정 — 정답 후 1.2초 축하 지연은 포함하지 않음
    const timeSpent = elapsedSeconds();
    lockedTimeRef.current = timeSpent;
    setSelectedIndex(index);
    setIsAnswered(true);
    setShowResult(true);

    if (index === quiz.correctIndex) {
      advanceTimeoutRef.current = window.setTimeout(() => onAnswer(index, true, timeSpent), 1200);
    }
  }, [isAnswered, quiz.correctIndex, onAnswer, elapsedSeconds]);

  const handleTimeUp = useCallback(() => {
    if (!isAnswered) {
      setIsAnswered(true);
      setTimedOut(true);
      setShowResult(true);
    }
  }, [isAnswered]);

  const handleConfirmWrong = useCallback(() => {
    // 타임아웃은 제한시간 전부 소모, 오답은 선택 순간에 측정한 시간 사용
    const timeSpent = timedOut ? timeLimit : lockedTimeRef.current;
    onAnswer(timedOut ? -1 : selectedIndex ?? -1, false, timeSpent);
  }, [onAnswer, timedOut, selectedIndex, timeLimit]);

  const getOptionStyle = (index: number): React.CSSProperties => {
    if (!isAnswered) {
      return {
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      };
    }
    if (index === quiz.correctIndex) {
      return {
        background: 'rgba(16, 185, 129, 0.15)',
        border: '1px solid rgba(16, 185, 129, 0.5)',
        boxShadow: '0 0 24px rgba(16, 185, 129, 0.2)',
      };
    }
    if (index === selectedIndex) {
      return {
        background: 'rgba(244, 63, 94, 0.15)',
        border: '1px solid rgba(244, 63, 94, 0.5)',
      };
    }
    return {
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.04)',
      opacity: 0.4,
    };
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(10, 10, 15, 0.9)',
      backdropFilter: 'blur(8px)',
      zIndex: 50,
      padding: 'clamp(16px, 4vw, 48px)',
    }}>
      <div
        className="animate-scale-in"
        style={{
          width: '100%',
          maxWidth: 'clamp(380px, 55vw, 720px)',
        }}
      >
        {/* Timer + Streak */}
        <div style={{ marginBottom: 'clamp(16px, 2.5vw, 28px)', position: 'relative' }}>
          <Timer duration={timeLimit} onComplete={handleTimeUp} isRunning={!isAnswered} size="md" />
          {streak >= 2 && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(251, 191, 36, 0.12)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              fontSize: 12,
              fontWeight: 700,
              color: '#fbbf24',
            }}>
              {streak}연속 · XP +{Math.min(streak * 5, 25)}%
            </div>
          )}
        </div>

        {/* Question */}
        <div
          className="glass-panel"
          style={{
            padding: 'clamp(20px, 3vw, 32px)',
            marginBottom: 'clamp(16px, 2.5vw, 28px)',
          }}
        >
          <h2 style={{
            fontSize: 'clamp(15px, 1.8vw, 22px)',
            fontWeight: 600,
            color: '#fafafa',
            lineHeight: 1.7,
          }}>
            <FracText text={quiz.question} />
          </h2>
        </div>

        {/* Options */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
          {quiz.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleSelect(index)}
              disabled={isAnswered}
              style={{
                ...getOptionStyle(index),
                padding: 'clamp(14px, 2vw, 22px) clamp(18px, 2.5vw, 28px)',
                borderRadius: 14,
                textAlign: 'left',
                cursor: isAnswered ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              {/* Option dot indicator */}
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: `${optionColors[index]}20`,
                border: `2px solid ${optionColors[index]}50`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: optionColors[index],
                }}>
                  {optionLabels[index]}
                </span>
              </div>
              <span style={{
                fontSize: 'clamp(14px, 1.5vw, 18px)',
                fontWeight: 500,
                color: '#e4e4e7',
              }}>
                <FracText text={option} />
              </span>
            </button>
          ))}
        </div>

        {/* Result */}
        {showResult && (
          <div
            className="animate-slide-up"
            style={{
              marginTop: 'clamp(16px, 2.5vw, 28px)',
              padding: 'clamp(16px, 2vw, 24px)',
              borderRadius: 16,
              textAlign: 'center',
              background: isCorrect
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(244, 63, 94, 0.1)',
              border: `1px solid ${isCorrect
                ? 'rgba(16, 185, 129, 0.3)'
                : 'rgba(244, 63, 94, 0.3)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isCorrect ? '#10b981' : '#f43f5e',
              }} />
              <p style={{
                fontSize: 'clamp(16px, 2vw, 24px)',
                fontWeight: 700,
                color: isCorrect ? '#6ee7b7' : '#fda4af',
              }}>
                {isCorrect ? '정답입니다!' : timedOut ? '시간 초과!' : '오답입니다'}
              </p>
            </div>
            {quiz.explanation && (
              <p style={{
                fontSize: 'clamp(13px, 1.1vw, 15px)',
                color: '#d4d4d8',
                lineHeight: 1.8,
              }}>
                <FracText text={quiz.explanation} />
              </p>
            )}
            {!isCorrect && (
              <button
                onClick={handleConfirmWrong}
                className="btn-clean btn-indigo"
                style={{
                  marginTop: 16,
                  padding: '12px 40px',
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                확인
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
