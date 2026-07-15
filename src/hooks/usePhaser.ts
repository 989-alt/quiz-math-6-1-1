import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Phaser from 'phaser';
import { createPhaserConfig } from '../game/config';
import { EventBus, GameEvents } from '../game/utils/EventBus';
import type { Difficulty } from '../game/difficulty';
import type { GameMode } from '../game/gameMode';

export interface PlayerStateData {
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

export interface LevelUpData {
  level: number;
  upgrades: Array<{
    type: 'weapon' | 'passive' | 'bonus';
    id: string;
    name: string;
    nameKo: string;
    description: string;
    descriptionKo: string;
    currentLevel: number;
    maxLevel: number;
    isNew: boolean;
    isEvolution?: boolean;
  }>;
}

export interface GameFinishedData {
  score: number;
  level: number;
  survivalTime: number;
  monstersKilled: number;
  // 무기 완성 + 최종 보스 처치로 클리어했는지
  cleared: boolean;
}

export function usePhaser(
  containerId: string,
  options?: {
    isSolo: boolean;
    playerName: string;
    difficulty?: Difficulty;
    mode?: GameMode;
    /** 터치 기기 여부 — Phaser 스케일 설정에는 더 이상 쓰이지 않음(PC/모바일 동일 RESIZE).
     *  GameContainer가 이 옵션 객체 형태를 그대로 넘기므로 타입 호환을 위해 필드만 유지. */
    isMobile?: boolean;
    onQuit?: () => void;
  }
) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerStateData | null>(null);
  const [levelUpData, setLevelUpData] = useState<LevelUpData | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [finishData, setFinishData] = useState<GameFinishedData | null>(null);
  const onQuitRef = useRef(options?.onQuit);

  // Memoize options to prevent unnecessary re-renders
  const isSolo = options?.isSolo ?? false;
  const playerName = options?.playerName ?? 'Player';

  // onQuit이 렌더마다 새 함수로 바뀌어도 stale closure가 되지 않도록 매 렌더 갱신
  useEffect(() => {
    onQuitRef.current = options?.onQuit;
  }, [options?.onQuit]);

  useEffect(() => {
    // Prevent multiple game instances
    if (gameRef.current) return;

    // Create game instance
    const phaserConfig = createPhaserConfig(containerId);
    gameRef.current = new Phaser.Game(phaserConfig);
    // 난이도를 GameScene이 create()에서 읽기 전에 registry에 심어둔다 (BootScene의 비동기
    // 로딩 이후에 GameScene.create()가 실행되므로 이 동기 호출로 충분히 앞선다).
    gameRef.current.registry.set('difficulty', options?.difficulty ?? 'normal');
    gameRef.current.registry.set('mode', options?.mode ?? 'adventure');

    // Setup event listeners
    const handleGameReady = () => {
      setIsReady(true);
    };

    const handlePlayerState = (data: PlayerStateData) => {
      setPlayerState(data);
    };

    const handleLevelUp = (data: LevelUpData) => {
      setLevelUpData(data);
    };

    const handleGameOver = () => {
      setIsGameOver(true);
    };

    const handleGameFinished = (data: GameFinishedData) => {
      setIsGameOver(true);
      setFinishData(data);
    };

    const handleGameQuit = () => {
      if (onQuitRef.current) {
        onQuitRef.current();
      }
    };

    EventBus.on(GameEvents.GAME_READY, handleGameReady);
    EventBus.on(GameEvents.PLAYER_STATE_UPDATE, handlePlayerState);
    EventBus.on(GameEvents.LEVEL_UP, handleLevelUp);
    EventBus.on(GameEvents.GAME_OVER, handleGameOver);
    EventBus.on(GameEvents.GAME_FINISHED, handleGameFinished);
    EventBus.on(GameEvents.GAME_QUIT, handleGameQuit);

    return () => {
      EventBus.off(GameEvents.GAME_READY, handleGameReady);
      EventBus.off(GameEvents.PLAYER_STATE_UPDATE, handlePlayerState);
      EventBus.off(GameEvents.LEVEL_UP, handleLevelUp);
      EventBus.off(GameEvents.GAME_OVER, handleGameOver);
      EventBus.off(GameEvents.GAME_FINISHED, handleGameFinished);
      EventBus.off(GameEvents.GAME_QUIT, handleGameQuit);

      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [containerId]); // Only depend on containerId, not the entire options object

  // 아래 함수들은 EventBus.emit / setState setter만 사용해 클로저에 갇힐 값이
  // 없으므로 useCallback([])으로 참조 안정화 — 자식 컴포넌트(예: MobileControls)에
  // props로 넘어갈 때 불필요한 재구독을 막기 위함
  const selectUpgrade = useCallback((type: string, id: string) => {
    EventBus.emit(GameEvents.UPGRADE_SELECTED, { type, id });
    setLevelUpData(null);
  }, []);

  // 오답 등으로 업그레이드 없이 레벨업 UI를 닫을 때 사용
  const clearLevelUp = useCallback(() => {
    setLevelUpData(null);
  }, []);

  const pauseGame = useCallback(() => {
    EventBus.emit(GameEvents.PAUSE_GAME);
  }, []);

  const resumeGame = useCallback(() => {
    EventBus.emit(GameEvents.RESUME_GAME);
  }, []);

  const restartGame = useCallback(() => {
    setIsGameOver(false);
    setFinishData(null);
    setPlayerState(null);
    setLevelUpData(null);
    EventBus.emit(GameEvents.GAME_START);
  }, []);

  const sendJoystickInput = useCallback((x: number, y: number) => {
    EventBus.emit('joystick-move', { x, y });
  }, []);

  return {
    game: gameRef.current,
    isReady,
    playerState,
    levelUpData,
    isGameOver,
    finishData,
    selectUpgrade,
    clearLevelUp,
    pauseGame,
    resumeGame,
    restartGame,
    sendJoystickInput,
  };
}
