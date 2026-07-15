import { useEffect, useState, type ReactNode } from 'react';

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

function computeScale(): number {
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  return Math.min(vw / STAGE_WIDTH, vh / STAGE_HEIGHT);
}

/**
 * 1920×1080 디자인 스테이지의 배율 s = min(vw/1920, vh/1080)을 계산한다(모바일 전용).
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
  /** 스테이지 안에 들어가는 요소 — Phaser 캔버스 컨테이너만 넣는다. */
  children: ReactNode;
  /** 터치 기기 여부. false(PC)면 전체 크기 컨테이너, true(모바일)면 1920×1080 축소 스테이지. */
  isMobile: boolean;
  /**
   * 스테이지 배율의 영향을 받지 않고 뷰포트 기준(디바이스 실제 크기)으로 배치되어야 하는 요소
   * (HUD·모든 오버레이·조이스틱·세로모드 안내 등). 외곽 래퍼의 형제로 렌더된다.
   */
  outside?: ReactNode;
}

/**
 * 캔버스 컨테이너를 담는 스테이지.
 * - PC(비터치): 전체 크기 컨테이너(width/height 100%, transform 없음)라 Phaser RESIZE가
 *   창 크기를 그대로 추종한다 — 스프라이트가 원래 크기.
 * - 모바일(터치): 고정 1920×1080 스테이지를 CSS transform으로 축소·레터박스해 PC와 동일한
 *   월드 범위를 보되 스프라이트만 작아진다.
 * HUD·오버레이 등 텍스트 UI는 `outside`로 넘겨 스테이지 밖(디바이스 실제 크기)에 렌더한다.
 */
export function StageViewport({ children, isMobile, outside }: StageViewportProps) {
  const scale = useStageScale();

  return (
    <div className="stage-outer">
      {isMobile ? (
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
      ) : (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            flexShrink: 0,
          }}
        >
          {children}
        </div>
      )}
      {outside}
    </div>
  );
}
