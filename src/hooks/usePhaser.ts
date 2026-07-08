import { useEffect, useRef, useState, useMemo } from 'react';
import Phaser from 'phaser';
import { createPhaserConfig } from '../game/config';
import { EventBus, GameEvents } from '../game/utils/EventBus';

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

export function usePhaser(containerId: string, options?: { isSolo: boolean; playerName: string; onQuit?: () => void }) {
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

  useEffect(() => {
    // Prevent multiple game instances
    if (gameRef.current) return;

    // Create game instance
    const phaserConfig = createPhaserConfig(containerId);
    gameRef.current = new Phaser.Game(phaserConfig);

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

  const selectUpgrade = (type: string, id: string) => {
    EventBus.emit(GameEvents.UPGRADE_SELECTED, { type, id });
    setLevelUpData(null);
  };

  // 오답 등으로 업그레이드 없이 레벨업 UI를 닫을 때 사용
  const clearLevelUp = () => {
    setLevelUpData(null);
  };

  const pauseGame = () => {
    EventBus.emit(GameEvents.PAUSE_GAME);
  };

  const resumeGame = () => {
    EventBus.emit(GameEvents.RESUME_GAME);
  };

  const restartGame = () => {
    setIsGameOver(false);
    setFinishData(null);
    setPlayerState(null);
    setLevelUpData(null);
    EventBus.emit(GameEvents.GAME_START);
  };

  const sendJoystickInput = (x: number, y: number) => {
    EventBus.emit('joystick-move', { x, y });
  };

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
