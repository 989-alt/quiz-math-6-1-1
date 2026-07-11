import React, { useState, useEffect, useRef } from 'react';

interface TimerProps {
  duration: number;
  onComplete: () => void;
  isRunning: boolean;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
}

export function Timer({ duration, onComplete, isRunning, size = 'md', showProgress = true }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const completedRef = useRef(false);
  // 시작 시각(performance.now()) 기준으로 잔여시간을 계산 — tick 횟수 누적 방식은 인터벌 지연/스로틀 시
  // 실제 경과시간과 어긋나므로, 매 tick마다 실제 경과시간을 다시 측정해 잔여시간을 산출한다.
  const startRef = useRef(performance.now());
  // 탭이 hidden 상태였던 누적 시간(ms) — "탭 비활성 중엔 시간 소모 정지" 동작 보존용
  const pausedMsRef = useRef(0);
  const hiddenSinceRef = useRef<number | null>(document.hidden ? performance.now() : null);

  useEffect(() => {
    setTimeLeft(duration);
    completedRef.current = false;
    startRef.current = performance.now();
    pausedMsRef.current = 0;
    hiddenSinceRef.current = document.hidden ? performance.now() : null;
  }, [duration]);

  useEffect(() => {
    if (!isRunning || completedRef.current) return;

    const interval = setInterval(() => {
      const now = performance.now();
      if (document.hidden) {
        // 탭 비활성 중엔 시간 소모 정지 — 복귀 시 남은 값부터 재개
        if (hiddenSinceRef.current === null) hiddenSinceRef.current = now;
        return;
      }
      if (hiddenSinceRef.current !== null) {
        pausedMsRef.current += now - hiddenSinceRef.current;
        hiddenSinceRef.current = null;
      }
      const elapsedSeconds = (now - startRef.current - pausedMsRef.current) / 1000;
      setTimeLeft(Math.max(0, duration - elapsedSeconds));
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, duration]);

  // onComplete는 state updater 밖(effect)에서 호출 — 부모 setState during render 방지
  useEffect(() => {
    if (timeLeft <= 0 && isRunning && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [timeLeft, isRunning, onComplete]);

  const progress = (timeLeft / duration) * 100;
  const isLow = timeLeft < 5;

  const barHeights: Record<string, string> = {
    sm: 'clamp(4px, 0.4vw, 6px)',
    md: 'clamp(6px, 0.7vw, 10px)',
    lg: 'clamp(8px, 1vw, 14px)',
  };

  const textSizes: Record<string, string> = {
    sm: 'clamp(6px, 0.65vw, 8px)',
    md: 'clamp(8px, 0.9vw, 12px)',
    lg: 'clamp(10px, 1.2vw, 16px)',
  };

  const barColor = progress > 50 ? '#00b894' : progress > 25 ? '#fdcb6e' : '#d63031';

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'clamp(2px, 0.3vw, 4px)' }}>
        <span className="font-pixel" style={{
          fontSize: textSizes[size],
          color: isLow ? '#d63031' : '#fff',
          animation: isLow ? 'pulse-glow 0.5s ease-in-out infinite' : 'none',
        }}>
          ⏰ {Math.ceil(timeLeft)}s
        </span>
      </div>
      {showProgress && (
        <div style={{
          width: '100%',
          height: barHeights[size],
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            borderRadius: '999px',
            background: `linear-gradient(90deg, ${barColor}, ${barColor}88)`,
            transition: 'width 0.1s linear',
            boxShadow: isLow ? `0 0 12px ${barColor}66` : 'none',
          }} />
        </div>
      )}
    </div>
  );
}
