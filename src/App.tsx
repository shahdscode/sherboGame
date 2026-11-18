import React, { useEffect, useState } from 'react';
import { TowerGame } from './game/TowerGame';
import { GameHUD } from './components/GameHUD';
import { StartScreen } from './components/StartScreen';
import { QuestionModal } from './components/QuestionModal';
import { CompletionScreen } from './components/CompletionScreen';
import { TouchControls } from './components/TouchControls';
import { GameLoadScreen } from './components/GameLoadScreen';
import { useTowerGame } from './hooks/useTowerGame';
import { fetchRemoteGame, getRequestedGameId } from './data/remoteGame';
import { applyTowerLevels, type CheckpointQuestion } from './data/towerConfig';

type RemoteGameState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; questions?: CheckpointQuestion[] };

/**
 * `/?game=<id>` plays a game built in the admin: its levels are loaded and
 * the tower is resized before the game mounts. Without it, the default
 * 5-level game with `public/questions.json` runs as before.
 */
export const App: React.FC = () => {
  const [gameId] = useState(getRequestedGameId);
  const [remote, setRemote] = useState<RemoteGameState>(() =>
    gameId ? { status: 'loading' } : { status: 'ready' }
  );

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    fetchRemoteGame(gameId)
      .then((game) => {
        if (cancelled) return;
        applyTowerLevels(game.levelCount);
        setRemote({ status: 'ready', questions: game.questions });
      })
      .catch(() => {
        if (!cancelled) setRemote({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (remote.status !== 'ready') {
    return <GameLoadScreen failed={remote.status === 'failed'} />;
  }
  return <TowerApp customQuestions={remote.questions} />;
};

interface TowerAppProps {
  customQuestions?: CheckpointQuestion[];
}

const TowerApp: React.FC<TowerAppProps> = ({ customQuestions }) => {
  const {
    gameState,
    currentStep,
    checkpoints,
    completedCheckpointsCount,
    activeCheckpointNumber,
    activeQuestion,
    feedback,
    totalAttempts,
    firstTryCount,
    xpPoints,
    elapsedTime,
    speedBonus,
    scoringState,
    sceneReady,
    loadProgress,
    loadFailed,
    startGame,
    selectOption,
    submitAnswer,
    continueAfterCorrectAnswer,
    restartGame,
    setTouchControls,
  } = useTowerGame(customQuestions);

  const isQuestionVisible =
    (gameState === 'QUESTION_ACTIVE' || gameState === 'CHECKPOINT_REACHED') &&
    activeQuestion !== null;

  const isDebugCompleted =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('screen') === 'completed';

  const showCompletion = gameState === 'COMPLETED' || isDebugCompleted;

  return (
    <div className="fullscreen-game-shell">
      <TowerGame />

      <GameHUD
        currentStep={currentStep}
        completedCheckpointsCount={completedCheckpointsCount}
        activeCheckpointNumber={activeCheckpointNumber}
        checkpoints={checkpoints}
        xpPoints={xpPoints}
        elapsedTime={elapsedTime}
        currentStreak={scoringState?.currentStreak ?? 0}
      />

      {gameState === 'INTRO' && !showCompletion && <StartScreen
          onStart={startGame}
          ready={sceneReady}
          progress={loadProgress}
          loadFailed={loadFailed}
        />}

      {isQuestionVisible && activeQuestion && (
        <QuestionModal
          question={activeQuestion}
          feedback={feedback}
          onSelectOption={selectOption}
          onSubmitAnswer={submitAnswer}
          onContinue={continueAfterCorrectAnswer}
        />
      )}

      {showCompletion && (
        <CompletionScreen
          completedCheckpointsCount={completedCheckpointsCount}
          totalAttempts={totalAttempts}
          firstTryCount={firstTryCount}
          xpPoints={xpPoints}
          elapsedTime={elapsedTime}
          speedBonus={speedBonus}
          scoringState={scoringState}
          onPlayAgain={restartGame}
        />
      )}

      {!showCompletion && (
        <TouchControls
          disabled={gameState !== 'PLAYING'}
          onChange={setTouchControls}
        />
      )}
    </div>
  );
};

export default App;
