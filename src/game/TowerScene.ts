import Phaser from 'phaser';
import {
  towerConfig,
  TowerConfigRuntime,
  getMaxStepForSection,
} from '../data/towerConfig';
import { PlatformManager, PlatformData } from './PlatformManager';
import { Player } from './Player';
import { CameraManager } from './CameraManager';
import { CheckpointManager } from './CheckpointManager';
import { gameEvents } from './EventBus';
import { sfx } from './sfx';

export class TowerScene extends Phaser.Scene {
  private config: TowerConfigRuntime = towerConfig;
  public platformManager!: PlatformManager;
  public player!: Player;
  private cameraManager!: CameraManager;
  private checkpointManager!: CheckpointManager;

  private isPlaying: boolean = false;
  private isPausedAtCheckpoint: boolean = false;
  private isCompleted: boolean = false;
  private isLandingSequence: boolean = false;
  private lastReportedStep: number = 0;
  /** Platform under the climber this frame (set by the physics collision, cleared each update). */
  private groundPlatform: PlatformData | null = null;
  private musicLevel: number = 1;
  private unsubscribeFns: Array<() => void> = [];

  constructor() {
    super({ key: 'TowerScene' });
  }

  public preload(): void {
    gameEvents.sceneReady = false;
    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      gameEvents.emit('evt:load-progress', { progress });
    });
    this.load.on(
      Phaser.Loader.Events.FILE_LOAD_ERROR,
      (file: Phaser.Loader.File) => {
        gameEvents.emit('evt:load-error', { file: String(file?.key ?? '') });
      }
    );
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

    // Debug handles for local development / automated tests only (never in production,
    // otherwise students could skip gates from the browser console).
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as any).__TOWER_SCENE__ = this;
      (window as any).__TOWER_EVENTS__ = gameEvents;
    }

    gameEvents.sceneReady = true;
    gameEvents.emit('evt:scene-ready', undefined);
  }

  private registerEventListeners(): void {
    this.unsubscribeFns.forEach((fn) => fn());
    this.unsubscribeFns = [];

    this.unsubscribeFns.push(
      gameEvents.on('cmd:start-game', () => {
        this.musicLevel = 1;
        sfx.startMusic(1);
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
        if (!import.meta.env.DEV) return;
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
      gameEvents.sceneReady = false;
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

    const matchedPlatform =
      this.platformManager.getPlatformBySprite(platformSprite);

    if (!matchedPlatform || !matchedPlatform.unlocked) {
      return;
    }

    this.groundPlatform = matchedPlatform;

    // Special platform behaviours
    if (matchedPlatform.kind === 'spring') {
      this.player.springLaunch(-930);
      this.platformManager.animateSpring(matchedPlatform);
      sfx.spring();
    } else if (matchedPlatform.kind === 'crumble') {
      this.platformManager.onPlayerStanding(matchedPlatform);
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

    // Step 30 is the Finish Line! Let the character land visually before celebrating victory
    if (matchedPlatform.isSummit) {
      if (this.isCompleted || this.isLandingSequence) return;
      this.isLandingSequence = true;

      // Brief landing beat before celebrating victory
      this.time.delayedCall(400, () => {
        this.handleSummitCompletion();
        this.isLandingSequence = false;
      });
      return;
    }

    // Check if this landing triggers one of the 5 mandatory checkpoints (Steps 5, 10, 15, 20, 25)
    const cpResult =
      this.checkpointManager.checkPlatformLanding(matchedPlatform);
    if (
      cpResult.shouldTriggerCheckpoint &&
      cpResult.checkpointNumber !== null
    ) {
      if (this.isPausedAtCheckpoint || this.isLandingSequence) return;
      this.isLandingSequence = true;

      // Trigger checkpoint promptly upon landing so the gate lock feels responsive
      this.time.delayedCall(180, () => {
        this.triggerCheckpointPause(
          cpResult.checkpointNumber!,
          matchedPlatform.stepNumber
        );
        this.isLandingSequence = false;
      });
    }
  }

  private triggerCheckpointPause(
    checkpointNumber: number,
    stepNumber: number
  ): void {
    this.isPausedAtCheckpoint = true;
    this.player.freeze();
    this.physics.world.pause();
    sfx.checkpoint();
    sfx.duckMusic(true);

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
    sfx.unlockGate();
    this.cameras.main.shake(260, 0.0045);
    // Each section raises the music's energy a little
    this.musicLevel = nextSectionIndex;
    sfx.duckMusic(false);
    sfx.setMusicLevel(nextSectionIndex);

    const unlockedUpToStep = getMaxStepForSection(
      nextSectionIndex,
      this.config
    );

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
    this.player.setPose('victory');
    this.physics.world.pause();
    sfx.stopMusic();
    sfx.victory();

    const summitPlatform = this.platformManager.getPlatform(
      this.config.totalSteps
    );
    if (summitPlatform) {
      // Position character right beside the trophy cup (cup is at centerX = 360)
      const centerX = this.config.towerWidth / 2;
      const besideCupX = centerX + 28;
      this.player.setPosition(
        besideCupX,
        summitPlatform.y - this.config.player.height / 2
      );

      const ring = this.add
        .circle(besideCupX, summitPlatform.y, 24, 0xfde047, 0.85)
        .setDepth(25);
      this.tweens.add({
        targets: ring,
        scale: 4.5,
        alpha: 0,
        duration: 550,
        onComplete: () => ring.destroy(),
      });
    }

    // Immediately notify that summit was reached so stopwatch stops and scoring is calculated
    gameEvents.emit('evt:summit-reached', undefined);

    // Allow the student to watch the character celebrate at the summit before the result card arrives
    window.setTimeout(() => {
      gameEvents.emit('evt:summit-celebrated', undefined);
    }, 850);
  }

  private handleRestartGame(): void {
    this.checkpointManager.reset();
    this.platformManager.resetSections();
    this.player.resetPosition();
    this.cameraManager.resetToBottom();
    this.lastReportedStep = 0;
    this.groundPlatform = null;
    this.isPausedAtCheckpoint = false;
    this.isCompleted = false;
    this.isLandingSequence = false;
    this.isPlaying = true;
    this.musicLevel = 1;
    sfx.startMusic(1);
    this.physics.world.resume();
  }

  public update(time: number, delta: number): void {
    const canControl =
      this.isPlaying &&
      !this.isPausedAtCheckpoint &&
      !this.isCompleted &&
      !this.isLandingSequence;
    const worldRunning = !this.physics.world.isPaused;
    const standing = this.groundPlatform;
    this.groundPlatform = null;

    // Move platforms first; a moving platform carries the climber standing on it
    const carryDx = this.platformManager.update(time, delta, worldRunning, standing);
    if (carryDx !== 0 && worldRunning) {
      this.player.sprite.x += carryDx;
    }

    this.player.update(delta, canControl, standing?.kind === 'ice');

    if (this.isPlaying && !this.isCompleted) {
      this.platformManager.collectCoinsNear(this.player.sprite.x, this.player.sprite.y);
    }
  }
}
