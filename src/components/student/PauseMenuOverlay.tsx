import { useEffect, useState } from 'react';
import { EventBus, GameEvents } from '../../game/utils/EventBus';
import { getSoundSettings, setSoundSettings } from '../../stores/soundSettings';

interface PauseMenuOverlayProps {
  onResume: () => void;
  onQuit: () => void;
  joystickSide: 'left' | 'right';
  onSetJoystickSide: (side: 'left' | 'right') => void;
}

/**
 * 수동 일시정지 메뉴 (P0-2): HUD의 [⏸ 일시정지] 버튼 클릭 시 표시된다.
 * [계속하기]는 AutoPauseOverlay와 동일하게 GameScene의 3·2·1 보호 재개로 이어지고(포위 즉사 방지),
 * [게임 종료]는 확인 없이 즉시 결과 화면(STOP_GAME)으로 넘어간다.
 * 모바일 HUD 축소(브금/효과음 버튼 제거)에 맞춰 사운드 토글과 조이스틱 위치 설정을 여기로 옮겼다 —
 * 브금/효과음은 GameHUD와 동일하게 stores/soundSettings를 단일 소스로 공유하고 EventBus로 동기화한다.
 */
export function PauseMenuOverlay({ onResume, onQuit, joystickSide, onSetJoystickSide }: PauseMenuOverlayProps) {
  const [soundSettings, setSoundSettingsState] = useState(() => getSoundSettings());

  useEffect(() => {
    const handleSoundChange = (data: { bgm: boolean; sfx: boolean }) => {
      setSoundSettingsState(data);
    };
    EventBus.on(GameEvents.SOUND_SETTINGS_CHANGED, handleSoundChange);
    return () => {
      EventBus.off(GameEvents.SOUND_SETTINGS_CHANGED, handleSoundChange);
    };
  }, []);

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

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(10, 10, 15, 0.9)',
      backdropFilter: 'blur(8px)',
      zIndex: 80,
      padding: 'clamp(16px, 4vw, 48px)',
    }}>
      <div
        className="clean-card animate-scale-in"
        style={{
          width: '100%',
          maxWidth: 380,
          padding: 'clamp(24px, 4vw, 40px)',
          textAlign: 'center',
        }}
      >
        <h2 style={{
          fontSize: 'clamp(22px, 3.5vw, 32px)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: '#fafafa',
          marginBottom: 24,
        }}>
          일시정지
        </h2>
        <button
          onClick={onResume}
          className="btn-clean btn-indigo"
          style={{ width: '100%', padding: '14px 24px', fontSize: 16, fontWeight: 700, marginBottom: 10 }}
        >
          계속하기
        </button>
        <button
          onClick={onQuit}
          className="btn-clean btn-rose"
          style={{ width: '100%', padding: '12px 24px', fontSize: 14, fontWeight: 700, marginBottom: 20 }}
        >
          게임 종료
        </button>

        {/* 설정: 조이스틱 위치 + 브금/효과음 (모바일 HUD 축소분 이전) */}
        <div style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
              조이스틱 위치
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => onSetJoystickSide('left')}
                style={{
                  cursor: 'pointer',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  background: joystickSide === 'left' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.05)',
                  border: joystickSide === 'left' ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.08)',
                  color: joystickSide === 'left' ? '#c7d2fe' : '#a1a1aa',
                }}
              >
                왼쪽
              </button>
              <button
                onClick={() => onSetJoystickSide('right')}
                style={{
                  cursor: 'pointer',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  background: joystickSide === 'right' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.05)',
                  border: joystickSide === 'right' ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.08)',
                  color: joystickSide === 'right' ? '#c7d2fe' : '#a1a1aa',
                }}
              >
                오른쪽
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
              사운드
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={toggleBgm}
                style={{
                  cursor: 'pointer',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: soundSettings.bgm ? '#e4e4e7' : '#52525b',
                  textDecoration: soundSettings.bgm ? 'none' : 'line-through',
                }}
              >
                🎵 브금
              </button>
              <button
                onClick={toggleSfx}
                style={{
                  cursor: 'pointer',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: soundSettings.sfx ? '#e4e4e7' : '#52525b',
                  textDecoration: soundSettings.sfx ? 'none' : 'line-through',
                }}
              >
                {soundSettings.sfx ? '🔊 효과음' : '🔇 효과음'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
