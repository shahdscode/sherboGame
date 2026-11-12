import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState,
  CheckpointStatus,
  CheckpointQuestion,
  towerConfig,
} from '../data/towerConfig';
import { checkpointQuestions } from '../data/sampleQuestions';
import { gameEvents, TouchInputState } from '../game/EventBus';
import { sfx } from '../game/sfx';

export interface CheckpointStateItem {
  checkpointNumber: number;
  stepRangeLabel: string;
  targetStep: number;
  status: CheckpointStatus;
  attempts: number;
  solvedOnFirstTry: boolean;
}

export interface QuestionAttemptFeedback {
  status: 'idle' | 'incorrect' | 'correct';
  selectedOptionIndex: number | null;
  wrongOptionIndices: number[];
  earnedXp: number | null;
  currentLoss: number | null;
  potentialXp: number;
  wrongPenalties: Record<number, number>;
  hint: string | null;
  explanation: string | null;
  attemptsForCurrentQuestion: number;
}

export function getPenaltyForMistakes(mistakes: number): number {
  if (mistakes <= 0) return 0;
  if (mistakes === 1) return towerConfig.rewards.penalty1stMistake; // 50
  if (mistakes === 2) return towerConfig.rewards.penalty2ndMistake; // 150
  return towerConfig.rewards.penalty3rdMistake; // 300
}

export function getQuestionXpForMistakes(mistakes: number): number {
  const penalty = getPenaltyForMistakes(mistakes);
  return Math.max(0, towerConfig.rewards.xpPerCheckpoint - penalty);
}

export function useTowerGame(
  questions: CheckpointQuestion[] = checkpointQuestions
) {
  const [gameState, setGameState] = useState<GameState>('INTRO');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [highestStep, setHighestStep] = useState<number>(0);
  const [unlockedSteps, setUnlockedSteps] = useState<number>(
    towerConfig.stepsPerCheckpoint
  );
  const [activeCheckpointNumber, setActiveCheckpointNumber] = useState<
    number | null
  >(null);
  const [totalAttempts, setTotalAttempts] = useState<number>(0);
  const [firstTryCount, setFirstTryCount] = useState<number>(0);
  const [xpPoints, setXpPoints] = useState<number>(0);
  // The Start button stays locked until the Phaser scene has loaded its assets
  const [sceneReady, setSceneReady] = useState<boolean>(gameEvents.sceneReady);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);

  const buildInitialCheckpoints = (): CheckpointStateItem[] =>
    Array.from({ length: towerConfig.numberOfCheckpoints }, (_, idx) => {
      const cpNum = idx + 1;
      const startStep = idx * towerConfig.stepsPerCheckpoint + 1;
      const endStep = cpNum * towerConfig.stepsPerCheckpoint;
      return {
        checkpointNumber: cpNum,
        stepRangeLabel: `Steps ${startStep}–${endStep}`,
        targetStep: endStep,
        status: cpNum === 1 ? 'active' : 'locked',
        attempts: 0,
        solvedOnFirstTry: false,
      };
    });

  const [checkpoints, setCheckpoints] = useState<CheckpointStateItem[]>(
    buildInitialCheckpoints
  );

  const [feedback, setFeedback] = useState<QuestionAttemptFeedback>({
    status: 'idle',
    selectedOptionIndex: null,
    wrongOptionIndices: [],
    earnedXp: null,
    currentLoss: null,
    potentialXp: towerConfig.rewards.xpPerCheckpoint,
    wrongPenalties: {},
    hint: null,
    explanation: null,
    attemptsForCurrentQuestion: 0,
  });

  // Guard against accidental double submissions
  const isSubmittingRef = useRef<boolean>(false);

  // Subscribe to Phaser events
  useEffect(() => {
    if (gameEvents.sceneReady) setSceneReady(true);
    const unsubReady = gameEvents.on('evt:scene-ready', () => {
      setLoadProgress(1);
      setSceneReady(true);
    });
    const unsubProgress = gameEvents.on('evt:load-progress', ({ progress }) => {
      setLoadProgress(progress);
    });
    const unsubLoadError = gameEvents.on('evt:load-error', () => {
      setLoadFailed(true);
    });

    const unsubStep = gameEvents.on(
      'evt:step-updated',
      ({ currentStep: step, highestStep: highest }) => {
        setCurrentStep(step);
        setHighestStep((prev) => Math.max(prev, highest));
      }
    );

    const unsubCheckpoint = gameEvents.on(
      'evt:checkpoint-reached',
      ({ checkpointNumber, stepNumber }) => {
        setCurrentStep(stepNumber);
        setHighestStep((prev) => Math.max(prev, stepNumber));
        setActiveCheckpointNumber(checkpointNumber);
        setGameState('CHECKPOINT_REACHED');
        isSubmittingRef.current = false;

        setFeedback({
          status: 'idle',
          selectedOptionIndex: null,
          wrongOptionIndices: [],
          earnedXp: null,
          currentLoss: null,
          potentialXp: towerConfig.rewards.xpPerCheckpoint,
          wrongPenalties: {},
          hint: null,
          explanation: null,
          attemptsForCurrentQuestion: 0,
        });

        setTimeout(() => {
          setGameState((prev) =>
            prev === 'CHECKPOINT_REACHED' ? 'QUESTION_ACTIVE' : prev
          );
        }, 60);
      }
    );

    const unsubSectionUnlocked = gameEvents.on(
      'evt:section-unlocked',
      ({ unlockedUpToStep }) => {
        setUnlockedSteps(unlockedUpToStep);
        setGameState('PLAYING');
      }
    );

    const unsubSummit = gameEvents.on('evt:summit-celebrated', () => {
      if (towerConfig.rewards.summitBonusXp > 0) {
        setXpPoints((prev) => prev + towerConfig.rewards.summitBonusXp);
      }
      setGameState('COMPLETED');
    });

    return () => {
      unsubReady();
      unsubProgress();
      unsubLoadError();
      unsubStep();
      unsubCheckpoint();
      unsubSectionUnlocked();
      unsubSummit();
    };
  }, []);

  const startGame = useCallback(() => {
    // Never start before the scene is listening — the command would be lost and the
    // game would sit frozen behind a dismissed start screen.
    if (!gameEvents.sceneReady) return;
    sfx.unlock();
    sfx.click();
    sfx.preloadVoices();
    setGameState('PLAYING');
    gameEvents.emit('cmd:start-game', undefined);
  }, []);

  const activeQuestion: CheckpointQuestion | null =
    activeCheckpointNumber !== null
      ? questions.find((q) => q.checkpointNumber === activeCheckpointNumber) ||
        questions[activeCheckpointNumber - 1] ||
        null
      : null;

  const evaluateChoice = useCallback(
    (chosen: number) => {
      if (
        isSubmittingRef.current ||
        !activeQuestion ||
        activeCheckpointNumber === null ||
        feedback.status === 'correct'
      ) {
        return;
      }

      // Avoid penalizing twice if the same wrong block is re-clicked
      if (feedback.wrongOptionIndices.includes(chosen)) {
        return;
      }

      const isCorrect = chosen === activeQuestion.correctAnswer;
      const newAttemptNum = feedback.attemptsForCurrentQuestion + 1;

      setTotalAttempts((prev) => prev + 1);

      if (isCorrect) {
        isSubmittingRef.current = true;
        sfx.correct();

        const mistakes = feedback.wrongOptionIndices.length;
        const isFirstTry = mistakes === 0;
        if (isFirstTry) {
          setFirstTryCount((prev) => prev + 1);
        }

        const earnedXp = getQuestionXpForMistakes(mistakes);

        setXpPoints((prev) => prev + earnedXp);

        // Update character in Phaser to goodjob.png!
        gameEvents.emit('cmd:set-character-pose', { pose: 'goodjob' });

        setFeedback((prev) => ({
          status: 'correct',
          selectedOptionIndex: chosen,
          wrongOptionIndices: prev.wrongOptionIndices,
          earnedXp,
          currentLoss: null,
          potentialXp: earnedXp,
          wrongPenalties: prev.wrongPenalties,
          hint: null,
          explanation: activeQuestion.explanation,
          attemptsForCurrentQuestion: newAttemptNum,
        }));

        setCheckpoints((prev) =>
          prev.map((cp) => {
            if (cp.checkpointNumber === activeCheckpointNumber) {
              return {
                ...cp,
                status: 'passed',
                attempts: newAttemptNum,
                solvedOnFirstTry: isFirstTry,
              };
            }
            if (cp.checkpointNumber === activeCheckpointNumber + 1) {
              return {
                ...cp,
                status: 'active',
              };
            }
            return cp;
          })
        );
      } else {
        const newWrongIndices = feedback.wrongOptionIndices.includes(chosen)
          ? feedback.wrongOptionIndices
          : [...feedback.wrongOptionIndices, chosen];
        const mistakeNumber = newWrongIndices.length;

        // Play custom voice line based on mistake count (1st mistake vs 2nd/3rd)
        sfx.wrong(mistakeNumber);

        // Update character in Phaser to retry.png!
        gameEvents.emit('cmd:set-character-pose', { pose: 'retry' });

        const penalty = getPenaltyForMistakes(mistakeNumber);
        const remainingXp = Math.max(0, towerConfig.rewards.xpPerCheckpoint - penalty);

        setFeedback((prev) => ({
          status: 'incorrect',
          // Clear the selection so the student must deliberately pick another stone
          selectedOptionIndex: null,
          wrongOptionIndices: newWrongIndices,
          earnedXp: null,
          currentLoss: penalty,
          potentialXp: remainingXp,
          wrongPenalties: {
            ...prev.wrongPenalties,
            [chosen]: penalty,
          },
          hint: activeQuestion.hint,
          explanation: null,
          attemptsForCurrentQuestion: newAttemptNum,
        }));
      }
    },
    [activeCheckpointNumber, activeQuestion, feedback]
  );

  // Tapping a stone only SELECTS it; the answer is graded when the student confirms.
  // (On phones an accidental tap used to cost XP immediately.)
  const selectOption = useCallback(
    (optionIndex: number) => {
      if (isSubmittingRef.current) return;
      setFeedback((prev) => {
        if (
          prev.status === 'correct' ||
          prev.wrongOptionIndices.includes(optionIndex) ||
          prev.selectedOptionIndex === optionIndex
        ) {
          return prev;
        }
        return { ...prev, selectedOptionIndex: optionIndex };
      });
      sfx.click();
    },
    []
  );

  const submitAnswer = useCallback(() => {
    if (feedback.selectedOptionIndex === null) return;
    evaluateChoice(feedback.selectedOptionIndex);
  }, [evaluateChoice, feedback.selectedOptionIndex]);

  const continueAfterCorrectAnswer = useCallback(() => {
    if (activeCheckpointNumber === null || feedback.status !== 'correct') {
      return;
    }

    sfx.click();
    const cpNum = activeCheckpointNumber;
    setActiveCheckpointNumber(null);
    setGameState('UNLOCK_NEXT_SECTION');
    gameEvents.emit('cmd:unlock-section', { checkpointNumber: cpNum });
  }, [activeCheckpointNumber, feedback.status]);

  const restartGame = useCallback(() => {
    sfx.click();
    isSubmittingRef.current = false;
    setCurrentStep(0);
    setHighestStep(0);
    setUnlockedSteps(towerConfig.stepsPerCheckpoint);
    setActiveCheckpointNumber(null);
    setTotalAttempts(0);
    setFirstTryCount(0);
    setXpPoints(0);
    setCheckpoints(buildInitialCheckpoints());
    setFeedback({
      status: 'idle',
      selectedOptionIndex: null,
      wrongOptionIndices: [],
      earnedXp: null,
      currentLoss: null,
      potentialXp: towerConfig.rewards.xpPerCheckpoint,
      wrongPenalties: {},
      hint: null,
      explanation: null,
      attemptsForCurrentQuestion: 0,
    });
    setGameState('PLAYING');
    gameEvents.emit('cmd:restart-game', undefined);
  }, []);

  const setTouchControls = useCallback((input: TouchInputState) => {
    gameEvents.emit('cmd:touch-input', input);
  }, []);

  const completedCheckpointsCount = checkpoints.filter(
    (c) => c.status === 'passed'
  ).length;

  return {
    gameState,
    currentStep,
    highestStep,
    unlockedSteps,
    checkpoints,
    completedCheckpointsCount,
    activeCheckpointNumber,
    activeQuestion,
    feedback,
    totalAttempts,
    firstTryCount,
    xpPoints,
    sceneReady,
    loadProgress,
    loadFailed,
    startGame,
    selectOption,
    submitAnswer,
    continueAfterCorrectAnswer,
    restartGame,
    setTouchControls,
  };
}
