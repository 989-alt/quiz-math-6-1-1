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

  useEffect(() => {
    setTimeLeft(duration);
    completedRef.current = false;
  }, [duration]);

  useEffect(() => {
    if (!isRunning || completedRef.current) return;

    const interval = setInterval(() => {
      if (document.hidden) return; // 탭 비활성 중엔 시간 소모 정지 — 복귀 시 남은 값부터 재개
      setTimeLeft((prev) => Math.max(0, prev - 0.1));
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning]);

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
