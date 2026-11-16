import React from 'react';
import { TowerGame } from './game/TowerGame';
import { GameHUD } from './components/GameHUD';
import { StartScreen } from './components/StartScreen';
import { QuestionModal } from './components/QuestionModal';
import { CompletionScreen } from './components/CompletionScreen';
import { TouchControls } from './components/TouchControls';
import { useTowerGame } from './hooks/useTowerGame';

export const App: React.FC = () => {
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
  } = useTowerGame();

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
          completedCheckpointsCount={completedCheckpointsCount || 5}
          totalAttempts={totalAttempts || 5}
          firstTryCount={firstTryCount || 5}
          xpPoints={xpPoints || 3650}
          elapsedTime={elapsedTime || 124000}
          speedBonus={speedBonus || 500}
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
