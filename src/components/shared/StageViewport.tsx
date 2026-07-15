import type { ReactNode } from 'react';

interface StageViewportProps {
  /** 스테이지 안에 들어가는 요소 — Phaser 캔버스 컨테이너만 넣는다. */
  children: ReactNode;
  /** 터치 기기 여부. 스테이지 레이아웃 자체는 PC/모바일 동일하며, 세로모드 안내 등 다른 곳의 게이팅에 쓰인다. */
  isMobile: boolean;
  /**
   * 뷰포트 기준(디바이스 실제 크기)으로 배치되는 요소
   * (HUD·모든 오버레이·조이스틱·세로모드 안내 등). 외곽 래퍼의 형제로 렌더된다.
   */
  outside?: ReactNode;
}

/**
 * 캔버스 컨테이너를 담는 스테이지.
 * PC/모바일 동일 — 전체 크기 컨테이너(width/height 100%, transform 없음)라 Phaser RESIZE가
 * 뷰포트 크기를 그대로 추종한다 — 스프라이트가 원래 크기(축소·레터박스 없음).
 * HUD·오버레이 등 텍스트 UI는 `outside`로 넘겨 스테이지 밖(디바이스 실제 크기)에 렌더한다.
 */
export function StageViewport({ children, isMobile: _isMobile, outside }: StageViewportProps) {
  return (
    <div className="stage-outer">
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
      {outside}
    </div>
  );
}
