import { useEffect, useRef, useState } from 'react';
import { EventBus, GameEvents } from '../../game/utils/EventBus';
import { getSoundSettings, setSoundSettings } from '../../stores/soundSettings';
import { DIFFICULTY_CONFIG, type Difficulty } from '../../game/difficulty';
import { TIME_ATTACK_DURATION_SEC, type GameMode } from '../../game/gameMode';
import { getLocalScores } from '../../services/firebase';
import { UNIT } from '../../data/unit';

// 추월한 과거 기록의 순위별 메달
function medalOf(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎯';
}

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
  mode: GameMode;
  onPause: () => void;
  /** 터치 기기에서만 전체화면 버튼을 노출 */
  showFullscreen: boolean;
  /** 모바일(터치) 기기 여부 — true면 화면을 덜 가리는 축소 HUD를 렌더한다 */
  isMobile: boolean;
}

export function GameHUD({ difficulty, mode, onPause, showFullscreen, isMobile }: GameHUDProps) {
  const [soundSettings, setSoundSettingsState] = useState(() => getSoundSettings());
  const [isNarrow, setIsNarrow] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  // 고스트 추격: 게임 시작 시 이 모드·난이도의 과거 획득 점수(score)를 오름차순 타깃으로 로드한다
  // (한 기기 = 한 학생이므로 localStorage 기록이 곧 '과거의 나'다).
  const [ghostTargets, setGhostTargets] = useState<number[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const prevPassedRef = useRef(0);
  const flashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const targets = getLocalScores(UNIT.unitId)
      .filter((s) => {
        const m = s.mode === 'timeAttack' ? 'timeAttack' : 'adventure';
        const d = s.difficulty === 'normal' || s.difficulty === 'hard' ? s.difficulty : 'easy';
        return m === mode && d === difficulty;
      })
      .map((s) => s.score)
      .sort((a, b) => a - b);
    setGhostTargets(targets);
    prevPassedRef.current = 0;
  }, [mode, difficulty]);

  useEffect(() => () => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
  }, []);

  useEffect(() => {
    const handleStateUpdate = (data: PlayerStateData) => {
      setState(data);
    };

    EventBus.on(GameEvents.PLAYER_STATE_UPDATE, handleStateUpdate);

    return () => {
      EventBus.off(GameEvents.PLAYER_STATE_UPDATE, handleStateUpdate);
    };
  }, []);

  // 일시정지 메뉴(모바일)의 브금/효과음 토글과 같은 저장소를 공유하므로,
  // 그쪽에서 바뀐 값도 여기 반영해 두 UI가 어긋나지 않게 한다.
  useEffect(() => {
    const handleSoundChange = (data: { bgm: boolean; sfx: boolean }) => {
      setSoundSettingsState(data);
    };
    EventBus.on(GameEvents.SOUND_SETTINGS_CHANGED, handleSoundChange);
    return () => {
      EventBus.off(GameEvents.SOUND_SETTINGS_CHANGED, handleSoundChange);
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

  // 전체화면 토글 (터치 태블릿 등) — 아이콘 상태를 fullscreenchange로 동기화한다.
  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(
        !!(document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement)
      );
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = () => {
    // 일부 인앱 브라우저는 요청을 거부하므로 try/catch로 보호
    try {
      const doc = document as unknown as {
        webkitFullscreenElement?: Element;
        webkitExitFullscreen?: () => void;
      };
      const el = document.documentElement as unknown as {
        requestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => void;
      };
      const active = document.fullscreenElement || doc.webkitFullscreenElement;
      if (!active) {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      }
    } catch {
      // 무시 — 전체화면 미지원/거부
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

  // 10분 챌린지: 경과 시간 대신 남은 시간을 카운트다운으로 보여주고, 1분 미만이면 강조 색으로 전환
  const isTimeAttack = mode === 'timeAttack';
  const remainingSec = Math.max(0, TIME_ATTACK_DURATION_SEC - state.survivalTime);
  const timerLabel = isTimeAttack ? formatTime(remainingSec) : formatTime(state.survivalTime);
  const timerColor = isTimeAttack && remainingSec < 60 ? '#ef4444' : '#e4e4e7';

  // 고스트 추격 계산: 실제 획득 점수(score)로 '바로 위 기록까지의 격차'를 구한다. 생존 시간이
  // 아니라 플레이어가 포인트를 얻을 때만 격차가 줄도록 raw score를 기준으로 삼는다.
  const livePoints = state.score;
  const totalGhosts = ghostTargets.length;
  const passedCount = ghostTargets.filter((t) => livePoints >= t).length;
  const nextTarget = ghostTargets.find((t) => t > livePoints); // undefined = 전부 추월(신기록 페이스)
  const nextRank = nextTarget !== undefined ? totalGhosts - passedCount : 0; // 1 = 역대 최고
  const gap = nextTarget !== undefined ? nextTarget - livePoints : 0;
  const prevTarget = passedCount > 0 ? ghostTargets[passedCount - 1] : 0;
  const chasePct =
    nextTarget !== undefined
      ? Math.max(0, Math.min(100, ((livePoints - prevTarget) / (nextTarget - prevTarget)) * 100))
      : 100;

  // 과거 기록을 새로 추월한 순간 0.8초 플래시로 알린다.
  useEffect(() => {
    if (totalGhosts === 0) {
      prevPassedRef.current = 0;
      return;
    }
    if (passedCount > prevPassedRef.current) {
      const rankPassed = totalGhosts - (passedCount - 1); // 방금 넘어선 기록 중 최상위
      setFlash(`${medalOf(rankPassed)} ${rankPassed}위 기록 추월!`);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => setFlash(null), 1200);
    }
    prevPassedRef.current = passedCount;
  }, [passedCount, totalGhosts]);

  // 모바일: 화면을 덜 가리는 축소 HUD. 브금/효과음 토글은 일시정지 메뉴로 이동한다.
  if (isMobile) {
    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 6,
        pointerEvents: 'none',
      }}>
        {/* Left: 축소 상태 스트립 */}
        <div style={{
          order: 1,
          borderRadius: 10,
          padding: '6px 8px',
          maxWidth: 148,
          background: 'rgba(10, 10, 15, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff' }}>
              Lv.{state.level}·W{state.wave}
            </span>
            <div
              title={DIFFICULTY_CONFIG[difficulty].label}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: DIFFICULTY_CONFIG[difficulty].badgeColor,
                flexShrink: 0,
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <div style={{ width: 120, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
              <div
                className={`progress-bar progress-hp ${hpPercent <= 50 ? (hpPercent <= 25 ? 'danger' : 'warning') : ''}`}
                style={{ width: `${hpPercent}%`, height: '100%' }}
              />
            </div>
            <span style={{ fontSize: 9, color: '#e4e4e7', fontWeight: 600, flexShrink: 0 }}>
              {Math.floor(state.hp)}
            </span>
          </div>
          <div style={{ width: 120, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
            <div className="progress-bar progress-xp" style={{ width: `${xpPercent}%`, height: '100%' }} />
          </div>
        </div>

        {/* Center: 타이머 (축소) */}
        <div style={{
          order: 2,
          flexShrink: 0,
          fontSize: 'clamp(9px, 2.8vw, 12px)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: timerColor,
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.9)',
        }}>
          {timerLabel}
        </div>

        {/* Right: 일시정지/전체화면 + 점수 (축소, 브금/효과음은 일시정지 메뉴로 이동) */}
        <div style={{ order: 3, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={onPause}
              aria-label="일시정지"
              style={{
                pointerEvents: 'auto',
                cursor: 'pointer',
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'rgba(10, 10, 15, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#e4e4e7',
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ⏸
            </button>
            {showFullscreen && (
              <button
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
                style={{
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: 'rgba(10, 10, 15, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#e4e4e7',
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ⛶
              </button>
            )}
          </div>
          <div style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(10, 10, 15, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>
              <span className="gradient-text-amber">{state.score.toLocaleString()}</span>
              <span style={{ color: '#71717a', fontWeight: 500 }}> · {state.monstersKilled}킬</span>
            </span>
          </div>

          {/* 고스트 추격 (모바일 축소) */}
          {(totalGhosts > 0 || flash) && (
            <div style={{
              padding: '3px 10px',
              borderRadius: 999,
              background: flash ? 'rgba(251,191,36,0.2)' : 'rgba(10, 10, 15, 0.85)',
              border: flash ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
              whiteSpace: 'nowrap',
            }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: flash || nextTarget === undefined ? '#fbbf24' : '#67e8f9',
              }}>
                {flash
                  ? flash
                  : nextTarget === undefined
                  ? '🏆 신기록!'
                  : `${medalOf(nextRank)} ${nextRank}위까지 ▲${gap.toLocaleString()}`}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

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
        color: timerColor,
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
        color: timerColor,
        fontVariantNumeric: 'tabular-nums',
        textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.9)',
      }}>
        {timerLabel}
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
        {/* 일시정지 + (터치 기기) 전체화면 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onPause}
            style={{
              flex: 1,
              pointerEvents: 'auto',
              cursor: 'pointer',
              borderRadius: 16,
              padding: 'clamp(8px, 1vw, 12px)',
              background: 'rgba(10, 10, 15, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              color: '#e4e4e7',
              fontSize: 'clamp(11px, 1vw, 13px)',
              fontWeight: 600,
            }}
          >
            ⏸ 일시정지
          </button>
          {showFullscreen && (
            <button
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
              style={{
                flexShrink: 0,
                pointerEvents: 'auto',
                cursor: 'pointer',
                borderRadius: 16,
                padding: 'clamp(8px, 1vw, 12px)',
                background: 'rgba(10, 10, 15, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(12px)',
                color: '#e4e4e7',
                fontSize: 'clamp(13px, 1.2vw, 16px)',
                fontWeight: 600,
              }}
            >
              ⛶
            </button>
          )}
        </div>

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

        {/* 고스트 추격 지표: 과거의 나(종합점수)를 실시간으로 따라잡는 순위 경쟁 */}
        <div style={{
          borderRadius: 16,
          padding: 'clamp(10px, 1.2vw, 14px)',
          background: flash ? 'rgba(251,191,36,0.18)' : 'rgba(10, 10, 15, 0.9)',
          border: flash ? '1px solid rgba(251,191,36,0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(12px)',
          transition: 'background 0.2s, border-color 0.2s',
        }}>
          {flash ? (
            <div style={{ fontSize: 'clamp(12px, 1.1vw, 15px)', fontWeight: 800, color: '#fbbf24', textAlign: 'right' }}>
              {flash}
            </div>
          ) : totalGhosts === 0 ? (
            <div style={{ fontSize: 'clamp(11px, 1vw, 13px)', fontWeight: 700, color: '#a5b4fc', textAlign: 'right' }}>
              ✨ 첫 기록에 도전 중!
            </div>
          ) : nextTarget === undefined ? (
            <div style={{ fontSize: 'clamp(12px, 1.1vw, 15px)', fontWeight: 800, color: '#fbbf24', textAlign: 'right' }}>
              🏆 신기록 페이스!
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', color: '#a1a1aa', fontWeight: 600 }}>
                  {medalOf(nextRank)} {nextRank}위 기록까지
                </span>
                <span style={{ fontSize: 'clamp(13px, 1.3vw, 17px)', fontWeight: 800, color: '#67e8f9' }}>
                  ▲{gap.toLocaleString()}
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                <div style={{
                  width: `${chasePct}%`,
                  height: '100%',
                  borderRadius: 3,
                  background: 'linear-gradient(90deg, #22d3ee, #67e8f9)',
                  transition: 'width 0.2s',
                }} />
              </div>
            </>
          )}
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
