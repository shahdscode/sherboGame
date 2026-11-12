import Phaser from 'phaser';
import { TowerConfigRuntime } from '../data/towerConfig';

/** Super-sampling factor for procedural textures so platforms stay razor-sharp when zoomed in. */
const TEX_SCALE = 2;
/** High-DPI resolution multiplier for Phaser in-world text labels. */
const TEXT_RES = 3;

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
    const s = TEX_SCALE;

    // 1. Regular platform texture (2x super-sampled with bevel + glowing crystal top)
    if (!this.scene.textures.exists('tex-regular-platform')) {
      const w = this.config.regularPlatformWidth * s;
      const h = this.config.platformHeight * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      // Deep shadow base
      g.fillStyle(0x0f172a, 0.95);
      g.fillRoundedRect(0, 4 * s, w, h - 4 * s, 9 * s);

      // Stone body
      g.fillStyle(0x334155, 1);
      g.fillRoundedRect(1 * s, 3 * s, w - 2 * s, h - 5 * s, 8 * s);

      // Inner lighter stone bevel
      g.fillStyle(0x475569, 1);
      g.fillRoundedRect(3 * s, 4 * s, w - 6 * s, h - 9 * s, 6 * s);

      // Glowing cyan top energy strip
      g.fillStyle(0x0ea5e9, 1);
      g.fillRoundedRect(0, 0, w, 10 * s, 6 * s);

      g.fillStyle(0x38bdf8, 1);
      g.fillRoundedRect(2 * s, 1 * s, w - 4 * s, 7 * s, 5 * s);

      // Specular highlight
      g.fillStyle(0xe0f2fe, 0.95);
      g.fillRoundedRect(10 * s, 2 * s, w - 20 * s, 2.5 * s, 1.5 * s);

      g.generateTexture('tex-regular-platform', w, h);
      g.destroy();
    }

    // 2. Checkpoint platform texture (Steps 5, 10, 15, 20, 25 — golden rune gate floor)
    if (!this.scene.textures.exists('tex-checkpoint-platform')) {
      const w = this.config.checkpointPlatformWidth * s;
      const h = (this.config.platformHeight + 4) * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      g.fillStyle(0x451a03, 1);
      g.fillRoundedRect(0, 5 * s, w, h - 5 * s, 7 * s);

      g.fillStyle(0xb45309, 1);
      g.fillRoundedRect(2 * s, 4 * s, w - 4 * s, h - 7 * s, 6 * s);

      g.fillStyle(0xf59e0b, 1);
      g.fillRoundedRect(0, 0, w, 11 * s, 5 * s);

      g.fillStyle(0xfef08a, 0.95);
      for (let x = 16 * s; x < w - 24 * s; x += 36 * s) {
        g.fillRoundedRect(x, 2.5 * s, 18 * s, 3.5 * s, 2 * s);
      }

      g.generateTexture('tex-checkpoint-platform', w, h);
      g.destroy();
    }

    // 3. Finish Line platform texture (Step 30) with crisp checkered racing trim
    if (!this.scene.textures.exists('tex-summit-platform')) {
      const w = this.config.checkpointPlatformWidth * s;
      const h = (this.config.platformHeight + 8) * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      g.fillStyle(0x064e3b, 1);
      g.fillRoundedRect(0, 6 * s, w, h - 6 * s, 8 * s);

      g.fillStyle(0x10b981, 1);
      g.fillRoundedRect(2 * s, 4 * s, w - 4 * s, h - 8 * s, 6 * s);

      const squareW = 16 * s;
      for (let x = 0; x < w; x += squareW) {
        const isWhite = Math.floor(x / squareW) % 2 === 0;
        g.fillStyle(isWhite ? 0xffffff : 0x0f172a, 1);
        g.fillRect(x, 0, squareW, 6 * s);
        g.fillStyle(isWhite ? 0x0f172a : 0xffffff, 1);
        g.fillRect(x, 6 * s, squareW, 6 * s);
      }

      g.generateTexture('tex-summit-platform', w, h);
      g.destroy();
    }

    // 4. Ground base texture
    if (!this.scene.textures.exists('tex-ground-platform')) {
      const w = this.config.checkpointPlatformWidth * s;
      const h = 44 * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      g.fillStyle(0x1e293b, 1);
      g.fillRect(0, 8 * s, w, h - 8 * s);

      g.fillStyle(0x334155, 1);
      for (let x = 8 * s; x < w - 40 * s; x += 56 * s) {
        g.fillRoundedRect(x, 14 * s, 48 * s, 22 * s, 5 * s);
      }

      g.fillStyle(0x10b981, 1);
      g.fillRect(0, 0, w, 10 * s);

      g.fillStyle(0x6ee7b7, 1);
      g.fillRect(0, 2 * s, w, 3 * s);

      g.generateTexture('tex-ground-platform', w, h);
      g.destroy();
    }

    // 5. Laser barrier texture
    if (!this.scene.textures.exists('tex-barrier')) {
      const w = this.config.checkpointPlatformWidth * s;
      const h = 16 * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xf43f5e, 0.35);
      g.fillRect(0, 0, w, h);
      g.generateTexture('tex-barrier', w, h);
      g.destroy();
    }

    // 6. Soft circular particle texture for jump/land dust and gate sparkles
    if (!this.scene.textures.exists('tex-particle-dot')) {
      const r = 12 * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(r, r, r);
      g.generateTexture('tex-particle-dot', r * 2, r * 2);
      g.destroy();
    }
  }

  private createTowerBackgroundAndWalls(): void {
    const { towerWidth, worldHeight, wallThickness, groundY } = this.config;

    // Outer ambient night sky for wide desktop viewports
    const outerBg = this.scene.add.graphics();
    outerBg.fillGradientStyle(0x050814, 0x050814, 0x0f172a, 0x1e1b4b, 1);
    outerBg.fillRect(-900, 0, towerWidth + 1800, worldHeight);
    outerBg.setDepth(-25);

    // Inner tower gradient backdrop
    const bg = this.scene.add.graphics();
    bg.fillGradientStyle(0x0b132b, 0x0b132b, 0x1e1b4b, 0x312e81, 1);
    bg.fillRect(0, 0, towerWidth, worldHeight);
    bg.setDepth(-20);

    // Subtle vertical light shafts inside tower
    const deco = this.scene.add.graphics();
    deco.setDepth(-15);
    deco.fillStyle(0x38bdf8, 0.025);
    deco.fillRect(towerWidth * 0.25, 0, 70, worldHeight);
    deco.fillRect(towerWidth * 0.62, 0, 50, worldHeight);

    for (let y = groundY; y > 150; y -= 180) {
      // Carved stone bricks
      deco.fillStyle(0xffffff, 0.035);
      deco.fillRoundedRect(wallThickness + 45, y - 100, 92, 40, 6);
      deco.fillRoundedRect(towerWidth - wallThickness - 137, y - 30, 92, 40, 6);

      // Arched castle windows with twinkling stars
      if (Math.abs(groundY - y) % 540 === 0 && y < groundY - 100) {
        const winX = towerWidth / 2;
        deco.fillStyle(0x020617, 0.72);
        deco.fillRoundedRect(winX - 40, y - 84, 80, 118, 40);
        deco.lineStyle(3, 0x64748b, 0.55);
        deco.strokeRoundedRect(winX - 40, y - 84, 80, 118, 40);

        // Window crossbars
        deco.lineStyle(2, 0x334155, 0.5);
        deco.lineBetween(winX, y - 82, winX, y + 32);
        deco.lineBetween(winX - 38, y - 24, winX + 38, y - 24);

        // Stars inside window
        deco.fillStyle(0xfef08a, 0.75);
        deco.fillCircle(winX - 15, y - 48, 2.5);
        deco.fillCircle(winX + 16, y - 40, 2);
        deco.fillStyle(0x7dd3fc, 0.7);
        deco.fillCircle(winX + 12, y - 6, 2.2);
      }

      // Glowing wall crystal sconces every 360px
      if (Math.abs(groundY - y) % 360 === 0) {
        const leftSconceX = wallThickness + 16;
        const rightSconceX = towerWidth - wallThickness - 16;
        deco.fillStyle(0xf59e0b, 0.14);
        deco.fillCircle(leftSconceX, y - 60, 22);
        deco.fillCircle(rightSconceX, y - 60, 22);
        deco.fillStyle(0xfde047, 0.75);
        deco.fillCircle(leftSconceX, y - 60, 4.5);
        deco.fillCircle(rightSconceX, y - 60, 4.5);
      }
    }

    const wallGraphics = this.scene.add.graphics();
    wallGraphics.setDepth(15);

    // Left Wall
    wallGraphics.fillStyle(0x0f172a, 1);
    wallGraphics.fillRect(-4, 0, wallThickness + 4, worldHeight);
    wallGraphics.fillStyle(0x1e293b, 1);
    wallGraphics.fillRect(0, 0, wallThickness, worldHeight);
    wallGraphics.fillStyle(0x334155, 1);
    for (let y = 0; y < worldHeight; y += 48) {
      wallGraphics.fillRoundedRect(4, y + 4, wallThickness - 10, 40, 5);
    }
    wallGraphics.fillStyle(0x64748b, 1);
    wallGraphics.fillRect(wallThickness - 4, 0, 4, worldHeight);

    // Right Wall
    const rightX = towerWidth - wallThickness;
    wallGraphics.fillStyle(0x0f172a, 1);
    wallGraphics.fillRect(rightX, 0, wallThickness + 4, worldHeight);
    wallGraphics.fillStyle(0x1e293b, 1);
    wallGraphics.fillRect(rightX, 0, wallThickness, worldHeight);
    wallGraphics.fillStyle(0x334155, 1);
    for (let y = 0; y < worldHeight; y += 48) {
      wallGraphics.fillRoundedRect(
        rightX + 6,
        y + 4,
        wallThickness - 10,
        40,
        5
      );
    }
    wallGraphics.fillStyle(0x64748b, 1);
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
    ground.setScale(1 / TEX_SCALE);
    ground.setDepth(5);
    ground.refreshBody();

    this.scene.add
      .text(centerX, groundY + 13, '🏰 TOWER BASE — START CLIMBING!', {
        fontFamily: '"Fredoka", sans-serif',
        fontSize: '15px',
        color: '#e2e8f0',
        fontStyle: 'bold',
      })
      .setResolution(TEXT_RES)
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
      sprite.setScale(1 / TEX_SCALE);
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
            ? '🏁 STEP 30 — SUMMIT CROWN 🏁'
            : isCheckpoint
              ? `⚡ RUNE GATE ${checkpointNumber} • STEP ${step}`
              : `${step}`,
          {
            fontFamily: '"Fredoka", sans-serif',
            fontSize: isCheckpoint || isSummit ? '14px' : '13px',
            color: isSummit ? '#064e3b' : isCheckpoint ? '#451a03' : '#0f172a',
            backgroundColor: isSummit
              ? '#6ee7b7'
              : isCheckpoint
                ? '#fde047'
                : '#bae6fd',
            padding: { x: 8, y: 2 },
            fontStyle: 'bold',
          }
        )
        .setResolution(TEXT_RES)
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
          .text(flagX - 8, y - 46, `🔑 GATE ${checkpointNumber}`, {
            fontFamily: '"Fredoka", sans-serif',
            fontSize: '14px',
            color: '#fef08a',
            backgroundColor: '#1e293b',
            padding: { x: 8, y: 3 },
            fontStyle: 'bold',
          })
          .setResolution(TEXT_RES)
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
            fontSize: '14px',
            color: '#6ee7b7',
            backgroundColor: '#064e3b',
            padding: { x: 9, y: 3 },
            fontStyle: 'bold',
          })
          .setResolution(TEXT_RES)
          .setOrigin(1, 0.5)
          .setDepth(6);

        const archGlow = this.scene.add
          .circle(centerX, y - 58, 38, 0x10b981, 0.28)
          .setDepth(3);
        const trophyText = this.scene.add
          .text(centerX, y - 58, '🏆', {
            fontSize: '38px',
          })
          .setResolution(TEXT_RES)
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
    this.ceilingBarrier.setScale(1 / TEX_SCALE);
    this.ceilingBarrier.setDepth(10);
    this.ceilingBarrier.refreshBody();

    this.ceilingGlow = this.scene.add
      .rectangle(
        centerX,
        barrierY,
        this.config.checkpointPlatformWidth,
        8,
        0xf43f5e,
        0.8
      )
      .setDepth(11);

    this.scene.tweens.add({
      targets: this.ceilingGlow,
      alpha: { from: 0.45, to: 0.95 },
      scaleY: { from: 0.85, to: 1.35 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.ceilingLabel = this.scene.add
      .text(centerX, barrierY - 18, '🔒 LAND ON GATE 1 PLATFORM BELOW TO UNLOCK', {
        fontFamily: '"Fredoka", sans-serif',
        fontSize: '14px',
        color: '#fecdd3',
        backgroundColor: '#881337',
        padding: { x: 12, y: 4 },
        fontStyle: 'bold',
      })
      .setResolution(TEXT_RES)
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
    const baseScale = 1 / TEX_SCALE;

    if (unlocked) {
      body.enable = true;
      platform.sprite.setVisible(true);
      platform.decorations.forEach((d: any) => {
        if (typeof d.setVisible === 'function') d.setVisible(true);
      });

      if (animate) {
        platform.sprite.setAlpha(0);
        platform.sprite.setScale(baseScale * 0.7, baseScale * 0.7);
        this.scene.tweens.add({
          targets: platform.sprite,
          alpha: 1,
          scaleX: baseScale,
          scaleY: baseScale,
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
        platform.sprite.setScale(baseScale, baseScale);
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
          `🔒 LAND ON GATE ${sectionIndex} PLATFORM BELOW TO UNLOCK`
        );
      } else {
        this.ceilingGlow.setFillStyle(0x10b981, 0.7);
        this.ceilingLabel.setBackgroundColor('#064e3b');
        this.ceilingLabel.setColor('#6ee7b7');
        this.ceilingLabel.setText('🏁 REACH STEP 30 FOR SUMMIT VICTORY!');
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
    this.ceilingGlow.setFillStyle(0xf43f5e, 0.8);
    this.ceilingLabel.setY(barrierY - 16);
    this.ceilingLabel.setBackgroundColor('#881337');
    this.ceilingLabel.setColor('#fecdd3');
    this.ceilingLabel.setText('🔒 LAND ON GATE 1 PLATFORM BELOW TO UNLOCK');
  }
}
