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

  return (
    <div className="fullscreen-game-shell">
      <TowerGame />

      <GameHUD
        currentStep={currentStep}
        completedCheckpointsCount={completedCheckpointsCount}
        activeCheckpointNumber={activeCheckpointNumber}
        checkpoints={checkpoints}
        xpPoints={xpPoints}
      />

      {gameState === 'INTRO' && <StartScreen onStart={startGame} />}

      {isQuestionVisible && activeQuestion && (
        <QuestionModal
          question={activeQuestion}
          feedback={feedback}
          onSelectOption={selectOption}
          onSubmitAnswer={submitAnswer}
          onContinue={continueAfterCorrectAnswer}
        />
      )}

      {gameState === 'COMPLETED' && (
        <CompletionScreen
          completedCheckpointsCount={completedCheckpointsCount}
          totalAttempts={totalAttempts}
          firstTryCount={firstTryCount}
          xpPoints={xpPoints}
          onPlayAgain={restartGame}
        />
      )}

      <TouchControls
        disabled={gameState !== 'PLAYING'}
        onChange={setTouchControls}
      />
    </div>
  );
};

export default App;
