import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GameState,
  CheckpointStatus,
  CheckpointQuestion,
  towerConfig,
  getCheckpointStepRange,
} from '../data/towerConfig';
import { checkpointQuestions } from '../data/sampleQuestions';
import {
  defaultQuestionBank,
  selectSessionQuestions,
  fetchQuestionsFromPublic,
  getCheckpointPool,
  initCheckpointRotation,
  advanceCheckpointRotation,
  CheckpointRotationState,
} from '../data/questionBank';
import {
  notifyPlatformGameCompleted,
  setupPlatformMessageListener,
} from '../utils/platformBridge.ts';
import { gameEvents, TouchInputState } from '../game/EventBus';
import { sfx } from '../game/sfx';
import {
  ScoringEngine,
  ScoringState,
  createInitialScoringState,
  calculateGateQuestionXp,
  calculateMistakeXpLoss,
  getPerformanceGrade,
} from '../game/scoring';

export interface CheckpointStateItem {
  checkpointNumber: number;
  stepRangeLabel: string;
  targetStep: number;
  status: CheckpointStatus;
  attempts: number;
  solvedOnFirstTry: boolean;
}

export interface QuestionAttemptFeedback {
  /**
   * idle      – fresh question, nothing answered yet
   * review    – wrong answer: mark the choice and reveal the solution before moving on
   * incorrect – a new question is shown after a mistake
   * correct   – gate solved
   */
  status: 'idle' | 'review' | 'incorrect' | 'correct';
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

/**
 * Returns a copy of the question with its options in a random order (correct index remapped),
 * so students cannot memorise "the answer is B".
 */
function shuffleQuestionOptions(q: CheckpointQuestion): CheckpointQuestion {
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    correctAnswer: order.indexOf(q.correctAnswer),
  };
}

const shufflePool = (pool: CheckpointQuestion[]): CheckpointQuestion[] =>
  pool.map(shuffleQuestionOptions);

export function useTowerGame(
  customQuestions?: CheckpointQuestion[]
) {
  const [questionBank, setQuestionBank] = useState<CheckpointQuestion[]>(defaultQuestionBank);
  const questionBankRef = useRef<CheckpointQuestion[]>(defaultQuestionBank);
  const [sessionQuestions, setSessionQuestions] = useState<CheckpointQuestion[]>(() =>
    customQuestions && customQuestions.length > 0
      ? customQuestions
      : selectSessionQuestions(defaultQuestionBank)
  );
  const customQuestionsRef = useRef<CheckpointQuestion[] | undefined>(customQuestions);
  const [checkpointRotation, setCheckpointRotation] =
    useState<CheckpointRotationState | null>(null);

  // Sync if customQuestions prop changes
  useEffect(() => {
    customQuestionsRef.current = customQuestions;
    if (customQuestions && customQuestions.length > 0) {
      setSessionQuestions(customQuestions);
    }
  }, [customQuestions]);

  // Attempt to load dynamic questions from public/questions.json if running in browser
  useEffect(() => {
    let isMounted = true;
    fetchQuestionsFromPublic().then((fetched) => {
      if (isMounted && fetched && fetched.length > 0) {
        setQuestionBank(fetched);
        questionBankRef.current = fetched;
        if (!customQuestions) {
          setSessionQuestions(selectSessionQuestions(fetched));
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [customQuestions]);

  const [gameState, setGameState] = useState<GameState>('INTRO');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [highestStep, setHighestStep] = useState<number>(0);
  const [unlockedSteps, setUnlockedSteps] = useState<number>(
    towerConfig.checkpointSteps[0]
  );
  const [activeCheckpointNumber, setActiveCheckpointNumber] = useState<
    number | null
  >(null);
  const [totalAttempts, setTotalAttempts] = useState<number>(0);
  const [firstTryCount, setFirstTryCount] = useState<number>(0);
  const [xpPoints, setXpPoints] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const elapsedTimeRef = useRef<number>(0);
  const [speedBonus, setSpeedBonus] = useState<number>(0);

  // Centralized Scoring Engine (single source of truth for scoring)
  const scoringEngineRef = useRef<ScoringEngine>(new ScoringEngine());
  const [scoringState, setScoringState] = useState<ScoringState>(() =>
    scoringEngineRef.current.getState()
  );
  const hasNotifiedPlatformRef = useRef<boolean>(false);

  // The Start button stays locked until the Phaser scene has loaded its assets
  const [sceneReady, setSceneReady] = useState<boolean>(gameEvents.sceneReady);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [loadFailed, setLoadFailed] = useState<boolean>(false);

  const buildInitialCheckpoints = (): CheckpointStateItem[] =>
    Array.from({ length: towerConfig.numberOfCheckpoints }, (_, idx) => {
      const cpNum = idx + 1;
      const [startStep, endStep] = getCheckpointStepRange(cpNum, towerConfig);
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
    potentialXp: 500,
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

        // Initialize randomized question rotation for this checkpoint's 3-question pool
        const activeBank =
          customQuestionsRef.current && customQuestionsRef.current.length > 0
            ? customQuestionsRef.current
            : questionBankRef.current;
        const pool = shufflePool(getCheckpointPool(activeBank, checkpointNumber));
        setCheckpointRotation(initCheckpointRotation(pool));

        // Check if gate was already attempted/solved
        const currentGateAttempts =
          scoringEngineRef.current.getState().gateAttempts[checkpointNumber] || 0;
        const initialPotential = calculateGateQuestionXp(currentGateAttempts + 1);

        setFeedback({
          status: 'idle',
          selectedOptionIndex: null,
          wrongOptionIndices: [],
          earnedXp: null,
          currentLoss: null,
          potentialXp: initialPotential,
          wrongPenalties: {},
          hint: null,
          explanation: null,
          attemptsForCurrentQuestion: currentGateAttempts,
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

    const unsubSummitReached = gameEvents.on('evt:summit-reached', () => {
      const finalElapsed = elapsedTimeRef.current;
      scoringEngineRef.current.recordSummitCompletion(
        finalElapsed,
        towerConfig.numberOfCheckpoints,
        gameEvents.totalCoins
      );
      const updated = scoringEngineRef.current.getState();
      setScoringState(updated);
      setSpeedBonus(updated.speedXp);
      setXpPoints(updated.totalXp);
    });

    const unsubCoin = gameEvents.on('evt:coin-collected', () => {
      scoringEngineRef.current.recordCoin();
      const updated = scoringEngineRef.current.getState();
      setScoringState(updated);
      setXpPoints(updated.totalXp);
    });

    const unsubSummitCelebrated = gameEvents.on('evt:summit-celebrated', () => {
      const finalElapsed = elapsedTimeRef.current;
      scoringEngineRef.current.recordSummitCompletion(
        finalElapsed,
        towerConfig.numberOfCheckpoints,
        gameEvents.totalCoins
      );
      const updated = scoringEngineRef.current.getState();
      setScoringState(updated);
      setSpeedBonus(updated.speedXp);
      setXpPoints(updated.totalXp);
      setGameState('COMPLETED');

      // Send the true completion flag to the host educational platform
      if (!hasNotifiedPlatformRef.current) {
        hasNotifiedPlatformRef.current = true;
        const gradeInfo = getPerformanceGrade(updated.totalXp, towerConfig.numberOfCheckpoints);
        notifyPlatformGameCompleted({
          score: updated.totalXp,
          grade: gradeInfo.grade,
          gradeName: gradeInfo.title,
          elapsedTimeSeconds: finalElapsed,
          totalAttempts: updated.totalAttempts,
          // Count from the scoring engine (a React state value here would be stale: always 0)
          firstTryCount: Object.keys(updated.gateSolved).filter(
            (gate) => updated.gateSolved[Number(gate)] && updated.gateAttempts[Number(gate)] === 1
          ).length,
        });
      }
    });

    const unsubPlatform = setupPlatformMessageListener(() => hasNotifiedPlatformRef.current);

    return () => {
      unsubReady();
      unsubProgress();
      unsubLoadError();
      unsubStep();
      unsubCheckpoint();
      unsubSectionUnlocked();
      unsubSummitReached();
      unsubSummitCelebrated();
      unsubCoin();
      unsubPlatform();
    };
  }, []);

  // Continuous Stopwatch Timer
  // Counts real elapsed time (Date.now deltas, so nothing is lost between state changes)
  // while climbing AND while solving checkpoint questions (pauses only while tab is hidden).
  const elapsedMsRef = useRef<number>(0);
  useEffect(() => {
    const isClockRunning =
      gameState === 'PLAYING' ||
      gameState === 'CHECKPOINT_REACHED' ||
      gameState === 'QUESTION_ACTIVE' ||
      gameState === 'UNLOCK_NEXT_SECTION';
    if (!isClockRunning) return;

    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      if (!document.hidden) {
        // Ignore huge gaps (device sleep / throttled background timers)
        elapsedMsRef.current += Math.min(now - last, 1000);
      }
      last = now;
      const secs = Math.floor(elapsedMsRef.current / 1000);
      if (secs !== elapsedTimeRef.current) {
        elapsedTimeRef.current = secs;
        setElapsedTime(secs);
      }
    };
    const intervalId = window.setInterval(tick, 200);

    return () => {
      tick();
      window.clearInterval(intervalId);
    };
  }, [gameState]);

  const startGame = useCallback(() => {
    // Never start before the scene is listening — the command would be lost and the
    // game would sit frozen behind a dismissed start screen.
    if (!gameEvents.sceneReady) return;
    sfx.unlock();
    sfx.click();
    sfx.preloadVoices();
    scoringEngineRef.current.reset();
    setScoringState(scoringEngineRef.current.getState());
    elapsedTimeRef.current = 0;
    elapsedMsRef.current = 0;
    setElapsedTime(0);
    setSpeedBonus(0);
    setXpPoints(0);
    setTotalAttempts(0);
    setFirstTryCount(0);
    if (!customQuestions) {
      setSessionQuestions(selectSessionQuestions(questionBankRef.current));
    }
    setGameState('PLAYING');
    gameEvents.emit('cmd:start-game', undefined);
  }, [customQuestions]);

  const activeQuestion: CheckpointQuestion | null =
    activeCheckpointNumber !== null
      ? (checkpointRotation &&
          checkpointRotation.queue[checkpointRotation.currentIndex]) ||
        sessionQuestions.find((q) => q.checkpointNumber === activeCheckpointNumber) ||
        sessionQuestions[activeCheckpointNumber - 1] ||
        null
      : null;

  const evaluateChoice = useCallback(
    (chosen: number) => {
      if (
        isSubmittingRef.current ||
        !activeQuestion ||
        activeCheckpointNumber === null ||
        feedback.status === 'correct' ||
        feedback.status === 'review'
      ) {
        return;
      }

      // Avoid penalizing twice if the same wrong block is re-clicked
      if (feedback.wrongOptionIndices.includes(chosen)) {
        return;
      }

      const isCorrect = chosen === activeQuestion.correctAnswer;
      const newAttemptNum = feedback.attemptsForCurrentQuestion + 1;

      if (isCorrect) {
        isSubmittingRef.current = true;
        sfx.correct();

        const result = scoringEngineRef.current.recordCorrectAnswer(activeCheckpointNumber);

        const updatedScoring = scoringEngineRef.current.getState();
        setScoringState(updatedScoring);
        setXpPoints(updatedScoring.totalXp);
        setTotalAttempts(updatedScoring.totalAttempts);
        if (result.isFirstTry) {
          setFirstTryCount((prev) => prev + 1);
        }

        // Play achievement chime if any achievement unlocked
        if (result.achievementsUnlocked.length > 0) {
          sfx.badgeStamp();
        }

        // Update character in Phaser to goodjob.png!
        gameEvents.emit('cmd:set-character-pose', { pose: 'goodjob' });

        setFeedback((prev) => ({
          status: 'correct',
          selectedOptionIndex: chosen,
          wrongOptionIndices: prev.wrongOptionIndices,
          earnedXp: result.questionXpEarned,
          currentLoss: null,
          potentialXp: result.questionXpEarned,
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
                solvedOnFirstTry: result.isFirstTry,
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
        const mistakeNumber = feedback.attemptsForCurrentQuestion + 1;

        // Play custom voice line based on mistake count (1st mistake vs 2nd/3rd)
        sfx.wrong(mistakeNumber);

        // Update character in Phaser to retry.png!
        gameEvents.emit('cmd:set-character-pose', { pose: 'retry' });

        const result = scoringEngineRef.current.recordIncorrectAttempt(
          activeCheckpointNumber
        );
        const updatedScoring = scoringEngineRef.current.getState();
        setScoringState(updatedScoring);
        setTotalAttempts(updatedScoring.totalAttempts);

        // XP this mistake cost at the gate: 50, then 150, then 300 (none after that)
        const penaltyApplied = calculateMistakeXpLoss(result.attemptNumber);

        // Mark the wrong choice and reveal the solution during review. A fresh
        // question comes when they press "Try a New Question".
        setFeedback({
          status: 'review',
          selectedOptionIndex: chosen,
          wrongOptionIndices: [chosen],
          earnedXp: null,
          currentLoss: penaltyApplied,
          potentialXp: result.potentialXp,
          wrongPenalties: {},
          hint: null,
          explanation: null,
          attemptsForCurrentQuestion: newAttemptNum,
        });
      }
    },
    [activeCheckpointNumber, activeQuestion, feedback]
  );

  /** After a wrong answer, move on to a fresh question. */
  const nextQuestionAfterReview = useCallback(() => {
    if (activeCheckpointNumber === null || feedback.status !== 'review') return;
    sfx.click();
    const activeBank =
      customQuestionsRef.current && customQuestionsRef.current.length > 0
        ? customQuestionsRef.current
        : questionBankRef.current;
    const pool = shufflePool(getCheckpointPool(activeBank, activeCheckpointNumber));
    setCheckpointRotation((prev) =>
      prev ? advanceCheckpointRotation(prev, pool) : initCheckpointRotation(pool)
    );
    setFeedback((prev) => ({
      ...prev,
      status: 'incorrect',
      selectedOptionIndex: null,
      wrongOptionIndices: [],
      explanation: null,
    }));
  }, [activeCheckpointNumber, feedback.status]);

  // Tapping a stone only SELECTS it; the answer is graded when the student confirms.
  // (On phones an accidental tap used to cost XP immediately.)
  const selectOption = useCallback(
    (optionIndex: number) => {
      if (isSubmittingRef.current) return;
      setFeedback((prev) => {
        if (
          prev.status === 'correct' ||
          prev.status === 'review' ||
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
    setCheckpointRotation(null);
    setGameState('UNLOCK_NEXT_SECTION');
    gameEvents.emit('cmd:unlock-section', { checkpointNumber: cpNum });
  }, [activeCheckpointNumber, feedback.status]);

  const restartGame = useCallback(() => {
    sfx.click();
    isSubmittingRef.current = false;
    hasNotifiedPlatformRef.current = false;
    scoringEngineRef.current.reset();
    setScoringState(scoringEngineRef.current.getState());
    setCurrentStep(0);
    setHighestStep(0);
    setUnlockedSteps(towerConfig.checkpointSteps[0]);
    setActiveCheckpointNumber(null);
    setCheckpointRotation(null);
    setTotalAttempts(0);
    setFirstTryCount(0);
    setXpPoints(0);
    elapsedTimeRef.current = 0;
    elapsedMsRef.current = 0;
    setElapsedTime(0);
    setSpeedBonus(0);
    setCheckpoints(buildInitialCheckpoints());
    if (!customQuestions) {
      setSessionQuestions(selectSessionQuestions(questionBankRef.current));
    }
    setFeedback({
      status: 'idle',
      selectedOptionIndex: null,
      wrongOptionIndices: [],
      earnedXp: null,
      currentLoss: null,
      potentialXp: 500,
      wrongPenalties: {},
      hint: null,
      explanation: null,
      attemptsForCurrentQuestion: 0,
    });
    setGameState('PLAYING');
    gameEvents.emit('cmd:restart-game', undefined);
  }, [customQuestions]);

  const dismissNotification = useCallback((id: string) => {
    setScoringState((prev) => ({
      ...prev,
      recentNotifications: prev.recentNotifications.filter((n) => n.id !== id),
    }));
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
    questionBank,
    sessionQuestions,
    feedback,
    totalAttempts,
    firstTryCount,
    xpPoints,
    elapsedTime,
    speedBonus,
    scoringState,
    dismissNotification,
    sceneReady,
    loadProgress,
    loadFailed,
    startGame,
    selectOption,
    submitAnswer,
    nextQuestionAfterReview,
    continueAfterCorrectAnswer,
    restartGame,
    setTouchControls,
  };
}
