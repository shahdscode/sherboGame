export type GameState =
  | 'INTRO'
  | 'PLAYING'
  | 'CHECKPOINT_REACHED'
  | 'QUESTION_ACTIVE'
  | 'UNLOCK_NEXT_SECTION'
  | 'COMPLETED';

export type CheckpointStatus = 'locked' | 'active' | 'passed';

export interface CheckpointQuestion {
  id: string;
  checkpointNumber: number;
  title: string;
  prompt: string;
  sequence?: string[];
  options: string[];
  correctAnswer: number;
  hint: string;
  explanation: string;
  /** Absolute URL of an image shown with the question. */
  image?: string;
}

export interface TowerConfig {
  totalSteps: number;
  /** Steps before each checkpoint / summit: [4, 7, 10, 13, 16, 19] (+3 steps each section) */
  sectionSteps: number[];
  /** Exact step numbers of the question checkpoints: [5, 13, 24, 38, 55] */
  checkpointSteps: number[];
  /** Legacy fallback for uniform steps per checkpoint */
  stepsPerCheckpoint: number;
  numberOfCheckpoints: number;
  platformSpacingY: number;
  towerWidth: number;
  wallThickness: number;
  regularPlatformWidth: number;
  checkpointPlatformWidth: number;
  platformHeight: number;
  player: {
    width: number;
    height: number;
    moveSpeed: number;
    acceleration: number;
    drag: number;
    jumpVelocity: number;
    gravityY: number;
  };
  rewards: {
    xpPerCheckpoint: number;
    penalty1stMistake: number;
    penalty2ndMistake: number;
    penalty3rdMistake: number;
    firstTryBonusXp: number;
    summitBonusXp: number;
    maxSpeedBonus: number;
    targetTimeSeconds: number;
    speedBonusDecayPerSec: number;
    speedBonusMin: number;
  };
}

export interface TowerConfigRuntime extends TowerConfig {
  worldHeight: number;
  groundY: number;
}

// Progressive step counts:
// Section 1: 4 steps before CP 1 -> Checkpoint 1 at Step 5
// Section 2: 7 steps before CP 2 -> Checkpoint 2 at Step 13
// Section 3: 10 steps before CP 3 -> Checkpoint 3 at Step 24
// Section 4: 13 steps before CP 4 -> Checkpoint 4 at Step 38
// Section 5: 16 steps before CP 5 -> Checkpoint 5 at Step 55
// Section 6: 19 steps before Summit -> Finish Line at Step 75
const SECTION_STEPS = [4, 7, 10, 13, 16, 19];
const CHECKPOINT_STEPS = [5, 13, 24, 38, 55];
const TOTAL_STEPS = 75;

export const towerConfig: TowerConfigRuntime = {
  totalSteps: TOTAL_STEPS,
  sectionSteps: SECTION_STEPS,
  checkpointSteps: CHECKPOINT_STEPS,
  stepsPerCheckpoint: 5,
  numberOfCheckpoints: 5,
  platformSpacingY: 108,
  // Platforms are laid out relative to the centre, so widening the tower only adds open
  // space near the walls (lets wide screens zoom out without thicker-looking walls).
  towerWidth: 800,
  wallThickness: 44,
  regularPlatformWidth: 165,
  checkpointPlatformWidth: 712, // Full inner width between walls (800 - 44*2)
  platformHeight: 24,
  player: {
    width: 38,
    height: 68,
    moveSpeed: 310,
    acceleration: 1800,
    drag: 1600,
    jumpVelocity: -640, // Ensures comfortable ~168px max jump height for 108px vertical spacing
    gravityY: 1220,
  },
  rewards: {
    xpPerCheckpoint: 500,
    penalty1stMistake: 50,
    penalty2ndMistake: 150,
    penalty3rdMistake: 500,
    firstTryBonusXp: 0,
    summitBonusXp: 300,
    maxSpeedBonus: 600,
    targetTimeSeconds: 90,
    speedBonusDecayPerSec: 2.5,
    speedBonusMin: 0,
  },
  // summit platform at y = 380: groundY = 380 + 75 * 108 = 8480; worldHeight = 8480 + 180 = 8660
  worldHeight: 8660,
  groundY: 8480,
};

export const MAX_LEVELS = CHECKPOINT_STEPS.length;

/**
 * Tower geometry for 1..5 levels (gates). It keeps the first sections of the
 * full tower, so 5 levels gives exactly the default 75-step tower.
 */
export function buildTowerGeometry(levelCount: number) {
  const levels = Math.max(1, Math.min(MAX_LEVELS, Math.floor(levelCount)));
  const sectionSteps = SECTION_STEPS.slice(0, levels + 1);
  const totalSteps =
    sectionSteps.reduce((sum, steps) => sum + steps, 0) + levels + 1;
  const groundY = 380 + totalSteps * 108;
  return {
    numberOfCheckpoints: levels,
    sectionSteps,
    checkpointSteps: CHECKPOINT_STEPS.slice(0, levels),
    totalSteps,
    groundY,
    worldHeight: groundY + 180,
  };
}

/**
 * Resizes the shared `towerConfig` in place. Call it before the game
 * (Phaser scene and React HUD) mounts, so every reader sees the same tower.
 */
export function applyTowerLevels(levelCount: number) {
  Object.assign(towerConfig, buildTowerGeometry(levelCount));
}

/**
 * Formats seconds into a stopwatch `mm:ss` display (e.g. 01:24).
 */
export function formatStopwatchTime(seconds: number): string {
  const safeSecs = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSecs / 60);
  const secs = safeSecs % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Returns the section index (1-based, 1..6) that a given step belongs to.
 */
export function getSectionIndexForStep(
  step: number,
  config: TowerConfig = towerConfig
): number {
  let accumulated = 0;
  for (let i = 0; i < config.sectionSteps.length; i++) {
    // each section has sectionSteps[i] regular steps + 1 checkpoint (or summit) step
    const sectionTotal = config.sectionSteps[i] + 1;
    accumulated += sectionTotal;
    if (step <= accumulated) {
      return i + 1;
    }
  }
  return config.sectionSteps.length;
}

/**
 * Returns structural information about a specific step:
 * - isCheckpoint: true if this step is a question checkpoint platform
 * - checkpointNumber: 1..numberOfCheckpoints if checkpoint, else null
 * - isSummit: true if this step is the finish line
 * - sectionIndex: 1-based section number (1..6)
 * - stepInSection: 0-based index of regular step within the section
 */
export function getStepInfo(
  step: number,
  config: TowerConfig = towerConfig
): {
  isCheckpoint: boolean;
  checkpointNumber: number | null;
  isSummit: boolean;
  sectionIndex: number;
  stepInSection: number;
} {
  const isSummit = step === config.totalSteps;
  const cpIndex = config.checkpointSteps.indexOf(step);
  const isCheckpoint = cpIndex !== -1;
  const checkpointNumber = isCheckpoint ? cpIndex + 1 : null;
  const sectionIndex = getSectionIndexForStep(step, config);

  // Compute accumulated steps prior to this section
  let prevAccumulated = 0;
  for (let i = 0; i < sectionIndex - 1; i++) {
    prevAccumulated += config.sectionSteps[i] + 1;
  }
  const stepInSection = Math.max(0, step - prevAccumulated - 1);

  return {
    isCheckpoint,
    checkpointNumber,
    isSummit,
    sectionIndex,
    stepInSection,
  };
}

/**
 * Returns the step number where a section ends (its checkpoint or summit).
 */
export function getMaxStepForSection(
  sectionIndex: number,
  config: TowerConfig = towerConfig
): number {
  if (sectionIndex <= config.numberOfCheckpoints) {
    return config.checkpointSteps[sectionIndex - 1];
  }
  return config.totalSteps;
}

/**
 * Returns the range of steps [startStep, endStep] for a checkpoint (1-based).
 */
export function getCheckpointStepRange(
  checkpointNumber: number,
  config: TowerConfig = towerConfig
): [number, number] {
  const endStep = config.checkpointSteps[checkpointNumber - 1];
  const startStep =
    checkpointNumber === 1
      ? 1
      : config.checkpointSteps[checkpointNumber - 2] + 1;
  return [startStep, endStep];
}
