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
  options: [string, string, string, string];
  correctAnswer: number;
  hint: string;
  explanation: string;
}

export interface TowerConfig {
  totalSteps: number;
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
    firstTryBonusXp: number;
    summitBonusXp: number;
  };
}

export interface TowerConfigRuntime extends TowerConfig {
  worldHeight: number;
  groundY: number;
}

export const towerConfig: TowerConfigRuntime = {
  totalSteps: 30,
  stepsPerCheckpoint: 5,
  // 5 question checkpoints (Steps 5, 10, 15, 20, 25); Step 30 is the Finish Line!
  numberOfCheckpoints: 5,
  platformSpacingY: 108,
  towerWidth: 720,
  wallThickness: 44,
  regularPlatformWidth: 165,
  checkpointPlatformWidth: 632, // Full inner width between walls (720 - 44*2)
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
    xpPerCheckpoint: 150,
    firstTryBonusXp: 50,
    summitBonusXp: 300,
  },
  worldHeight: 3800,
  groundY: 3620,
};
