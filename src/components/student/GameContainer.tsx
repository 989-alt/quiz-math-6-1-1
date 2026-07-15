import { useEffect, useRef, useState, useCallback } from 'react';
import { usePhaser } from '../../hooks/usePhaser';
import { QuizOverlay } from './QuizOverlay';
import { UpgradeSelect } from './UpgradeSelect';
import { GameHUD } from './GameHUD';
import { MobileControls } from './MobileControls';
import { PostGameOverlay } from './PostGameOverlay';
import { AutoPauseOverlay } from './AutoPauseOverlay';
import { PauseMenuOverlay } from './PauseMenuOverlay';
import { StageViewport } from '../shared/StageViewport';
import { PortraitPrompt } from '../shared/PortraitPrompt';
import { useQuizStore } from '../../stores/quizStore';
import { quizTimeLimit } from '../../types/quiz';
import { EventBus, GameEvents } from '../../game/utils/EventBus';
import type { UpgradeOption } from '../../types/game';
import type { Difficulty } from '../../game/difficulty';
import type { GameMode } from '../../game/gameMode';

interface GameContainerProps {
  nickname: string;
  difficulty: Difficulty;
  mode: GameMode;
  onExit: () => void;
  onShowLeaderboard: () => void;
}

// 주 포인터가 터치인 기기(폰/태블릿) 판정 — 터치스크린 노트북/키보드 유저는 PC로 취급.
// Phaser 스케일 모드가 게임 생성 시점(첫 렌더)에 정해져야 하므로 동기 판정으로 초기값을 잡는다.
function detectMobile(): boolean {
  const q = window.matchMedia?.('(pointer: coarse)');
  if (q) return q.matches;
  return window.innerWidth < 768 || 'ontouchstart' in window;
}

const JOYSTICK_SIDE_KEY = 'sqb:joystickSide';

/** 쿠키/사이트데이터 차단 브라우저 등에서 localStorage 접근이 예외를 던져도 크래시하지 않도록 보호 */
function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장 실패는 무시(다음 세션에 값이 유지되지 않을 뿐)
  }
}

function detectJoystickSide(): 'left' | 'right' {
  return safeGetItem(JOYSTICK_SIDE_KEY) === 'right' ? 'right' : 'left';
}

export function GameContainer({ nickname, difficulty, mode, onExit, onShowLeaderboard }: GameContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [filteredUpgrades, setFilteredUpgrades] = useState<UpgradeOption[]>([]);
  // 게임(Phaser) 생성 시점에 스케일 모드가 확정되도록 동기 판정으로 초기화한다.
  const [isMobile, setIsMobile] = useState<boolean>(detectMobile);
  const [joystickSide, setJoystickSideState] = useState<'left' | 'right'>(detectJoystickSide);
  const [bankError, setBankError] = useState(false);
  const [showAutoPauseOverlay, setShowAutoPauseOverlay] = useState(false);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  // 레벨업당 1회 "다시 뽑기" — 새 레벨업이 도착하면 초기화 (levelUpData 변경 effect에서 리셋)
  const [rerollUsed, setRerollUsed] = useState(false);
  // 연타로 두 번 emit되는 것을 막기 위한 동기 가드 (state는 리렌더까지 반영이 늦을 수 있음)
  const rerollUsedRef = useRef(false);

  const {
    isReady,
    playerState,
    levelUpData,
    finishData,
    selectUpgrade,
    clearLevelUp,
    pauseGame,
    restartGame,
    sendJoystickInput,
  } = usePhaser('game-container', {
    isSolo: true,
    playerName: nickname,
    difficulty,
    mode,
    isMobile,
  });

  const { currentQuiz, streak, loadUnitBank, drawQuiz, submitAnswer, resetQuizSession } =
    useQuizStore();

  useEffect(() => {
    loadUnitBank().then((ok) => {
      if (!ok) setBankError(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 탭/창 이탈 자동 일시정지 (Task 4): GameScene이 실제 활성 플레이 중 탭 이탈을 감지해
  // 복귀 시 이 이벤트를 쏘면 "일시정지" 오버레이를 띄운다 (자동 재개 금지)
  useEffect(() => {
    // 수동 일시정지 메뉴가 떠 있는 상태에서 탭 이탈이 겹치면 오버레이 두 개가
    // 동시에 표시되는 것을 막기 위해 자동 일시정지 오버레이로 넘긴다.
    const handleAutoPauseShow = () => {
      setShowPauseMenu(false);
      setShowAutoPauseOverlay(true);
    };
    EventBus.on(GameEvents.AUTO_PAUSE_SHOW, handleAutoPauseShow);
    return () => {
      EventBus.off(GameEvents.AUTO_PAUSE_SHOW, handleAutoPauseShow);
    };
  }, []);

  // "다시 뽑기" 결과 수신 — 카드만 교체 (levelUpData는 건드리지 않아 퀴즈 재출현 없음)
  useEffect(() => {
    const handleUpgradesRerolled = (data: { upgrades: UpgradeOption[] }) => {
      setFilteredUpgrades(data.upgrades as UpgradeOption[]);
    };
    EventBus.on(GameEvents.UPGRADES_REROLLED, handleUpgradesRerolled);
    return () => {
      EventBus.off(GameEvents.UPGRADES_REROLLED, handleUpgradesRerolled);
    };
  }, []);

  useEffect(() => {
    // 주 포인터가 터치인 기기에서만 조이스틱 표시 — 터치스크린 노트북/키보드 유저는 제외
    const coarsePointerQuery = window.matchMedia?.('(pointer: coarse)');
    const checkMobile = () => {
      if (coarsePointerQuery) {
        setIsMobile(coarsePointerQuery.matches);
      } else {
        // matchMedia 미지원 시 기존 판정으로 폴백
        setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
      }
    };
    checkMobile();
    if (coarsePointerQuery) {
      coarsePointerQuery.addEventListener('change', checkMobile);
      return () => coarsePointerQuery.removeEventListener('change', checkMobile);
    }
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 레벨업 → 웨이브 기반 난이도로 퀴즈 추첨 (설계 §1.4)
  useEffect(() => {
    if (!levelUpData) return;
    rerollUsedRef.current = false;
    setRerollUsed(false);
    const quiz = drawQuiz(playerState?.wave ?? 1);
    if (quiz) {
      setShowQuiz(true);
      pauseGame();
    } else {
      // 문제은행 로드 실패 등 예외 — 퀴즈 없이 업그레이드 제공
      setFilteredUpgrades(levelUpData.upgrades as UpgradeOption[]);
      EventBus.emit(GameEvents.QUIZ_RESULT, { correct: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelUpData]);

  const handleQuizAnswer = (selectedIndex: number, isCorrect: boolean, timeSpent: number) => {
    submitAnswer(selectedIndex, timeSpent);

    const { bank, quizResults, currentQuiz: answered } = useQuizStore.getState();
    if (bank && quizResults.length >= bank.quizzes.length) {
      EventBus.emit(GameEvents.QUIZ_BANK_EXHAUSTED);
    }

    setShowQuiz(false);

    if (isCorrect) {
      // 정답: 업그레이드 3택 (설계 §6) + 빨리 맞힐수록 커지는 스피드 보너스 점수
      if (levelUpData) setFilteredUpgrades(levelUpData.upgrades as UpgradeOption[]);
      const timeLimit = answered ? quizTimeLimit(answered) : timeSpent;
      const speedBonus = Math.max(0, Math.ceil(100 * (1 - timeSpent / timeLimit)));
      EventBus.emit(GameEvents.QUIZ_RESULT, { correct: true, speedBonus });
    } else {
      // 오답/타임아웃: 레벨업 소모 — 업그레이드 없음. 재개 보호는 GameScene 담당
      setFilteredUpgrades([]);
      clearLevelUp();
      EventBus.emit(GameEvents.QUIZ_RESULT, { correct: false });
    }
  };

  const handleUpgradeSelect = (type: string, id: string) => {
    selectUpgrade(type, id);
    setFilteredUpgrades([]);
  };

  // 레벨업당 1회 "다시 뽑기" — ref로 즉시 잠가 연타 시 중복 emit 방지
  const handleReroll = () => {
    if (rerollUsedRef.current) return;
    rerollUsedRef.current = true;
    setRerollUsed(true);
    EventBus.emit(GameEvents.REROLL_UPGRADES);
  };

  const handleRestart = () => {
    setShowQuiz(false);
    setFilteredUpgrades([]);
    // 사망 직전 탭 이탈→복귀 레이스로 남을 수 있는 stale 일시정지 오버레이 제거
    setShowAutoPauseOverlay(false);
    setShowPauseMenu(false);
    resetQuizSession();
    restartGame();
  };

  // sendJoystickInput은 usePhaser에서 참조가 안정화되어 있음 — 여기서도 useCallback으로
  // 감싸 MobileControls에 매 렌더 새 함수가 전달되지 않게 한다 (조이스틱 끊김 fix)
  const handleJoystickMove = useCallback(
    (x: number, y: number) => sendJoystickInput(x, y),
    [sendJoystickInput]
  );

  // [계속하기]: 오버레이를 닫고 GameScene의 3·2·1 보호 재개로 넘긴다 (포위 즉사 방지)
  const handleAutoPauseResume = () => {
    setShowAutoPauseOverlay(false);
    EventBus.emit(GameEvents.RESUME_WITH_PROTECTION);
  };

  const showUpgradeSelect = !showQuiz && filteredUpgrades.length > 0;

  // HUD [⏸ 일시정지] 클릭 (P0-2): 퀴즈/업그레이드 선택/게임 종료 화면/자동 일시정지 오버레이가
  // 이미 떠 있을 때는 무시하고, 그 외에는 GameScene을 즉시 정지시킨 뒤 일시정지 메뉴를 띄운다.
  const handlePauseClick = () => {
    if (showQuiz || showUpgradeSelect || finishData || showAutoPauseOverlay || showPauseMenu) return;
    pauseGame();
    setShowPauseMenu(true);
  };

  // [계속하기]: AutoPauseOverlay와 동일하게 3·2·1 보호 재개로 넘긴다 (포위 즉사 방지)
  const handlePauseMenuResume = () => {
    setShowPauseMenu(false);
    EventBus.emit(GameEvents.RESUME_WITH_PROTECTION);
  };

  // [게임 종료]: 확인 없이 바로 결과 집계로 넘어간다
  const handlePauseMenuQuit = () => {
    setShowPauseMenu(false);
    EventBus.emit(GameEvents.STOP_GAME);
  };

  // 일시정지 메뉴의 "조이스틱 위치" 설정 — 다음 세션에도 유지되도록 저장한다
  const handleSetJoystickSide = (side: 'left' | 'right') => {
    setJoystickSideState(side);
    safeSetItem(JOYSTICK_SIDE_KEY, side);
  };

  return (
    <StageViewport
      isMobile={isMobile}
      outside={
        // HUD·모든 오버레이는 스테이지 밖(디바이스 실제 크기)에 렌더한다 — 폰에서 텍스트 UI가
        // 스테이지 배율만큼 작아지지 않도록. position:absolute; inset:0이라 뷰포트를 덮는다.
        // 조이스틱도 여기 둔다 — 스케일된 스테이지 안에 두면 px 기반 조이스틱 감도가 왜곡됨.
        <>
          {isReady && !finishData && (
            <GameHUD difficulty={difficulty} mode={mode} onPause={handlePauseClick} showFullscreen={isMobile} isMobile={isMobile} />
          )}

          {bankError && (
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '10px 20px',
                borderRadius: 12,
                background: 'rgba(244,63,94,0.15)',
                border: '1px solid rgba(244,63,94,0.4)',
                color: '#fda4af',
                fontSize: 13,
                zIndex: 60,
              }}
            >
              문제은행을 불러오지 못했습니다 — 퀴즈 없이 진행됩니다
            </div>
          )}

          {showQuiz && currentQuiz && (
            <QuizOverlay
              quiz={currentQuiz}
              timeLimit={quizTimeLimit(currentQuiz)}
              streak={streak}
              onAnswer={handleQuizAnswer}
            />
          )}

          {showUpgradeSelect && !finishData && (
            <UpgradeSelect
              upgrades={filteredUpgrades.map((u) => ({
                ...u,
                name: (u as any).nameKo || u.name,
                description: (u as any).descriptionKo || u.description,
              }))}
              onSelect={handleUpgradeSelect}
              rerollUsed={rerollUsed}
              onReroll={handleReroll}
            />
          )}

          {showAutoPauseOverlay && !showQuiz && !showUpgradeSelect && !finishData && (
            <AutoPauseOverlay onResume={handleAutoPauseResume} />
          )}

          {showPauseMenu && !showQuiz && !showUpgradeSelect && !finishData && !showAutoPauseOverlay && (
            <PauseMenuOverlay
              onResume={handlePauseMenuResume}
              onQuit={handlePauseMenuQuit}
              joystickSide={joystickSide}
              onSetJoystickSide={handleSetJoystickSide}
            />
          )}

          {finishData && (
            <PostGameOverlay
              nickname={nickname}
              difficulty={difficulty}
              mode={mode}
              finish={finishData}
              onRestart={handleRestart}
              onExit={onExit}
              onShowLeaderboard={onShowLeaderboard}
            />
          )}

          {!isReady && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a0f',
                gap: 24,
              }}
            >
              <div className="dot-spinner">
                <div className="dot" />
                <div className="dot" />
                <div className="dot" />
              </div>
              <div style={{ color: '#71717a', fontSize: 14, fontWeight: 500 }}>게임 로딩 중...</div>
            </div>
          )}

          {isMobile && isReady && !levelUpData && !showQuiz && !finishData && (
            <MobileControls onMove={handleJoystickMove} side={joystickSide} />
          )}
          <PortraitPrompt enabled={isMobile} />
        </>
      }
    >
      <div
        id="game-container"
        ref={containerRef}
        tabIndex={0}
        style={{ width: '100%', height: '100%', outline: 'none' }}
        onMouseDown={(e) => e.currentTarget.focus()}
      />
    </StageViewport>
  );
}
