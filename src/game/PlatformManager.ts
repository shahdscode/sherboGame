import Phaser from 'phaser';
import { TowerConfigRuntime } from '../data/towerConfig';
import { WavingFlag } from './WavingFlag';

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

interface BackgroundCloud {
  container: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  speed: number;
  width: number;
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
  private wavingFlags: WavingFlag[] = [];
  private clouds: BackgroundCloud[] = [];

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
    this.wavingFlags.forEach((flag) => flag.destroy());
    this.wavingFlags = [];
    this.clouds.forEach((cloud) => cloud.container.destroy());
    this.clouds = [];
    this.createTextures();
    this.createTowerBackgroundAndWalls();
    this.createGroundPlatform();
    this.createAllStepPlatforms();
    this.createSectionBarrier();
  }

  private createTextures(): void {
    const s = TEX_SCALE;

    // 1. Regular platform texture (2x super-sampled with white stone body + Sherbeni Orange top runner)
    if (!this.scene.textures.exists('tex-regular-platform')) {
      const w = this.config.regularPlatformWidth * s;
      const h = this.config.platformHeight * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      // Deep Navy shadow base
      g.fillStyle(0x0f1830, 1);
      g.fillRoundedRect(0, 4 * s, w, h - 4 * s, 9 * s);

      // Deep Navy stone body (matching slide navy brand color)
      g.fillStyle(0x1b2a53, 1);
      g.fillRoundedRect(1 * s, 3 * s, w - 2 * s, h - 5 * s, 8 * s);

      // Inner lighter navy bevel for crisp 3D depth
      g.fillStyle(0x273b70, 1);
      g.fillRoundedRect(3 * s, 4 * s, w - 6 * s, h - 9 * s, 6 * s);

      // Vibrant Sherbeni Orange top energy strip
      g.fillStyle(0xd96828, 1);
      g.fillRoundedRect(0, 0, w, 10 * s, 6 * s);

      g.fillStyle(0xee7b3c, 1);
      g.fillRoundedRect(2 * s, 1 * s, w - 4 * s, 7 * s, 5 * s);

      // Specular highlight
      g.fillStyle(0xffedd5, 0.95);
      g.fillRoundedRect(10 * s, 2 * s, w - 20 * s, 2.5 * s, 1.5 * s);

      g.generateTexture('tex-regular-platform', w, h);
      g.destroy();
    }

    // 2. Checkpoint platform texture (Steps 5, 10, 15, 20, 25 — Deep Navy & Sherbeni Orange rune gate)
    if (!this.scene.textures.exists('tex-checkpoint-platform')) {
      const w = this.config.checkpointPlatformWidth * s;
      const h = (this.config.platformHeight + 4) * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      g.fillStyle(0x0f1830, 1);
      g.fillRoundedRect(0, 5 * s, w, h - 5 * s, 7 * s);

      g.fillStyle(0x1b2a53, 1);
      g.fillRoundedRect(2 * s, 4 * s, w - 4 * s, h - 7 * s, 6 * s);

      g.fillStyle(0xee7b3c, 1);
      g.fillRoundedRect(0, 0, w, 11 * s, 5 * s);

      g.fillStyle(0xfef08a, 0.95);
      for (let x = 16 * s; x < w - 24 * s; x += 36 * s) {
        g.fillRoundedRect(x, 2.5 * s, 18 * s, 3.5 * s, 2 * s);
      }

      g.generateTexture('tex-checkpoint-platform', w, h);
      g.destroy();
    }

    // 3. Finish Line platform texture (Step 30) with Deep Navy and White checkered trim
    if (!this.scene.textures.exists('tex-summit-platform')) {
      const w = this.config.checkpointPlatformWidth * s;
      const h = (this.config.platformHeight + 8) * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      g.fillStyle(0x0f1830, 1);
      g.fillRoundedRect(0, 6 * s, w, h - 6 * s, 8 * s);

      g.fillStyle(0x1b2a53, 1);
      g.fillRoundedRect(2 * s, 4 * s, w - 4 * s, h - 8 * s, 6 * s);

      const squareW = 16 * s;
      for (let x = 0; x < w; x += squareW) {
        const isWhite = Math.floor(x / squareW) % 2 === 0;
        g.fillStyle(isWhite ? 0xffffff : 0x1b2a53, 1);
        g.fillRect(x, 0, squareW, 6 * s);
        g.fillStyle(isWhite ? 0x1b2a53 : 0xffffff, 1);
        g.fillRect(x, 6 * s, squareW, 6 * s);
      }

      g.generateTexture('tex-summit-platform', w, h);
      g.destroy();
    }

    // 4. Ground base texture (Deep Navy with Sherbeni Orange top runner)
    if (!this.scene.textures.exists('tex-ground-platform')) {
      const w = this.config.checkpointPlatformWidth * s;
      const h = 44 * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);

      g.fillStyle(0x0f1830, 1);
      g.fillRect(0, 8 * s, w, h - 8 * s);

      g.fillStyle(0x1b2a53, 1);
      for (let x = 8 * s; x < w - 40 * s; x += 56 * s) {
        g.fillRoundedRect(x, 14 * s, 48 * s, 22 * s, 5 * s);
      }

      g.fillStyle(0xee7b3c, 1);
      g.fillRect(0, 0, w, 10 * s);

      g.fillStyle(0xfbd5b5, 1);
      g.fillRect(0, 2 * s, w, 3 * s);

      g.generateTexture('tex-ground-platform', w, h);
      g.destroy();
    }

    // 5. Laser barrier texture (Sherbeni Orange energy)
    if (!this.scene.textures.exists('tex-barrier')) {
      const w = this.config.checkpointPlatformWidth * s;
      const h = 16 * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xee7b3c, 0.4);
      g.fillRect(0, 0, w, h);
      g.generateTexture('tex-barrier', w, h);
      g.destroy();
    }

    // 6. Soft circular particle texture for jump/land dust and gate sparkles
    if (!this.scene.textures.exists('tex-particle-dot')) {
      const r = 12 * s;
      const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xfff5ea, 1);
      g.fillCircle(r, r, r);
      g.generateTexture('tex-particle-dot', r * 2, r * 2);
      g.destroy();
    }
  }

  private createTowerBackgroundAndWalls(): void {
    const { towerWidth, worldHeight, wallThickness, groundY } = this.config;

    // 1. Full-World Multi-Altitude Sky Gradient (Option 1: Ascending Altitude)
    const outerBg = this.scene.add.graphics();
    outerBg.setDepth(-30);

    const fullW = towerWidth + 1800;
    const startX = -900;

    // 4 Seamless Vertical Gradient Bands across the 3800px tower ascent
    // Band 1: Summit Starry Midnight Navy (y = 0 -> 1100, Steps 22-30)
    outerBg.fillGradientStyle(0x0a1226, 0x0a1226, 0x1b2a53, 0x1b2a53, 1);
    outerBg.fillRect(startX, 0, fullW, 1100);

    // Band 2: Sunset Twilight / Crimson Amber (y = 1100 -> 1950, Steps 15-22)
    outerBg.fillGradientStyle(0x1b2a53, 0x1b2a53, 0xb84b2c, 0xb84b2c, 1);
    outerBg.fillRect(startX, 1100, fullW, 850);

    // Band 3: Golden Hour Amber Glow (y = 1950 -> 2800, Steps 8-15)
    outerBg.fillGradientStyle(0xb84b2c, 0xb84b2c, 0xf5cca5, 0xf5cca5, 1);
    outerBg.fillRect(startX, 1950, fullW, 850);

    // Band 4: Morning Dawn Base (y = 2800 -> 3800, Steps 1-8)
    outerBg.fillGradientStyle(0xf5cca5, 0xf5cca5, 0xf8e7d6, 0xf8e7d6, 1);
    outerBg.fillRect(startX, 2800, fullW, worldHeight - 2800);

    // 2. Celestial Layer at Summit (Stars, Constellations & Crescent Moon)
    const celestial = this.scene.add.graphics();
    celestial.setDepth(-28);

    // Scattered glittering stars in the summit night sky (y < 1280)
    for (let i = 0; i < 75; i++) {
      const sx = ((i * 47 + Math.sin(i * 73) * 280) % (towerWidth - 40)) + 20;
      const sy = 40 + (i * 21) % 1180;
      const r = i % 4 === 0 ? 2.2 : (i % 2 === 0 ? 1.4 : 1.0);
      const alpha = 0.55 + ((i % 5) * 0.09);
      celestial.fillStyle(i % 3 === 0 ? 0xfef08a : 0xffffff, alpha);
      celestial.fillCircle(sx, sy, r);
    }

    // Sequence Constellation Lines (Geometric progression ratios)
    celestial.lineStyle(1, 0xee7b3c, 0.4);
    const constPts = [
      { x: 140, y: 320 },
      { x: 210, y: 260 },
      { x: 310, y: 280 },
      { x: 420, y: 210 },
      { x: 530, y: 240 },
    ];
    celestial.strokePoints(constPts, false);
    for (const pt of constPts) {
      celestial.fillStyle(0xfef08a, 0.95);
      celestial.fillCircle(pt.x, pt.y, 3);
      celestial.fillStyle(0xee7b3c, 0.35);
      celestial.fillCircle(pt.x, pt.y, 7);
    }

    // Radiant Crescent Moon at Summit (y = 190)
    const moonX = towerWidth - wallThickness - 100;
    const moonY = 190;
    celestial.fillStyle(0xee7b3c, 0.25);
    celestial.fillCircle(moonX, moonY, 32);
    celestial.fillStyle(0xfef08a, 0.95);
    celestial.fillCircle(moonX, moonY, 20);
    celestial.fillStyle(0x0c1529, 1);
    celestial.fillCircle(moonX - 7, moonY - 4, 18);

    // 3. Animated Drifting Geometric Clouds
    // 14 clouds positioned across various altitudes
    const cloudConfigs = [
      // Base / Dawn clouds (warm white & peach)
      { y: 3520, w: 140, h: 42, speed: 18, color: 0xffffff, alpha: 0.55 },
      { y: 3340, w: 110, h: 36, speed: 14, color: 0xfbeee0, alpha: 0.50 },
      { y: 3120, w: 160, h: 46, speed: 20, color: 0xffffff, alpha: 0.48 },
      { y: 2900, w: 125, h: 38, speed: 16, color: 0xfbeee0, alpha: 0.52 },
      // Golden Hour clouds (amber / gold tint)
      { y: 2650, w: 150, h: 44, speed: 22, color: 0xfef08a, alpha: 0.45 },
      { y: 2420, w: 120, h: 36, speed: 17, color: 0xffe8d6, alpha: 0.48 },
      { y: 2200, w: 170, h: 48, speed: 24, color: 0xfef08a, alpha: 0.40 },
      { y: 1980, w: 130, h: 40, speed: 19, color: 0xffe8d6, alpha: 0.42 },
      // Sunset / Twilight clouds
      { y: 1740, w: 160, h: 44, speed: 23, color: 0xfbd5b5, alpha: 0.38 },
      { y: 1500, w: 120, h: 36, speed: 18, color: 0xf5cca5, alpha: 0.35 },
      // Summit night mist clouds
      { y: 1240, w: 150, h: 38, speed: 20, color: 0xffffff, alpha: 0.18 },
      { y: 980, w: 130, h: 34, speed: 16, color: 0xffffff, alpha: 0.16 },
      { y: 720, w: 160, h: 40, speed: 22, color: 0xffffff, alpha: 0.15 },
      { y: 440, w: 140, h: 36, speed: 18, color: 0xffffff, alpha: 0.14 },
    ];

    for (let i = 0; i < cloudConfigs.length; i++) {
      const cc = cloudConfigs[i];
      const startCloudX = ((i * 190) % (towerWidth + 240)) - 120;
      const cg = this.scene.add.graphics();
      cg.setDepth(-25);

      // Draw stylized multi-puff cloud shape
      cg.fillStyle(cc.color, cc.alpha);
      cg.fillRoundedRect(-cc.w / 2, -cc.h / 4, cc.w, cc.h / 2, cc.h / 4);
      cg.fillCircle(-cc.w * 0.22, -cc.h * 0.2, cc.h * 0.38);
      cg.fillCircle(cc.w * 0.08, -cc.h * 0.32, cc.h * 0.46);
      cg.fillCircle(cc.w * 0.28, -cc.h * 0.16, cc.h * 0.32);

      cg.setX(startCloudX);
      cg.setY(cc.y);

      this.clouds.push({
        container: cg,
        x: startCloudX,
        y: cc.y,
        speed: cc.speed,
        width: cc.w,
      });
    }

    // 4. Inner Tower Wall Backdrop & Architectural Wash
    const innerBg = this.scene.add.graphics();
    innerBg.setDepth(-22);

    // Inner tower architectural stone wash
    innerBg.fillStyle(0x1b2a53, 0.06);
    innerBg.fillRect(wallThickness, 0, towerWidth - wallThickness * 2, worldHeight);

    // Masonry stone bricks courses (NO bookshelves)
    innerBg.fillStyle(0x1b2a53, 0.04);
    for (let y = groundY; y > 150; y -= 160) {
      innerBg.fillRoundedRect(wallThickness + 40, y - 90, 88, 36, 5);
      innerBg.fillRoundedRect(towerWidth - wallThickness - 128, y - 40, 88, 36, 5);
      innerBg.fillRoundedRect(towerWidth / 2 - 44, y - 140, 88, 36, 5);
    }

    // 5. Grand Cathedral Windows (Option 2) with Stained Glass & Diagonal Sunbeams
    const winGraphics = this.scene.add.graphics();
    winGraphics.setDepth(-20);

    const windowYPositions = [3320, 2780, 2240, 1700, 1160, 620];
    const stainedPanes = [0x3f9f9b, 0xd8356c, 0xee7b3c, 0x7e57d8]; // Teal, Rose, Orange, Violet

    for (let i = 0; i < windowYPositions.length; i++) {
      const wy = windowYPositions[i];
      // Slightly alternate window center position for dynamic visual rhythm
      const wx = towerWidth / 2 + (i % 2 === 0 ? -24 : 24);
      const ww = 88;
      const wh = 136;
      const archR = 44;

      // Outer Deep Navy stone frame
      winGraphics.fillStyle(0x1b2a53, 0.95);
      winGraphics.fillCircle(wx, wy - wh / 2 + archR, archR + 6);
      winGraphics.fillRect(wx - ww / 2 - 6, wy - wh / 2 + archR, ww + 12, wh - archR + 6);

      // Sherbeni Orange decorative window casing
      winGraphics.lineStyle(3, 0xee7b3c, 0.85);
      winGraphics.strokeCircle(wx, wy - wh / 2 + archR, archR + 6);
      winGraphics.strokeRect(wx - ww / 2 - 6, wy - wh / 2 + archR, ww + 12, wh - archR + 6);

      // Window Interior Cutout (Sky shows through)
      const isNightWindow = wy <= 1500;
      winGraphics.fillStyle(isNightWindow ? 0x0c1529 : 0xf8e7d6, 0.92);
      winGraphics.fillCircle(wx, wy - wh / 2 + archR, archR);
      winGraphics.fillRect(wx - ww / 2, wy - wh / 2 + archR, ww, wh - archR);

      // 4 Stained Glass Accent Corner Panes (Sherbeni Slide Colors)
      const paneW = 16;
      const paneH = 22;
      winGraphics.fillStyle(stainedPanes[0], 0.85);
      winGraphics.fillRect(wx - ww / 2 + 4, wy - wh / 2 + archR + 4, paneW, paneH);
      winGraphics.fillStyle(stainedPanes[1], 0.85);
      winGraphics.fillRect(wx + ww / 2 - paneW - 4, wy - wh / 2 + archR + 4, paneW, paneH);
      winGraphics.fillStyle(stainedPanes[2], 0.85);
      winGraphics.fillRect(wx - ww / 2 + 4, wy + wh / 2 - paneH - 4, paneW, paneH);
      winGraphics.fillStyle(stainedPanes[3], 0.85);
      winGraphics.fillRect(wx + ww / 2 - paneW - 4, wy + wh / 2 - paneH - 4, paneW, paneH);

      // Gothic stone tracery crossbars
      winGraphics.lineStyle(2, 0x1b2a53, 0.85);
      winGraphics.lineBetween(wx, wy - wh / 2, wx, wy + wh / 2);
      winGraphics.lineBetween(wx - ww / 2, wy + 8, wx + ww / 2, wy + 8);
      winGraphics.lineBetween(wx - ww / 2 + 6, wy - 18, wx + ww / 2 - 6, wy - 18);

      if (isNightWindow) {
        // Glowing stars visible inside night window
        winGraphics.fillStyle(0xfef08a, 0.95);
        winGraphics.fillCircle(wx - 16, wy - 20, 2.5);
        winGraphics.fillCircle(wx + 18, wy - 12, 2.0);
        winGraphics.fillCircle(wx - 10, wy + 26, 1.8);
        winGraphics.fillStyle(0xee7b3c, 0.9);
        winGraphics.fillCircle(wx + 14, wy + 24, 2.2);
      } else {
        // Warm Diagonal Sunbeam streaming into the tower from daylight/golden windows
        winGraphics.fillStyle(0xee7b3c, 0.12);
        winGraphics.fillPoints(
          [
            { x: wx - ww / 2, y: wy - 10 },
            { x: wx + ww / 2, y: wy + 20 },
            { x: wx + ww / 2 + 180, y: wy + 260 },
            { x: wx - ww / 2 + 80, y: wy + 260 },
          ],
          true
        );
      }
    }

    // Grand Rose Window at Summit (y = 220)
    const roseX = towerWidth / 2;
    const roseY = 220;
    winGraphics.fillStyle(0x1b2a53, 0.95);
    winGraphics.fillCircle(roseX, roseY, 44);
    winGraphics.lineStyle(3, 0xee7b3c, 0.9);
    winGraphics.strokeCircle(roseX, roseY, 44);
    winGraphics.fillStyle(0x0c1529, 0.95);
    winGraphics.fillCircle(roseX, roseY, 38);
    // Radial spokes
    winGraphics.lineStyle(1.5, 0xee7b3c, 0.7);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      winGraphics.lineBetween(roseX, roseY, roseX + Math.cos(a) * 38, roseY + Math.sin(a) * 38);
    }
    winGraphics.fillStyle(0xfef08a, 0.95);
    winGraphics.fillCircle(roseX, roseY, 8);

    // 6. Glowing Sherbeni Orange Wall Sconces & Torches (NO bookshelves)
    const sconceG = this.scene.add.graphics();
    sconceG.setDepth(-15);

    for (let y = groundY; y > 150; y -= 320) {
      const leftX = wallThickness + 16;
      const rightX = towerWidth - wallThickness - 16;

      // Soft ambient light aura
      sconceG.fillStyle(0xee7b3c, 0.16);
      sconceG.fillCircle(leftX, y - 50, 24);
      sconceG.fillCircle(rightX, y - 50, 24);

      // Deep Navy bracket
      sconceG.fillStyle(0x1b2a53, 1);
      sconceG.fillRect(leftX - 4, y - 48, 8, 14);
      sconceG.fillRect(rightX - 4, y - 48, 8, 14);

      // Torch flame core
      sconceG.fillStyle(0xee7b3c, 0.95);
      sconceG.fillCircle(leftX, y - 54, 4.5);
      sconceG.fillCircle(rightX, y - 54, 4.5);
      sconceG.fillStyle(0xfef08a, 1);
      sconceG.fillCircle(leftX, y - 54, 2);
      sconceG.fillCircle(rightX, y - 54, 2);
    }

    const wallGraphics = this.scene.add.graphics();
    wallGraphics.setDepth(15);

    // Left Wall in Deep Navy with Orange inner edge
    wallGraphics.fillStyle(0x0f1830, 1);
    wallGraphics.fillRect(-4, 0, wallThickness + 4, worldHeight);
    wallGraphics.fillStyle(0x1b2a53, 1);
    wallGraphics.fillRect(0, 0, wallThickness, worldHeight);
    wallGraphics.fillStyle(0x273b70, 1);
    for (let y = 0; y < worldHeight; y += 48) {
      wallGraphics.fillRoundedRect(4, y + 4, wallThickness - 10, 40, 5);
    }
    wallGraphics.fillStyle(0xee7b3c, 1);
    wallGraphics.fillRect(wallThickness - 4, 0, 4, worldHeight);

    // Right Wall in Deep Navy with Orange inner edge
    const rightX = towerWidth - wallThickness;
    wallGraphics.fillStyle(0x0f1830, 1);
    wallGraphics.fillRect(rightX, 0, wallThickness + 4, worldHeight);
    wallGraphics.fillStyle(0x1b2a53, 1);
    wallGraphics.fillRect(rightX, 0, wallThickness, worldHeight);
    wallGraphics.fillStyle(0x273b70, 1);
    for (let y = 0; y < worldHeight; y += 48) {
      wallGraphics.fillRoundedRect(
        rightX + 6,
        y + 4,
        wallThickness - 10,
        40,
        5
      );
    }
    wallGraphics.fillStyle(0xee7b3c, 1);
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
        color: '#ffffff',
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
            color: '#ffffff',
            backgroundColor: isSummit
              ? '#1b2a53'
              : isCheckpoint
                ? '#ee7b3c'
                : '#1b2a53',
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
          .rectangle(flagX, y - 34, 5, 52, 0x1b2a53)
          .setDepth(4);

        const finial = this.scene.add
          .circle(flagX, y - 60, 4, 0xee7b3c)
          .setDepth(5);

        // Physically-simulated waving cloth pennant flag
        const flag = new WavingFlag({
          scene: this.scene,
          x: flagX + 2.5,
          y: y - 46,
          width: 44,
          height: 24,
          tipHeight: 5,
          baseColor: 0xee7b3c, // Sherbeni flame orange
          stripeColor: 0xffffff, // Crisp white center ribbon
          windSpeed: 1.0 + (checkpointNumber % 3) * 0.12,
          phaseOffset: checkpointNumber * 1.35,
          depth: 5,
          isSummit: false,
        });
        this.wavingFlags.push(flag);

        const cpSign = this.scene.add
          .text(flagX - 8, y - 46, `🔑 GATE ${checkpointNumber}`, {
            fontFamily: '"Fredoka", sans-serif',
            fontSize: '14px',
            color: '#ffffff',
            backgroundColor: '#1b2a53',
            padding: { x: 8, y: 3 },
            fontStyle: 'bold',
          })
          .setResolution(TEXT_RES)
          .setOrigin(1, 0.5)
          .setDepth(6);

        decorations.push(pole, finial, flag.getGameObject(), cpSign);
      }

      if (isSummit) {
        const flagX = this.config.towerWidth - this.config.wallThickness - 68;
        const pole = this.scene.add
          .rectangle(flagX, y - 34, 5, 52, 0x1b2a53)
          .setDepth(4);

        const finial = this.scene.add
          .circle(flagX, y - 60, 4.5, 0xee7b3c)
          .setDepth(5);

        // Physically-simulated summit waving banner
        const summitFlag = new WavingFlag({
          scene: this.scene,
          x: flagX + 2.5,
          y: y - 46,
          width: 50,
          height: 28,
          tipHeight: 18,
          baseColor: 0xee7b3c, // Sherbeni flame
          stripeColor: 0xfef08a, // Warm gold victory ribbon
          windSpeed: 1.25,
          phaseOffset: 2.1,
          depth: 5,
          isSummit: true,
        });
        this.wavingFlags.push(summitFlag);

        const finishSign = this.scene.add
          .text(flagX - 8, y - 46, '🏁 FINISH LINE', {
            fontFamily: '"Fredoka", sans-serif',
            fontSize: '14px',
            color: '#fef08a',
            backgroundColor: '#1b2a53',
            padding: { x: 9, y: 3 },
            fontStyle: 'bold',
          })
          .setResolution(TEXT_RES)
          .setOrigin(1, 0.5)
          .setDepth(6);

        const archGlow = this.scene.add
          .circle(centerX, y - 58, 38, 0xee7b3c, 0.25)
          .setDepth(3);
        const trophyText = this.scene.add
          .text(centerX, y - 58, '🏆', {
            fontSize: '38px',
          })
          .setResolution(TEXT_RES)
          .setOrigin(0.5, 0.5)
          .setDepth(6);

        decorations.push(
          pole,
          finial,
          summitFlag.getGameObject(),
          finishSign,
          archGlow,
          trophyText
        );
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
        0xee7b3c,
        0.85
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
        color: '#ffffff',
        backgroundColor: '#1b2a53',
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
        this.ceilingGlow.setFillStyle(0xee7b3c, 0.7);
        this.ceilingLabel.setBackgroundColor('#1b2a53');
        this.ceilingLabel.setColor('#ffffff');
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
    this.ceilingGlow.setFillStyle(0xee7b3c, 0.85);
    this.ceilingLabel.setY(barrierY - 16);
    this.ceilingLabel.setBackgroundColor('#1b2a53');
    this.ceilingLabel.setColor('#ffffff');
    this.ceilingLabel.setText('🔒 LAND ON GATE 1 PLATFORM BELOW TO UNLOCK');
  }

  public update(time: number, delta: number): void {
    // 1. Update physically-simulated waving flags
    for (let i = 0; i < this.wavingFlags.length; i++) {
      this.wavingFlags[i].update(time);
    }

    // 2. Update drifting clouds across the tower
    const dt = delta * 0.001;
    const minX = -140;
    const maxX = this.config.towerWidth + 140;
    const span = maxX - minX;

    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.x += c.speed * dt;
      if (c.x > maxX) {
        c.x -= span;
      }
      c.container.setX(c.x);
    }
  }
}
