import React, { useEffect, useRef, useCallback } from 'react';

interface MobileControlsProps {
  onMove: (x: number, y: number) => void;
  /** 조이스틱을 화면 좌/우 중 어느 쪽에 고정할지 — 터치 핸들링은 document 레벨이라 위치만 바뀐다 */
  side: 'left' | 'right';
}

export function MobileControls({ onMove, side }: MobileControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const activeTouchId = useRef<number | null>(null);
  const centerPos = useRef({ x: 0, y: 0 });
  // 최신 onMove를 담아두는 ref — 아래 document 리스너 등록 useEffect를 [] deps로
  // 고정해 마운트당 1회만 등록하기 위함 (onMove가 매 렌더 바뀌어도 재등록 안 됨)
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const maxDistance = 40;

  const handleStart = useCallback(() => {
    if (!joystickRef.current) return;

    isDragging.current = true;
    const rect = joystickRef.current.getBoundingClientRect();
    centerPos.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, []);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging.current || !knobRef.current) return;

    const deltaX = clientX - centerPos.current.x;
    const deltaY = clientY - centerPos.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const clampedDistance = Math.min(distance, maxDistance);

    let normalizedX = 0;
    let normalizedY = 0;

    if (distance > 0) {
      normalizedX = (deltaX / distance) * clampedDistance;
      normalizedY = (deltaY / distance) * clampedDistance;
      onMoveRef.current(normalizedX / maxDistance, normalizedY / maxDistance);
    }

    knobRef.current.style.transform = `translate(${normalizedX}px, ${normalizedY}px)`;
  }, []);

  const handleEnd = useCallback(() => {
    isDragging.current = false;
    activeTouchId.current = null;
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)';
    }
    onMoveRef.current(0, 0);
  }, []);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // 이미 다른 손가락이 조이스틱을 조작 중이면 새 터치는 무시(멀티터치 뺏김 방지)
      if (isDragging.current) return;
      if (joystickRef.current?.contains(e.target as Node)) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        activeTouchId.current = touch.identifier;
        handleStart();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || activeTouchId.current === null) return;
      // 조이스틱을 시작한 손가락(identifier)만 추적 — 다른 손가락의 이동은 무시
      let touch: Touch | undefined;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === activeTouchId.current) {
          touch = e.touches[i];
          break;
        }
      }
      if (!touch) return;
      e.preventDefault();
      handleMove(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (activeTouchId.current === null) return;
      // 조이스틱을 시작한 손가락이 뗀 경우만 종료 처리 — 다른 손가락의 end는 무시
      let ended = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId.current) {
          ended = true;
          break;
        }
      }
      if (!ended) return;
      handleEnd();
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
      // 언마운트 시(레벨업/퀴즈 오버레이 등) 드래그 중이었다면 정지 입력을 보내
      // 재개 후 마지막 방향으로 자동 질주하는 것을 방지
      if (isDragging.current) {
        isDragging.current = false;
        activeTouchId.current = null;
        onMoveRef.current(0, 0);
      }
    };
    // handleStart/handleMove/handleEnd는 이제 안정적([] deps)이고 onMove는
    // ref로 참조하므로 이 effect는 마운트당 1회만 실행 — 재렌더마다 문서
    // 리스너를 뜯었다 붙이며 진행 중이던 드래그를 강제 정지시키던 버그 fix
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`absolute bottom-8 ${side === 'right' ? 'right-8' : 'left-8'} pointer-events-auto`}>
      <div
        ref={joystickRef}
        className="w-32 h-32 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(155, 89, 182, 0.15)',
          border: '3px solid rgba(155, 89, 182, 0.3)',
          backdropFilter: 'blur(4px)',
          touchAction: 'none',
        }}
      >
        <div
          ref={knobRef}
          className="w-14 h-14 rounded-full transition-transform duration-75"
          style={{
            background: 'linear-gradient(135deg, rgba(155,89,182,0.6), rgba(232,67,147,0.6))',
            border: '2px solid rgba(255,255,255,0.3)',
            boxShadow: '0 4px 15px rgba(155,89,182,0.3)',
          }}
        />
      </div>
    </div>
  );
}
