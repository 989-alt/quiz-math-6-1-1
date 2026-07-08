import { useEffect, useRef, useState } from 'react';
import { EventBus, GameEvents } from '../../game/utils/EventBus';

interface PlayerStateData {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  score: number;
  survivalTime: number;
  wave: number;
  monstersKilled: number;
}

export function GameHUD() {
  const [confirmStop, setConfirmStop] = useState(false);
  const confirmStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<PlayerStateData>({
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpToNext: 10,
    score: 0,
    survivalTime: 0,
    wave: 1,
    monstersKilled: 0,
  });

  useEffect(() => {
    const handleStateUpdate = (data: PlayerStateData) => {
      setState(data);
    };

    EventBus.on(GameEvents.PLAYER_STATE_UPDATE, handleStateUpdate);

    return () => {
      EventBus.off(GameEvents.PLAYER_STATE_UPDATE, handleStateUpdate);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (confirmStopTimeoutRef.current) clearTimeout(confirmStopTimeoutRef.current);
    };
  }, []);

  const handleStopClick = () => {
    if (confirmStop) {
      if (confirmStopTimeoutRef.current) clearTimeout(confirmStopTimeoutRef.current);
      setConfirmStop(false);
      EventBus.emit(GameEvents.STOP_GAME);
    } else {
      setConfirmStop(true);
      confirmStopTimeoutRef.current = setTimeout(() => {
        setConfirmStop(false);
      }, 2000);
    }
  };

  const hpPercent = Math.max(0, (state.hp / state.maxHp) * 100);
  const xpPercent = Math.max(0, (state.xp / state.xpToNext) * 100);
  const hpColor = hpPercent > 50 ? '#10b981' : hpPercent > 25 ? '#f59e0b' : '#ef4444';

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      padding: 'clamp(12px, 2vw, 20px)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 'clamp(8px, 1.5vw, 16px)',
      pointerEvents: 'none',
    }}>

      {/* Center: Play Time */}
      <div style={{
        position: 'absolute',
        top: 'clamp(12px, 2vw, 20px)',
        left: '50%',
        transform: 'translateX(-50%)',
        borderRadius: 16,
        padding: 'clamp(10px, 1.2vw, 16px) clamp(20px, 2.5vw, 32px)',
        background: 'rgba(10, 10, 15, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
        fontSize: 'clamp(22px, 3vw, 36px)',
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: '#e4e4e7',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatTime(state.survivalTime)}
      </div>

      {/* Left: Player Info */}
      <div style={{
        borderRadius: 16,
        padding: 'clamp(12px, 1.5vw, 20px)',
        minWidth: 'clamp(160px, 20vw, 280px)',
        background: 'rgba(10, 10, 15, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Player Name + Level */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 'clamp(10px, 1.2vw, 14px)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.8)' }} />
            <span style={{
              fontSize: 'clamp(10px, 1vw, 13px)',
              fontWeight: 700,
              color: '#fff',
            }}>
              Lv.{state.level}
            </span>
          </div>
          <span style={{ fontSize: 'clamp(11px, 1vw, 14px)', fontWeight: 600, color: '#e4e4e7' }}>
            Wave {state.wave}
          </span>
        </div>

        {/* HP Bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: hpColor }} />
              <span style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', fontWeight: 600, color: hpColor }}>HP</span>
            </div>
            <span style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', color: '#71717a', fontWeight: 500 }}>
              {Math.floor(state.hp)}/{state.maxHp}
            </span>
          </div>
          <div className="progress-container">
            <div
              className={`progress-bar progress-hp ${hpPercent <= 50 ? (hpPercent <= 25 ? 'danger' : 'warning') : ''}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* XP Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
              <span style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', fontWeight: 600, color: '#a5b4fc' }}>XP</span>
            </div>
            <span style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', color: '#71717a', fontWeight: 500 }}>
              {state.xp}/{state.xpToNext}
            </span>
          </div>
          <div className="progress-container">
            <div className="progress-bar progress-xp" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Right: Stop Button + Score & Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 그만하기 버튼 */}
        <button
          onClick={handleStopClick}
          style={{
            width: '100%',
            pointerEvents: 'auto',
            cursor: 'pointer',
            borderRadius: 16,
            padding: 'clamp(8px, 1vw, 12px)',
            background: confirmStop ? 'rgba(244, 63, 94, 0.2)' : 'rgba(10, 10, 15, 0.9)',
            border: confirmStop ? '1px solid rgba(244, 63, 94, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            color: confirmStop ? '#fda4af' : '#e4e4e7',
            fontSize: 'clamp(11px, 1vw, 13px)',
            fontWeight: 600,
          }}
        >
          {confirmStop ? '한 번 더 누르면 종료' : '그만하기'}
        </button>

        <div style={{
          borderRadius: 16,
          padding: 'clamp(12px, 1.5vw, 20px)',
          textAlign: 'right',
          background: 'rgba(10, 10, 15, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(12px)',
        }}>
          {/* Score */}
          <div style={{
            fontSize: 'clamp(18px, 2.2vw, 28px)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginBottom: 8,
          }}>
            <span className="gradient-text-amber">{state.score.toLocaleString()}</span>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <span style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', color: '#71717a', fontWeight: 500 }}>
                {state.monstersKilled} kills
              </span>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
