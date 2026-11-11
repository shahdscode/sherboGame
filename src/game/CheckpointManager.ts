import { TowerConfigRuntime } from '../data/towerConfig';
import { PlatformData } from './PlatformManager';

export class CheckpointManager {
  private config: TowerConfigRuntime;
  private triggeredCheckpoints: Set<number> = new Set();
  private completedCheckpoints: Set<number> = new Set();
  private highestStepReached: number = 0;

  constructor(config: TowerConfigRuntime) {
    this.config = config;
  }

  public canTriggerCheckpoint(checkpointNumber: number): boolean {
    if (
      checkpointNumber < 1 ||
      checkpointNumber > this.config.numberOfCheckpoints
    ) {
      return false;
    }
    // Enforce sequential checkpoints and single-trigger guarantee
    if (this.triggeredCheckpoints.has(checkpointNumber)) {
      return false;
    }
    if (
      checkpointNumber > 1 &&
      !this.completedCheckpoints.has(checkpointNumber - 1)
    ) {
      return false;
    }
    return true;
  }

  public markCheckpointTriggered(checkpointNumber: number): void {
    this.triggeredCheckpoints.add(checkpointNumber);
  }

  public markCheckpointCompleted(checkpointNumber: number): void {
    this.triggeredCheckpoints.add(checkpointNumber);
    this.completedCheckpoints.add(checkpointNumber);
  }

  public isCheckpointCompleted(checkpointNumber: number): boolean {
    return this.completedCheckpoints.has(checkpointNumber);
  }

  public updateStepProgress(stepNumber: number): {
    changed: boolean;
    currentStep: number;
    highestStep: number;
  } {
    const prevHighest = this.highestStepReached;
    if (stepNumber > this.highestStepReached) {
      this.highestStepReached = stepNumber;
    }
    return {
      changed: this.highestStepReached !== prevHighest,
      currentStep: stepNumber,
      highestStep: this.highestStepReached,
    };
  }

  public checkPlatformLanding(platform: PlatformData): {
    shouldTriggerCheckpoint: boolean;
    checkpointNumber: number | null;
  } {
    if (
      platform.isCheckpoint &&
      platform.checkpointNumber !== null &&
      this.canTriggerCheckpoint(platform.checkpointNumber)
    ) {
      this.markCheckpointTriggered(platform.checkpointNumber);
      return {
        shouldTriggerCheckpoint: true,
        checkpointNumber: platform.checkpointNumber,
      };
    }
    return {
      shouldTriggerCheckpoint: false,
      checkpointNumber: null,
    };
  }

  public reset(): void {
    this.triggeredCheckpoints.clear();
    this.completedCheckpoints.clear();
    this.highestStepReached = 0;
  }
}
