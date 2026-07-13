import { useEffect, useRef, useState } from 'react';
import { EventBus, GameEvents } from '../../game/utils/EventBus';
import { getSoundSettings, setSoundSettings } from '../../stores/soundSettings';
import { DIFFICULTY_CONFIG, type Difficulty } from '../../game/difficulty';

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

interface GameHUDProps {
  difficulty: Difficulty;
}

export function GameHUD({ difficulty }: GameHUDProps) {
  const [confirmStop, setConfirmStop] = useState(false);
  const confirmStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [soundSettings, setSoundSettingsState] = useState(() => getSoundSettings());
  const [isNarrow, setIsNarrow] = useState(false);
  const [state, setState] = useState<PlayerStateData>({
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpToNext: 20, // GAME_CONFIG.xp.baseToLevel (src/game/config.ts) — no React component imports Phaser config, so hardcoded to avoid pulling Phaser into this bundle chunk
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

  // 좁은 화면(모바일/작은 태블릿)에서는 중앙 타이머를 절대 중앙 정렬 대신
  // 좌/우 패널 사이 flex 흐름에 끼워 넣어 겹침을 원천 차단한다.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
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

  const toggleBgm = () => {
    const next = setSoundSettings({ bgm: !soundSettings.bgm });
    setSoundSettingsState(next);
    EventBus.emit(GameEvents.SOUND_SETTINGS_CHANGED, next);
  };

  const toggleSfx = () => {
    const next = setSoundSettings({ sfx: !soundSettings.sfx });
    setSoundSettingsState(next);
    EventBus.emit(GameEvents.SOUND_SETTINGS_CHANGED, next);
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
      {/* order:2 only takes effect when isNarrow drops position:absolute below
          (desktop keeps position:absolute, so it stays out of flex flow and
          order has no visual effect there). */}
      <div style={isNarrow ? {
        order: 2,
        flexShrink: 0,
        fontSize: 'clamp(15px, 4.5vw, 20px)',
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: '#e4e4e7',
        fontVariantNumeric: 'tabular-nums',
        textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.9)',
      } : {
        order: 2,
        position: 'absolute',
        top: 'clamp(12px, 2vw, 20px)',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 'clamp(22px, 3vw, 36px)',
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: '#e4e4e7',
        fontVariantNumeric: 'tabular-nums',
        textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.9)',
      }}>
        {formatTime(state.survivalTime)}
      </div>

      {/* Left: Player Info */}
      <div style={{
        order: 1,
        borderRadius: 16,
        padding: 'clamp(12px, 1.5vw, 20px)',
        minWidth: isNarrow ? 'clamp(110px, 34vw, 150px)' : 'clamp(160px, 20vw, 280px)',
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
          <span
            style={{
              fontSize: 'clamp(9px, 0.85vw, 11px)',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 999,
              color: DIFFICULTY_CONFIG[difficulty].badgeColor,
              background: `${DIFFICULTY_CONFIG[difficulty].badgeColor}1a`,
              border: `1px solid ${DIFFICULTY_CONFIG[difficulty].badgeColor}`,
            }}
          >
            {DIFFICULTY_CONFIG[difficulty].label}
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
      <div style={{ order: 3, display: 'flex', flexDirection: 'column', gap: 8 }}>
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

        {/* 브금/효과음 토글 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={toggleBgm}
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              borderRadius: 16,
              padding: 'clamp(6px, 0.8vw, 10px)',
              minHeight: isNarrow ? 40 : undefined,
              background: 'rgba(10, 10, 15, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              color: soundSettings.bgm ? '#e4e4e7' : '#52525b',
              fontSize: 'clamp(10px, 0.9vw, 12px)',
              fontWeight: 600,
              textDecoration: soundSettings.bgm ? 'none' : 'line-through',
            }}
          >
            🎵 브금
          </button>
          <button
            onClick={toggleSfx}
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              borderRadius: 16,
              padding: 'clamp(6px, 0.8vw, 10px)',
              minHeight: isNarrow ? 40 : undefined,
              background: 'rgba(10, 10, 15, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              color: soundSettings.sfx ? '#e4e4e7' : '#52525b',
              fontSize: 'clamp(10px, 0.9vw, 12px)',
              fontWeight: 600,
              textDecoration: soundSettings.sfx ? 'none' : 'line-through',
            }}
          >
            {soundSettings.sfx ? '🔊 효과음' : '🔇 효과음'}
          </button>
        </div>
      </div>
    </div>
  );
}
