import Phaser from 'phaser';
import { towerConfig, TowerConfigRuntime } from '../data/towerConfig';
import { PlatformManager } from './PlatformManager';
import { Player } from './Player';
import { CameraManager } from './CameraManager';
import { CheckpointManager } from './CheckpointManager';
import { gameEvents } from './EventBus';

export class TowerScene extends Phaser.Scene {
  private config: TowerConfigRuntime = towerConfig;
  private platformManager!: PlatformManager;
  private player!: Player;
  private cameraManager!: CameraManager;
  private checkpointManager!: CheckpointManager;

  private isPlaying: boolean = false;
  private isPausedAtCheckpoint: boolean = false;
  private isCompleted: boolean = false;
  private lastReportedStep: number = 0;
  private unsubscribeFns: Array<() => void> = [];

  constructor() {
    super({ key: 'TowerScene' });
  }

  public preload(): void {
    Player.preloadAssets(this);
  }

  public create(): void {
    const { towerWidth, worldHeight, wallThickness } = this.config;

    this.physics.world.setBounds(
      wallThickness,
      0,
      towerWidth - wallThickness * 2,
      worldHeight
    );

    this.platformManager = new PlatformManager(this, this.config);
    this.platformManager.buildTower();

    this.player = new Player(this, this.config);
    this.cameraManager = new CameraManager(this, this.config);
    this.cameraManager.setup(this.player.sprite);
    this.cameraManager.resetToBottom();

    this.checkpointManager = new CheckpointManager(this.config);

    // Collisions with tower platforms
    this.physics.add.collider(
      this.player.sprite,
      this.platformManager.getStaticGroup(),
      (_playerObj, platformObj) => {
        this.handlePlatformCollision(
          platformObj as Phaser.Physics.Arcade.Sprite
        );
      }
    );

    // Collision with section ceiling barrier so the player can never jump above an unanswered checkpoint
    this.physics.add.collider(
      this.player.sprite,
      this.platformManager.getCeilingBarrier()
    );

    this.registerEventListeners();

    this.isPlaying = false;
    this.physics.world.pause();

    if (typeof window !== 'undefined') {
      (window as any).__TOWER_SCENE__ = this;
      (window as any).__TOWER_EVENTS__ = gameEvents;
    }

    gameEvents.emit('evt:scene-ready', undefined);
  }

  private registerEventListeners(): void {
    this.unsubscribeFns.forEach((fn) => fn());
    this.unsubscribeFns = [];

    this.unsubscribeFns.push(
      gameEvents.on('cmd:start-game', () => {
        this.isPlaying = true;
        this.isPausedAtCheckpoint = false;
        this.isCompleted = false;
        this.player.setPose('climbing');
        this.physics.world.resume();
      })
    );

    this.unsubscribeFns.push(
      gameEvents.on('cmd:unlock-section', ({ checkpointNumber }) => {
        this.handleUnlockSection(checkpointNumber);
      })
    );

    this.unsubscribeFns.push(
      gameEvents.on('cmd:complete-summit', () => {
        this.handleSummitCompletion();
      })
    );

    this.unsubscribeFns.push(
      gameEvents.on('cmd:restart-game', () => {
        this.handleRestartGame();
      })
    );

    this.unsubscribeFns.push(
      gameEvents.on('cmd:touch-input', (inputState) => {
        if (this.player) {
          this.player.setTouchInput(inputState);
        }
      })
    );

    this.unsubscribeFns.push(
      gameEvents.on('cmd:set-character-pose', ({ pose }) => {
        if (this.player) {
          this.player.setPose(pose);
        }
      })
    );

    this.unsubscribeFns.push(
      gameEvents.on('cmd:teleport-to-step', ({ stepNumber }) => {
        const platform = this.platformManager.getPlatform(stepNumber);
        if (platform && platform.unlocked) {
          this.player.sprite.setPosition(
            platform.x,
            platform.y - platform.height / 2 - this.config.player.height / 2 - 14
          );
          this.player.sprite.setVelocity(0, 0);
        }
      })
    );

    const cleanupAll = () => {
      this.unsubscribeFns.forEach((fn) => fn());
      this.unsubscribeFns = [];
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupAll);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanupAll);
  }

  public onResize(): void {
    if (this.cameraManager) {
      this.cameraManager.updateZoom();
    }
  }

  public cleanupListeners(): void {
    this.unsubscribeFns.forEach((fn) => fn());
    this.unsubscribeFns = [];
  }

  private handlePlatformCollision(
    platformSprite: Phaser.Physics.Arcade.Sprite
  ): void {
    if (!this.isPlaying || this.isPausedAtCheckpoint || this.isCompleted) {
      return;
    }

    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    if (!body || !(body.blocked.down || body.touching.down)) {
      return;
    }

    const matchedPlatform = this.platformManager
      .getAllPlatforms()
      .find((p) => p.sprite === platformSprite);

    if (!matchedPlatform || !matchedPlatform.unlocked) {
      return;
    }

    const progress = this.checkpointManager.updateStepProgress(
      matchedPlatform.stepNumber
    );
    if (
      progress.changed ||
      matchedPlatform.stepNumber !== this.lastReportedStep
    ) {
      this.lastReportedStep = matchedPlatform.stepNumber;
      gameEvents.emit('evt:step-updated', {
        currentStep: progress.currentStep,
        highestStep: progress.highestStep,
      });
    }

    // Step 30 is the Finish Line! Reaching it completes the game immediately
    if (matchedPlatform.isSummit) {
      this.handleSummitCompletion();
      return;
    }

    // Check if this landing triggers one of the 5 mandatory checkpoints (Steps 5, 10, 15, 20, 25)
    const cpResult =
      this.checkpointManager.checkPlatformLanding(matchedPlatform);
    if (
      cpResult.shouldTriggerCheckpoint &&
      cpResult.checkpointNumber !== null
    ) {
      this.triggerCheckpointPause(
        cpResult.checkpointNumber,
        matchedPlatform.stepNumber
      );
    }
  }

  private triggerCheckpointPause(
    checkpointNumber: number,
    stepNumber: number
  ): void {
    this.isPausedAtCheckpoint = true;
    this.player.freeze();
    // Switch character in the tower to question.png when reaching a checkpoint
    this.player.setPose('question');
    this.physics.world.pause();

    const platform = this.platformManager.getPlatform(stepNumber);
    if (platform) {
      const ring = this.add
        .circle(this.player.sprite.x, platform.y, 18, 0xfde047, 0.7)
        .setDepth(25);
      this.tweens.add({
        targets: ring,
        scale: 3.5,
        alpha: 0,
        duration: 450,
        onComplete: () => ring.destroy(),
      });
    }

    gameEvents.emit('evt:checkpoint-reached', {
      checkpointNumber,
      stepNumber,
    });
  }

  private handleUnlockSection(checkpointNumber: number): void {
    this.checkpointManager.markCheckpointCompleted(checkpointNumber);

    const nextSectionIndex = checkpointNumber + 1;
    this.platformManager.unlockSection(nextSectionIndex);

    const unlockedUpToStep =
      nextSectionIndex * this.config.stepsPerCheckpoint;

    // Return character back to climbing figure when resuming climb
    this.player.setPose('climbing');
    this.isPausedAtCheckpoint = false;
    this.physics.world.resume();

    gameEvents.emit('evt:section-unlocked', {
      checkpointNumber,
      unlockedUpToStep,
    });
  }

  private handleSummitCompletion(): void {
    if (this.isCompleted) return;
    this.isPausedAtCheckpoint = false;
    this.isCompleted = true;
    this.player.freeze();
    this.player.setPose('goodjob');
    this.physics.world.pause();

    const summitPlatform = this.platformManager.getPlatform(
      this.config.totalSteps
    );
    if (summitPlatform) {
      this.tweens.add({
        targets: this.player.sprite,
        x: this.config.towerWidth / 2,
        y: summitPlatform.y - this.config.player.height / 2,
        duration: 300,
        ease: 'Back.easeOut',
      });
    }

    gameEvents.emit('evt:summit-celebrated', undefined);
  }

  private handleRestartGame(): void {
    this.checkpointManager.reset();
    this.platformManager.resetSections();
    this.player.resetPosition();
    this.cameraManager.resetToBottom();
    this.lastReportedStep = 0;
    this.isPausedAtCheckpoint = false;
    this.isCompleted = false;
    this.isPlaying = true;
    this.physics.world.resume();
  }

  public update(_time: number, delta: number): void {
    const canControl =
      this.isPlaying && !this.isPausedAtCheckpoint && !this.isCompleted;
    this.player.update(delta, canControl);
  }
}
