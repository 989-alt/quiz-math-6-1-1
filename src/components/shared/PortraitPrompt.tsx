import { useEffect, useState } from 'react';

interface PortraitPromptProps {
  /** 터치 기기에서만 안내를 표시 (데스크톱/노트북은 세로여도 표시하지 않음) */
  enabled: boolean;
}

/**
 * 터치 기기가 세로 모드(viewportH > viewportW)일 때 가로 회전을 요청하는 전체화면 안내.
 * 스테이지 바깥(뷰포트 기준)에 렌더되며 게임을 언마운트하지 않고 위에 덮기만 한다.
 */
export function PortraitPrompt({ enabled }: PortraitPromptProps) {
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const check = () => {
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      setPortrait(vh > vw);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
      vv?.removeEventListener('resize', check);
    };
  }, []);

  if (!enabled || !portrait) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 60, lineHeight: 1, letterSpacing: 8 }}>📱🔄</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#fafafa' }}>
        가로 모드로 돌려주세요
      </div>
      <div style={{ fontSize: 14, color: '#a1a1aa', maxWidth: 300, lineHeight: 1.6 }}>
        이 게임은 가로 화면에 최적화되어 있어요
      </div>
    </div>
  );
}
