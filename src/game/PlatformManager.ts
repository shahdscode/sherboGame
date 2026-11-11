import Phaser from 'phaser';
import { TowerConfigRuntime } from '../data/towerConfig';

export interface PlatformData {
  stepNumber: number;
  isCheckpoint: boolean;
  checkpointNumber: number | null;
  isSummit: boolean;
  sectionIndex: number; // 1 for steps 1..5, 2 for 6..10, ..., 6 for 26..30
  x: number;
  y: number;
  width: number;
  height: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  decorations: Phaser.GameObjects.GameObject[];
  unlocked: boolean;
}

export class PlatformManager {
  private scene: Phaser.Scene;
  private config: TowerConfigRuntime;
  private staticGroup: Phaser.Physics.Arcade.StaticGroup;
  private platforms: Map<number, PlatformData> = new Map();
  private ceilingBarrier!: Phaser.Physics.Arcade.Sprite;
  private ceilingGlow!: Phaser.GameObjects.Rectangle;
  private ceilingLabel!: Phaser.GameObjects.Text;
  private unlockedSection: number = 1;

  constructor(scene: Phaser.Scene, config: TowerConfigRuntime) {
    this.scene = scene;
    this.config = config;
    this.staticGroup = this.scene.physics.add.staticGroup();
  }

  public getStaticGroup(): Phaser.Physics.Arcade.StaticGroup {
    return this.staticGroup;
  }

  public getCeilingBarrier(): Phaser.Physics.Arcade.Sprite {
    return this.ceilingBarrier;
  }

  public getPlatform(stepNumber: number): PlatformData | undefined {
    return this.platforms.get(stepNumber);
  }

  public getAllPlatforms(): PlatformData[] {
    return Array.from(this.platforms.values());
  }

  public getStepY(stepNumber: number): number {
    return this.config.groundY - stepNumber * this.config.platformSpacingY;
  }

  public buildTower(): void {
    this.createTextures();
    this.createTowerBackgroundAndWalls();
    this.createGroundPlatform();
    this.createAllStepPlatforms();
    this.createSectionBarrier();
  }

  private createTextures(): void {
    // 1. Regular platform texture
    if (!this.scene.textures.exists('tex-regular-platform')) {
      const w = this.config.regularPlatformWidth;
      const h = this.config.platformHeight;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      g.fillStyle(0x334155, 1);
      g.fillRoundedRect(0, 4, w, h - 4, 8);

      g.fillStyle(0x64748b, 1);
      g.fillRoundedRect(2, 4, w - 4, h - 8, 6);

      g.fillStyle(0x38bdf8, 1);
      g.fillRoundedRect(0, 0, w, 9, 5);

      g.fillStyle(0xbae6fd, 1);
      g.fillRect(8, 2, w - 16, 3);

      g.generateTexture('tex-regular-platform', w, h);
      g.destroy();
    }

    // 2. Checkpoint platform texture (Steps 5, 10, 15, 20, 25)
    if (!this.scene.textures.exists('tex-checkpoint-platform')) {
      const w = this.config.checkpointPlatformWidth;
      const h = this.config.platformHeight + 4;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      g.fillStyle(0x92400e, 1);
      g.fillRoundedRect(0, 5, w, h - 5, 6);

      g.fillStyle(0xd97706, 1);
      g.fillRoundedRect(2, 4, w - 4, h - 8, 5);

      g.fillStyle(0xfbbf24, 1);
      g.fillRoundedRect(0, 0, w, 10, 4);

      g.fillStyle(0xfef08a, 1);
      for (let x = 16; x < w - 24; x += 40) {
        g.fillRect(x, 2, 20, 4);
      }

      g.generateTexture('tex-checkpoint-platform', w, h);
      g.destroy();
    }

    // 3. Finish Line platform texture (Step 30) with checkered racing banner trim
    if (!this.scene.textures.exists('tex-summit-platform')) {
      const w = this.config.checkpointPlatformWidth;
      const h = this.config.platformHeight + 8;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      g.fillStyle(0x065f46, 1);
      g.fillRoundedRect(0, 6, w, h - 6, 8);

      g.fillStyle(0x10b981, 1);
      g.fillRoundedRect(2, 4, w - 4, h - 8, 6);

      // Checkered black/white finish line top strip
      const squareW = 16;
      for (let x = 0; x < w; x += squareW) {
        const isWhite = Math.floor(x / squareW) % 2 === 0;
        g.fillStyle(isWhite ? 0xffffff : 0x0f172a, 1);
        g.fillRect(x, 0, squareW, 6);
        g.fillStyle(isWhite ? 0x0f172a : 0xffffff, 1);
        g.fillRect(x, 6, squareW, 6);
      }

      g.generateTexture('tex-summit-platform', w, h);
      g.destroy();
    }

    // 4. Ground base texture
    if (!this.scene.textures.exists('tex-ground-platform')) {
      const w = this.config.checkpointPlatformWidth;
      const h = 44;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      g.fillStyle(0x1e293b, 1);
      g.fillRect(0, 8, w, h - 8);

      g.fillStyle(0x334155, 1);
      for (let x = 8; x < w - 40; x += 56) {
        g.fillRoundedRect(x, 14, 48, 22, 4);
      }

      g.fillStyle(0x22c55e, 1);
      g.fillRect(0, 0, w, 10);

      g.fillStyle(0x86efac, 1);
      g.fillRect(0, 2, w, 3);

      g.generateTexture('tex-ground-platform', w, h);
      g.destroy();
    }

    // 5. Invisible/Laser barrier texture
    if (!this.scene.textures.exists('tex-barrier')) {
      const w = this.config.checkpointPlatformWidth;
      const h = 16;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xf43f5e, 0.35);
      g.fillRect(0, 0, w, h);
      g.generateTexture('tex-barrier', w, h);
      g.destroy();
    }
  }

  private createTowerBackgroundAndWalls(): void {
    const { towerWidth, worldHeight, wallThickness, groundY } = this.config;

    const bg = this.scene.add.graphics();
    bg.fillGradientStyle(0x0f172a, 0x0f172a, 0x1e1b4b, 0x312e81, 1);
    bg.fillRect(0, 0, towerWidth, worldHeight);
    bg.setDepth(-20);

    const deco = this.scene.add.graphics();
    deco.setDepth(-15);

    for (let y = groundY; y > 150; y -= 180) {
      deco.fillStyle(0xffffff, 0.03);
      deco.fillRoundedRect(wallThickness + 45, y - 100, 90, 42, 6);
      deco.fillRoundedRect(towerWidth - wallThickness - 135, y - 30, 90, 42, 6);

      if (Math.abs(groundY - y) % 540 === 0 && y < groundY - 100) {
        const winX = towerWidth / 2;
        deco.fillStyle(0x020617, 0.65);
        deco.fillRoundedRect(winX - 36, y - 80, 72, 110, 36);
        deco.lineStyle(3, 0x475569, 0.6);
        deco.strokeRoundedRect(winX - 36, y - 80, 72, 110, 36);

        deco.fillStyle(0xfef08a, 0.5);
        deco.fillCircle(winX - 12, y - 45, 2.5);
        deco.fillCircle(winX + 14, y - 20, 2);
      }
    }

    const wallGraphics = this.scene.add.graphics();
    wallGraphics.setDepth(15);

    // Left Wall
    wallGraphics.fillStyle(0x1e293b, 1);
    wallGraphics.fillRect(0, 0, wallThickness, worldHeight);
    wallGraphics.fillStyle(0x334155, 1);
    for (let y = 0; y < worldHeight; y += 48) {
      wallGraphics.fillRoundedRect(4, y + 4, wallThickness - 10, 40, 4);
    }
    wallGraphics.fillStyle(0x475569, 1);
    wallGraphics.fillRect(wallThickness - 4, 0, 4, worldHeight);

    // Right Wall
    const rightX = towerWidth - wallThickness;
    wallGraphics.fillStyle(0x1e293b, 1);
    wallGraphics.fillRect(rightX, 0, wallThickness, worldHeight);
    wallGraphics.fillStyle(0x334155, 1);
    for (let y = 0; y < worldHeight; y += 48) {
      wallGraphics.fillRoundedRect(
        rightX + 6,
        y + 4,
        wallThickness - 10,
        40,
        4
      );
    }
    wallGraphics.fillStyle(0x475569, 1);
    wallGraphics.fillRect(rightX, 0, 4, worldHeight);
  }

  private createGroundPlatform(): void {
    const centerX = this.config.towerWidth / 2;
    const groundY = this.config.groundY;

    const ground = this.staticGroup.create(
      centerX,
      groundY + 12,
      'tex-ground-platform'
    ) as Phaser.Physics.Arcade.Sprite;
    ground.setDepth(5);
    ground.refreshBody();

    this.scene.add
      .text(centerX, groundY + 12, 'TOWER BASE — STEP 0', {
        fontFamily: '"Fredoka", sans-serif',
        fontSize: '17px',
        color: '#e2e8f0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(6);
  }

  private createAllStepPlatforms(): void {
    const {
      totalSteps,
      stepsPerCheckpoint,
      towerWidth,
      regularPlatformWidth,
      checkpointPlatformWidth,
      platformHeight,
    } = this.config;

    const centerX = towerWidth / 2;

    const sectionOffsets = [
      [-140, 20, 155, -25], // Section 1 (Steps 1-4)
      [140, -20, -155, 25], // Section 2 (Steps 6-9)
      [-130, 35, -110, 85], // Section 3 (Steps 11-14)
      [130, -35, 110, -85], // Section 4 (Steps 16-19)
      [-145, 10, 150, -15], // Section 5 (Steps 21-24)
      [145, -10, -150, 15], // Section 6 (Steps 26-29)
    ];

    for (let step = 1; step <= totalSteps; step++) {
      const isSummit = step === totalSteps;
      // Step 30 is the Finish Line, NOT a question checkpoint!
      const isCheckpoint = !isSummit && step % stepsPerCheckpoint === 0;
      const checkpointNumber = isCheckpoint ? step / stepsPerCheckpoint : null;
      const sectionIndex = Math.ceil(step / stepsPerCheckpoint);
      const stepInSection = (step - 1) % stepsPerCheckpoint;

      const y = this.getStepY(step);
      let x = centerX;

      if (!isCheckpoint && !isSummit) {
        const offsets =
          sectionOffsets[(sectionIndex - 1) % sectionOffsets.length];
        x = centerX + offsets[stepInSection];
      }

      const width =
        isCheckpoint || isSummit
          ? checkpointPlatformWidth
          : regularPlatformWidth;
      const height =
        isCheckpoint || isSummit ? platformHeight + 4 : platformHeight;
      const textureKey = isSummit
        ? 'tex-summit-platform'
        : isCheckpoint
          ? 'tex-checkpoint-platform'
          : 'tex-regular-platform';

      const sprite = this.staticGroup.create(
        x,
        y,
        textureKey
      ) as Phaser.Physics.Arcade.Sprite;
      sprite.setDepth(5);
      sprite.refreshBody();

      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.up = true;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;

      const decorations: Phaser.GameObjects.GameObject[] = [];

      const stepBadge = this.scene.add
        .text(
          isCheckpoint || isSummit ? this.config.wallThickness + 58 : x,
          y - 1,
          isSummit
            ? '🏁 STEP 30 — FINISH LINE 🏁'
            : isCheckpoint
              ? `CHECKPOINT ${checkpointNumber} • STEP ${step}`
              : `${step}`,
          {
            fontFamily: '"Fredoka", sans-serif',
            fontSize: isCheckpoint || isSummit ? '16px' : '15px',
            color: isSummit ? '#064e3b' : isCheckpoint ? '#451a03' : '#0f172a',
            backgroundColor: isSummit
              ? '#6ee7b7'
              : isCheckpoint
                ? '#fde047'
                : '#e0f2fe',
            padding: { x: 8, y: 2 },
            fontStyle: 'bold',
          }
        )
        .setOrigin(isCheckpoint || isSummit ? 0 : 0.5, 0.5)
        .setDepth(6);
      decorations.push(stepBadge);

      if (isCheckpoint && checkpointNumber !== null) {
        const flagX = this.config.towerWidth - this.config.wallThickness - 68;
        const pole = this.scene.add
          .rectangle(flagX, y - 34, 5, 52, 0xe2e8f0)
          .setDepth(4);
        const pennant = this.scene.add
          .polygon(flagX + 22, y - 46, [0, 0, 40, 11, 0, 22], 0xf59e0b, 1)
          .setDepth(4);

        const cpSign = this.scene.add
          .text(flagX - 8, y - 46, `🚩 CP ${checkpointNumber}`, {
            fontFamily: '"Fredoka", sans-serif',
            fontSize: '16px',
            color: '#fef08a',
            backgroundColor: '#1e293b',
            padding: { x: 8, y: 4 },
            fontStyle: 'bold',
          })
          .setOrigin(1, 0.5)
          .setDepth(6);

        decorations.push(pole, pennant, cpSign);
      }

      if (isSummit) {
        const flagX = this.config.towerWidth - this.config.wallThickness - 68;
        const pole = this.scene.add
          .rectangle(flagX, y - 34, 5, 52, 0xe2e8f0)
          .setDepth(4);
        const pennant = this.scene.add
          .polygon(flagX + 22, y - 46, [0, 0, 40, 11, 0, 22], 0x10b981, 1)
          .setDepth(4);

        const finishSign = this.scene.add
          .text(flagX - 8, y - 46, '🏁 FINISH LINE', {
            fontFamily: '"Fredoka", sans-serif',
            fontSize: '16px',
            color: '#6ee7b7',
            backgroundColor: '#064e3b',
            padding: { x: 9, y: 4 },
            fontStyle: 'bold',
          })
          .setOrigin(1, 0.5)
          .setDepth(6);

        const archGlow = this.scene.add
          .circle(centerX, y - 58, 38, 0x10b981, 0.25)
          .setDepth(3);
        const trophyText = this.scene.add
          .text(centerX, y - 58, '🏆', {
            fontSize: '40px',
          })
          .setOrigin(0.5, 0.5)
          .setDepth(6);

        decorations.push(pole, pennant, finishSign, archGlow, trophyText);
      }

      const isInitiallyUnlocked = sectionIndex === 1;
      const platformData: PlatformData = {
        stepNumber: step,
        isCheckpoint,
        checkpointNumber,
        isSummit,
        sectionIndex,
        x,
        y,
        width,
        height,
        sprite,
        decorations,
        unlocked: isInitiallyUnlocked,
      };

      this.platforms.set(step, platformData);
      this.applyPlatformLockState(platformData, isInitiallyUnlocked, false);
    }
  }

  private createSectionBarrier(): void {
    const centerX = this.config.towerWidth / 2;
    const barrierY = this.getBarrierYForSection(1);

    this.ceilingBarrier = this.scene.physics.add.staticSprite(
      centerX,
      barrierY,
      'tex-barrier'
    );
    this.ceilingBarrier.setDepth(10);
    this.ceilingBarrier.refreshBody();

    this.ceilingGlow = this.scene.add
      .rectangle(
        centerX,
        barrierY,
        this.config.checkpointPlatformWidth,
        8,
        0xf43f5e,
        0.75
      )
      .setDepth(11);

    this.ceilingLabel = this.scene.add
      .text(centerX, barrierY - 18, '🔒 SOLVE CHECKPOINT 1 QUESTION TO UNLOCK', {
        fontFamily: '"Fredoka", sans-serif',
        fontSize: '16px',
        color: '#fecdd3',
        backgroundColor: '#881337',
        padding: { x: 12, y: 5 },
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(12);
  }

  private getBarrierYForSection(sectionIndex: number): number {
    const maxStepInSection = sectionIndex * this.config.stepsPerCheckpoint;
    const checkpointY = this.getStepY(maxStepInSection);
    return checkpointY - 102;
  }

  private applyPlatformLockState(
    platform: PlatformData,
    unlocked: boolean,
    animate: boolean
  ): void {
    platform.unlocked = unlocked;
    const body = platform.sprite.body as Phaser.Physics.Arcade.StaticBody;

    if (unlocked) {
      body.enable = true;
      platform.sprite.setVisible(true);
      platform.decorations.forEach((d: any) => {
        if (typeof d.setVisible === 'function') d.setVisible(true);
      });

      if (animate) {
        platform.sprite.setAlpha(0);
        platform.sprite.setScale(0.7, 0.7);
        this.scene.tweens.add({
          targets: platform.sprite,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 380,
          ease: 'Back.easeOut',
          onComplete: () => {
            platform.sprite.refreshBody();
          },
        });
        platform.decorations.forEach((d: any) => {
          if (typeof d.setAlpha === 'function') {
            d.setAlpha(0);
            this.scene.tweens.add({
              targets: d,
              alpha: 1,
              duration: 400,
            });
          }
        });
      } else {
        platform.sprite.setAlpha(1);
        platform.sprite.setScale(1, 1);
        platform.sprite.refreshBody();
      }
    } else {
      body.enable = false;
      platform.sprite.setVisible(false);
      platform.decorations.forEach((d: any) => {
        if (typeof d.setVisible === 'function') d.setVisible(false);
      });
    }
  }

  public unlockSection(sectionIndex: number): void {
    if (sectionIndex <= this.unlockedSection) return;
    this.unlockedSection = sectionIndex;

    this.platforms.forEach((platform) => {
      if (platform.sectionIndex === sectionIndex) {
        this.applyPlatformLockState(platform, true, true);
      }
    });

    // Move or hide ceiling barrier
    const totalSections = Math.ceil(
      this.config.totalSteps / this.config.stepsPerCheckpoint
    );
    if (sectionIndex <= totalSections) {
      const newBarrierY = this.getBarrierYForSection(sectionIndex);
      this.ceilingBarrier.setY(newBarrierY);
      this.ceilingBarrier.refreshBody();
      this.ceilingGlow.setY(newBarrierY);
      this.ceilingLabel.setY(newBarrierY - 16);

      if (sectionIndex <= this.config.numberOfCheckpoints) {
        this.ceilingLabel.setText(
          `🔒 SOLVE CHECKPOINT ${sectionIndex} QUESTION TO UNLOCK`
        );
      } else {
        // Section 6 (Steps 26–30) leads directly to the Finish Line at Step 30!
        this.ceilingGlow.setFillStyle(0x10b981, 0.65);
        this.ceilingLabel.setBackgroundColor('#064e3b');
        this.ceilingLabel.setColor('#6ee7b7');
        this.ceilingLabel.setText('🏁 REACH STEP 30 FOR FINISH LINE VICTORY!');
      }
    }
  }

  public resetSections(): void {
    this.unlockedSection = 1;
    this.platforms.forEach((platform) => {
      const unlocked = platform.sectionIndex === 1;
      this.applyPlatformLockState(platform, unlocked, false);
    });

    const barrierY = this.getBarrierYForSection(1);
    this.ceilingBarrier.setY(barrierY);
    this.ceilingBarrier.refreshBody();
    this.ceilingGlow.setY(barrierY);
    this.ceilingGlow.setFillStyle(0xf43f5e, 0.75);
    this.ceilingLabel.setY(barrierY - 16);
    this.ceilingLabel.setBackgroundColor('#881337');
    this.ceilingLabel.setColor('#fecdd3');
    this.ceilingLabel.setText('🔒 SOLVE CHECKPOINT 1 QUESTION TO UNLOCK');
  }
}
