import { useEffect, useState, type ReactNode } from 'react';

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;

function computeScale(): number {
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  return Math.min(vw / STAGE_WIDTH, vh / STAGE_HEIGHT);
}

/**
 * 1280×720 디자인 스테이지의 배율 s = min(vw/1280, vh/720)을 계산한다.
 * window resize·orientationchange뿐 아니라 visualViewport resize(모바일 주소창 표시/숨김)에도
 * 반응해 어떤 기기에서도 픽셀 단위로 동일한 레이아웃을 보장한다.
 */
export function useStageScale(): number {
  const [scale, setScale] = useState<number>(() =>
    typeof window === 'undefined' ? 1 : computeScale()
  );

  useEffect(() => {
    const update = () => setScale(computeScale());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      vv?.removeEventListener('resize', update);
    };
  }, []);

  return scale;
}

interface StageViewportProps {
  children: ReactNode;
  /**
   * 스테이지 배율의 영향을 받지 않고 뷰포트 기준으로 배치되어야 하는 요소
   * (조이스틱·세로모드 안내 등). 외곽 래퍼의 형제로 렌더된다.
   */
  outside?: ReactNode;
}

/**
 * 모든 기기(PC/크롬북/태블릿/폰)가 동일한 1280×720 레이아웃을 보도록 CSS transform으로
 * 스케일하는 고정비 스테이지. 종횡비가 맞지 않으면 어두운 레터박스로 채운다.
 */
export function StageViewport({ children, outside }: StageViewportProps) {
  const scale = useStageScale();

  return (
    <div className="stage-outer">
      <div
        style={{
          position: 'relative',
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          flexShrink: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
        }}
      >
        {children}
      </div>
      {outside}
    </div>
  );
}
