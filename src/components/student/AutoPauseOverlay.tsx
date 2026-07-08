interface AutoPauseOverlayProps {
  onResume: () => void;
}

/**
 * 탭/창 이탈 자동 일시정지 오버레이 (Task 4): 탭이 다시 보일 때 자동으로 재개하지 않고
 * 사용자가 [계속하기]를 눌러야 GameScene의 3·2·1 보호 재개로 이어진다 (포위 즉사 방지).
 */
export function AutoPauseOverlay({ onResume }: AutoPauseOverlayProps) {
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
          marginBottom: 10,
        }}>
          일시정지
        </h2>
        <p style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 24 }}>
          화면을 벗어나 게임을 멈췄어요
        </p>
        <button
          onClick={onResume}
          className="btn-clean btn-indigo"
          style={{ width: '100%', padding: '14px 24px', fontSize: 16, fontWeight: 700 }}
        >
          계속하기
        </button>
      </div>
    </div>
  );
}
