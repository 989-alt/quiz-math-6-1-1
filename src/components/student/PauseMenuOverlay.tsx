interface PauseMenuOverlayProps {
  onResume: () => void;
  onQuit: () => void;
}

/**
 * 수동 일시정지 메뉴 (P0-2): HUD의 [⏸ 일시정지] 버튼 클릭 시 표시된다.
 * [계속하기]는 AutoPauseOverlay와 동일하게 GameScene의 3·2·1 보호 재개로 이어지고(포위 즉사 방지),
 * [게임 종료]는 확인 없이 즉시 결과 화면(STOP_GAME)으로 넘어간다.
 */
export function PauseMenuOverlay({ onResume, onQuit }: PauseMenuOverlayProps) {
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
          style={{ width: '100%', padding: '12px 24px', fontSize: 14, fontWeight: 700 }}
        >
          게임 종료
        </button>
      </div>
    </div>
  );
}
