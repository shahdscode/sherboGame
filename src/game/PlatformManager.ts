import Phaser from 'phaser';
import {
  TowerConfigRuntime,
  getStepInfo,
  getMaxStepForSection,
} from '../data/towerConfig';
import { WavingFlag } from './WavingFlag';
import { gameEvents } from './EventBus';
import { sfx } from './sfx';
import {
  SECTION_DESIGNS,
  coinsForStep,
  getStepKind,
  type PlatformKind,
} from './towerLayout';

export type { PlatformKind };

/** Super-sampling factor for procedural textures so platforms stay razor-sharp when zoomed in. */
const TEX_SCALE = 2;
/** High-DPI resolution multiplier for Phaser in-world text labels. */
const TEXT_RES = 2;


const KIND_TEXTURE: Record<PlatformKind, string> = {
  normal: 'tex-regular-platform',
  moving: 'tex-moving-platform',
  crumble: 'tex-crumble-platform',
  ice: 'tex-ice-platform',
  spring: 'tex-spring-platform',
};

interface CoinData {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  sectionIndex: number;
  collected: boolean;
  phase: number;
}

export interface PlatformData {
  kind: PlatformKind;
  /** Resting X (moving platforms oscillate around it). */
  baseX: number;
  moveAmp: number;
  moveSpeed: number;
  movePhase: number;
  /** Horizontal scale multiplier (narrower platforms higher up). */
  widthScale: number;
  crumbleDelay: number;
  /** 0 = solid, 1 = shaking (about to fall), 2 = fallen (waiting to grow back) */
  crumbleState: 0 | 1 | 2;
  crumbleTimer: number;
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
  container: Phaser.GameObjects.Image;
  /** Offset between the cloud's logical centre and the top-left of its baked image. */
  offsetX: number;
  x: number;
  y: number;
  speed: number;
  width: number;
}

interface CheckpointDoor {
  checkpointNumber: number;
  container: Phaser.GameObjects.Container;
  doorFrame: Phaser.GameObjects.Graphics;
  doorInterior: Phaser.GameObjects.Graphics;
  doorLeft: Phaser.GameObjects.Graphics;
  doorRight: Phaser.GameObjects.Graphics;
  lightRays: Phaser.GameObjects.Graphics;
  lockIcon: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Arc;
  lockY: number;
  isUnlocked: boolean;
}

export class PlatformManager {
  private scene: Phaser.Scene;
  private config: TowerConfigRuntime;
  private staticGroup: Phaser.Physics.Arcade.StaticGroup;
  private platforms: Map<number, PlatformData> = new Map();
  private movingPlatforms: PlatformData[] = [];
  private crumblePlatforms: PlatformData[] = [];
  private checkpointDoors: Map<number, CheckpointDoor> = new Map();
  private ceilingBarrier!: Phaser.Physics.Arcade.Sprite;
  private unlockedSection: number = 1;
  private wavingFlags: WavingFlag[] = [];
  /** Step number each waving flag stands on (parallel to wavingFlags) — used for off-screen culling. */
  private flagSteps: number[] = [];
  private spriteToPlatform: Map<Phaser.GameObjects.GameObject, PlatformData> = new Map();
  private clouds: BackgroundCloud[] = [];
  private coins: CoinData[] = [];
  private coinsCollected = 0;
  /** Clock for moving platforms — only advances while the game world is running. */
  private moveClock = 0;

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

  public getPlatformBySprite(
    sprite: Phaser.GameObjects.GameObject
  ): PlatformData | undefined {
    return this.spriteToPlatform.get(sprite);
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
    this.flagSteps = [];
    this.movingPlatforms = [];
    this.crumblePlatforms = [];
    this.spriteToPlatform.clear();
    this.clouds.forEach((cloud) => cloud.container.destroy());
    this.clouds = [];
    this.createTextures();
    this.createTowerBackgroundAndWalls();
    this.createGroundPlatform();
    this.createAllStepPlatforms();
    this.createCoins();
    this.createSideScenery();
    this.createSectionBarrier();
  }

  /** Regular-platform variants: same stone step, different "energy strip" + markings. */
  private createPlatformVariantTexture(
    key: string,
    colors: { base: number; body: number; bevel: number; stripDark: number; strip: number; shine: number },
    decorate?: (g: Phaser.GameObjects.Graphics, w: number, h: number, s: number) => void
  ): void {
    if (this.scene.textures.exists(key)) return;
    const s = TEX_SCALE;
    const w = this.config.regularPlatformWidth * s;
    const h = this.config.platformHeight * s;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(colors.base, 1);
    g.fillRoundedRect(0, 4 * s, w, h - 4 * s, 9 * s);
    g.fillStyle(colors.body, 1);
    g.fillRoundedRect(1 * s, 3 * s, w - 2 * s, h - 5 * s, 8 * s);
    g.fillStyle(colors.bevel, 1);
    g.fillRoundedRect(3 * s, 4 * s, w - 6 * s, h - 9 * s, 6 * s);
    g.fillStyle(colors.stripDark, 1);
    g.fillRoundedRect(0, 0, w, 10 * s, 6 * s);
    g.fillStyle(colors.strip, 1);
    g.fillRoundedRect(2 * s, 1 * s, w - 4 * s, 7 * s, 5 * s);
    g.fillStyle(colors.shine, 0.95);
    g.fillRoundedRect(10 * s, 2 * s, w - 20 * s, 2.5 * s, 1.5 * s);
    if (decorate) decorate(g, w, h, s);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private createGameplayTextures(): void {
    // Moving platform: cyan energy strip with direction arrows
    this.createPlatformVariantTexture(
      'tex-moving-platform',
      { base: 0x0f1830, body: 0x1b2a53, bevel: 0x273b70, stripDark: 0x0e7490, strip: 0x22d3ee, shine: 0xecfeff },
      (g, w, h, s) => {
        g.fillStyle(0x67e8f9, 1);
        const cy = h * 0.68;
        g.fillTriangle(14 * s, cy, 24 * s, cy - 5 * s, 24 * s, cy + 5 * s);
        g.fillTriangle(w - 14 * s, cy, w - 24 * s, cy - 5 * s, w - 24 * s, cy + 5 * s);
      }
    );

    // Crumbling platform: cracked sandstone
    this.createPlatformVariantTexture(
      'tex-crumble-platform',
      { base: 0x3b2413, body: 0x7c4a1e, bevel: 0x9a6233, stripDark: 0x92400e, strip: 0xd97706, shine: 0xfde68a },
      (g, w, h, s) => {
        g.lineStyle(1.6 * s, 0x2b1708, 0.95);
        for (let i = 1; i <= 4; i++) {
          const cx = (w / 5) * i;
          g.beginPath();
          g.moveTo(cx - 5 * s, 1 * s);
          g.lineTo(cx + 2 * s, 8 * s);
          g.lineTo(cx - 3 * s, 14 * s);
          g.lineTo(cx + 3 * s, h - 2 * s);
          g.strokePath();
        }
      }
    );

    // Ice platform: frosty and glossy
    this.createPlatformVariantTexture(
      'tex-ice-platform',
      { base: 0x1e3a8a, body: 0x60a5fa, bevel: 0x93c5fd, stripDark: 0x7dd3fc, strip: 0xe0f2fe, shine: 0xffffff },
      (g, w, h, s) => {
        g.fillStyle(0xffffff, 0.75);
        for (let x = 18 * s; x < w - 20 * s; x += 30 * s) {
          g.fillTriangle(x, h * 0.5, x + 9 * s, h * 0.5, x + 4 * s, h * 0.86);
        }
      }
    );

    // Spring platform: green launch pad with up-chevrons
    this.createPlatformVariantTexture(
      'tex-spring-platform',
      { base: 0x052e16, body: 0x166534, bevel: 0x15803d, stripDark: 0x15803d, strip: 0x4ade80, shine: 0xf0fdf4 },
      (g, w, h, s) => {
        g.lineStyle(2.4 * s, 0xbbf7d0, 1);
        for (const cx of [w * 0.3, w * 0.5, w * 0.7]) {
          g.beginPath();
          g.moveTo(cx - 7 * s, h * 0.86);
          g.lineTo(cx, h * 0.56);
          g.lineTo(cx + 7 * s, h * 0.86);
          g.strokePath();
        }
      }
    );

    // Coin
    this.bake('tex-coin', 0, 0, 30, 30, (g) => {
      g.fillStyle(0xb45309, 1);
      g.fillCircle(15, 16, 13);
      g.fillStyle(0xfbbf24, 1);
      g.fillCircle(15, 14.5, 13);
      g.fillStyle(0xfde68a, 1);
      g.fillCircle(15, 14.5, 9.5);
      g.fillStyle(0xf59e0b, 1);
      g.fillRoundedRect(13, 9, 4, 11, 1.5);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(10, 9.5, 2.2);
    });

    // Distant tower silhouette for the parallax scenery beside the main tower
    this.bake('tex-far-tower', 0, 0, 120, 420, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(18, 60, 84, 360);
      for (let i = 0; i < 4; i++) g.fillRect(12 + i * 26, 36, 18, 28);
      g.fillTriangle(60, 0, 34, 40, 86, 40);
    }, 1);
  }

  /** Coins: +10 XP each. Placed above steps (and high above springs) to reward good movement. */
  private createCoins(): void {
    this.coins.forEach((c) => c.image.destroy());
    this.coins = [];
    this.coinsCollected = 0;

    const addCoin = (x: number, y: number, sectionIndex: number) => {
      const image = this.scene.add.image(x, y, 'tex-coin').setScale(0.8).setDepth(7);
      this.coins.push({ image, x, y, sectionIndex, collected: false, phase: (x + y) * 0.01 });
    };

    this.platforms.forEach((p) => {
      if (p.isCheckpoint || p.isSummit) return;
      // Same rule as countTowerCoins, which the max-score calculation uses
      const count = coinsForStep(p.kind, p.stepNumber);
      if (count === 2) {
        // A column of coins only a spring launch can reach
        addCoin(p.baseX, p.y - 170, p.sectionIndex);
        addCoin(p.baseX, p.y - 240, p.sectionIndex);
      } else if (count === 1) {
        addCoin(p.baseX, p.y - 52, p.sectionIndex);
      }
    });

    this.coins.forEach((c) => c.image.setVisible(c.sectionIndex === 1));
    gameEvents.totalCoins = this.coins.length;
  }

  /** Far-away towers beside the main tower (wide screens). They scroll slower = parallax depth. */
  private createSideScenery(): void {
    const { towerWidth, worldHeight } = this.config;
    const parallax = 0.72;
    const span = worldHeight * parallax + 900;
    for (let i = 0; i < 14; i++) {
      const left = i % 2 === 0;
      const dist = 150 + ((i * 97) % 330);
      const x = left ? -dist : towerWidth + dist;
      const y = 200 + (span / 14) * i + ((i * 53) % 120);
      const scale = 0.55 + ((i * 37) % 60) / 100;
      this.scene.add
        .image(x, y, 'tex-far-tower')
        .setOrigin(0.5, 0)
        .setScale(scale)
        .setAlpha(0.16 + (i % 3) * 0.04)
        .setTint(i % 3 === 0 ? 0xfde68a : 0xffffff)
        .setScrollFactor(1, parallax)
        .setDepth(-27);
    }
  }

  public getCoinCount(): number {
    return this.coins.length;
  }

  /**
   * Called every frame with the climber's body centre: collects coins in reach.
   */
  public collectCoinsNear(px: number, py: number): void {
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (c.collected || !c.image.visible) continue;
      if (Math.abs(c.x - px) < 34 && Math.abs(c.y - py) < 50) {
        c.collected = true;
        this.coinsCollected += 1;
        sfx.coin();
        this.scene.tweens.add({
          targets: c.image,
          y: c.y - 46,
          scale: 1.5,
          alpha: 0,
          duration: 320,
          ease: 'Cubic.easeOut',
          onComplete: () => c.image.setVisible(false),
        });
        for (let k = 0; k < 5; k++) {
          const spark = this.scene.add
            .image(c.x, c.y, 'tex-star')
            .setScale(0.3)
            .setTint(0xfde047)
            .setDepth(8);
          const ang = (Math.PI * 2 * k) / 5;
          this.scene.tweens.add({
            targets: spark,
            x: c.x + Math.cos(ang) * 30,
            y: c.y + Math.sin(ang) * 30,
            alpha: 0,
            scale: 0.05,
            duration: 360,
            onComplete: () => spark.destroy(),
          });
        }
        gameEvents.emit('evt:coin-collected', {
          collected: this.coinsCollected,
          total: this.coins.length,
        });
      }
    }
  }

  /** The climber just landed on / is standing on this platform. */
  public onPlayerStanding(platform: PlatformData): void {
    if (platform.kind === 'crumble' && platform.crumbleState === 0) {
      platform.crumbleState = 1;
      platform.crumbleTimer = platform.crumbleDelay;
      sfx.crumble();
    }
  }

  /** Squash-and-release animation when a spring launches the climber. */
  public animateSpring(platform: PlatformData): void {
    const base = 1 / TEX_SCALE;
    platform.sprite.setScale(base * platform.widthScale * 1.08, base * 0.6);
    this.scene.tweens.add({
      targets: platform.sprite,
      scaleX: base * platform.widthScale,
      scaleY: base,
      duration: 260,
      ease: 'Back.easeOut',
    });
  }

  private setPlatformX(platform: PlatformData, x: number): void {
    const dx = x - platform.x;
    if (dx === 0) return;
    platform.x = x;
    platform.sprite.x = x;
    (platform.sprite.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    for (let i = 0; i < platform.decorations.length; i++) {
      const d = platform.decorations[i] as unknown as { x: number };
      d.x += dx;
    }
  }

  private restoreCrumbled(platform: PlatformData, animate: boolean): void {
    platform.crumbleState = 0;
    platform.crumbleTimer = 0;
    const base = 1 / TEX_SCALE;
    const body = platform.sprite.body as Phaser.Physics.Arcade.StaticBody;
    this.scene.tweens.killTweensOf(platform.sprite);
    platform.sprite.setPosition(platform.x, platform.y);
    platform.sprite.setAngle(0);
    platform.sprite.setScale(base * platform.widthScale, base);
    if (!platform.unlocked) return;
    body.enable = true;
    platform.sprite.refreshBody();
    platform.sprite.setVisible(true);
    platform.decorations.forEach((d: any) => d.setVisible?.(true));
    if (animate) {
      platform.sprite.setAlpha(0);
      this.scene.tweens.add({ targets: platform.sprite, alpha: 1, duration: 260 });
    } else {
      platform.sprite.setAlpha(1);
    }
  }

  private createTextures(): void {
    const s = TEX_SCALE;
    this.createGameplayTextures();

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

  /**
   * Draws vector art ONCE into a texture. A baked texture costs a single quad per frame,
   * while a live Graphics object is re-tessellated on the CPU every frame (very slow on phones).
   */
  private bake(
    key: string,
    x0: number,
    y0: number,
    w: number,
    h: number,
    draw: (g: Phaser.GameObjects.Graphics) => void,
    res: number = TEX_SCALE
  ): void {
    if (this.scene.textures.exists(key)) return;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.scaleCanvas(res, res);
    g.translateCanvas(-x0, -y0);
    draw(g);
    g.generateTexture(key, Math.ceil(w * res), Math.ceil(h * res));
    g.destroy();
  }

  private addBaked(
    key: string,
    x0: number,
    y0: number,
    depth: number,
    res: number = TEX_SCALE
  ): Phaser.GameObjects.Image {
    return this.scene.add
      .image(x0, y0, key)
      .setOrigin(0, 0)
      .setScale(1 / res)
      .setDepth(depth);
  }

  private createTowerBackgroundAndWalls(): void {
    const { towerWidth, worldHeight, wallThickness, groundY } = this.config;

    // 1. Full-World Multi-Altitude Sky Gradient (4 rectangles only — cheap to keep as live Graphics)
    const outerBg = this.scene.add.graphics();
    outerBg.setDepth(-30);

    const fullW = towerWidth + 1800;
    const startX = -900;

    const band1H = Math.round(worldHeight * 0.28);
    const band2H = Math.round(worldHeight * 0.24);
    const band3H = Math.round(worldHeight * 0.24);
    const band4H = worldHeight - (band1H + band2H + band3H);
    const band2Y = band1H;
    const band3Y = band2Y + band2H;
    const band4Y = band3Y + band3H;

    // Band 1: Summit Starry Midnight Navy (y = 0 -> band1H)
    outerBg.fillGradientStyle(0x0a1226, 0x0a1226, 0x1b2a53, 0x1b2a53, 1);
    outerBg.fillRect(startX, 0, fullW, band1H);

    // Band 2: Sunset Twilight / Crimson Amber
    outerBg.fillGradientStyle(0x1b2a53, 0x1b2a53, 0xb84b2c, 0xb84b2c, 1);
    outerBg.fillRect(startX, band2Y, fullW, band2H);

    // Band 3: Golden Hour Amber Glow
    outerBg.fillGradientStyle(0xb84b2c, 0xb84b2c, 0xf5cca5, 0xf5cca5, 1);
    outerBg.fillRect(startX, band3Y, fullW, band3H);

    // Band 4: Morning Dawn Base
    outerBg.fillGradientStyle(0xf5cca5, 0xf5cca5, 0xf8e7d6, 0xf8e7d6, 1);
    outerBg.fillRect(startX, band4Y, fullW, band4H);

    // 2. Celestial Layer at Summit (Stars, Constellations & Crescent Moon)
    this.bake(
      'tex-star',
      0,
      0,
      16,
      16,
      (g) => {
        g.fillStyle(0xffffff, 1);
        g.fillCircle(8, 8, 8);
      },
      1
    );

    // Scattered glittering stars in the summit night sky
    for (let i = 0; i < 75; i++) {
      const sx = ((i * 47 + Math.sin(i * 73) * 280) % (towerWidth - 40)) + 20;
      const sy = 40 + ((i * 37) % Math.max(200, band1H - 60));
      const r = i % 4 === 0 ? 2.2 : i % 2 === 0 ? 1.4 : 1.0;
      const alpha = 0.55 + (i % 5) * 0.09;
      const star = this.scene.add
        .image(sx, sy, 'tex-star')
        .setScale(r / 8)
        .setAlpha(alpha)
        .setDepth(-28);
      if (i % 3 === 0) star.setTint(0xfef08a);
    }

    // Sequence Constellation Lines (Geometric progression ratios)
    const constPts = [
      { x: 140, y: 320 },
      { x: 210, y: 260 },
      { x: 310, y: 280 },
      { x: 420, y: 210 },
      { x: 530, y: 240 },
    ];
    this.bake('tex-constellation', 128, 200, 414, 132, (g) => {
      g.lineStyle(1, 0xee7b3c, 0.4);
      g.strokePoints(constPts, false);
      for (const pt of constPts) {
        g.fillStyle(0xfef08a, 0.95);
        g.fillCircle(pt.x, pt.y, 3);
        g.fillStyle(0xee7b3c, 0.35);
        g.fillCircle(pt.x, pt.y, 7);
      }
    });
    this.addBaked('tex-constellation', 128, 200, -28);

    // Radiant Crescent Moon at Summit (y = 190)
    const moonX = towerWidth - wallThickness - 100;
    const moonY = 190;
    this.bake('tex-moon', moonX - 34, moonY - 34, 68, 68, (g) => {
      g.fillStyle(0xee7b3c, 0.25);
      g.fillCircle(moonX, moonY, 32);
      g.fillStyle(0xfef08a, 0.95);
      g.fillCircle(moonX, moonY, 20);
      g.fillStyle(0x0c1529, 1);
      g.fillCircle(moonX - 7, moonY - 4, 18);
    });
    this.addBaked('tex-moon', moonX - 34, moonY - 34, -28);

    // 3. Animated Drifting Geometric Clouds
    // 3. Animated Drifting Geometric Clouds
    // 14 clouds positioned across various altitudes, dynamically colored & tuned to contrast with each level's sky
    const cloudBases = [
      // Base / Dawn clouds (warm peach-cream against light dawn sky)
      { r: 0.94, w: 140, h: 42, speed: 18, color: 0xffedd5, alpha: 0.60 },
      { r: 0.88, w: 110, h: 36, speed: 14, color: 0xfbeee0, alpha: 0.55 },
      { r: 0.82, w: 160, h: 46, speed: 20, color: 0xffedd5, alpha: 0.58 },
      { r: 0.75, w: 125, h: 38, speed: 16, color: 0xfbeee0, alpha: 0.54 },
      // Golden Hour clouds (warm amber & radiant golden tint)
      { r: 0.68, w: 150, h: 44, speed: 22, color: 0xfef08a, alpha: 0.52 },
      { r: 0.61, w: 120, h: 36, speed: 17, color: 0xffdfba, alpha: 0.54 },
      { r: 0.54, w: 170, h: 48, speed: 24, color: 0xfef08a, alpha: 0.50 },
      { r: 0.47, w: 130, h: 40, speed: 19, color: 0xffdfba, alpha: 0.52 },
      // Sunset / Twilight clouds (apricot coral & rose cream glow against crimson)
      { r: 0.40, w: 160, h: 44, speed: 23, color: 0xfed7aa, alpha: 0.52 },
      { r: 0.33, w: 120, h: 36, speed: 18, color: 0xfecdd3, alpha: 0.50 },
      // Night & Summit clouds (ethereal cyan, moonlit ice blue, starlight gold, pure celestial white)
      { r: 0.26, w: 150, h: 38, speed: 20, color: 0x99f6e4, alpha: 0.46 },
      { r: 0.19, w: 130, h: 34, speed: 16, color: 0xe0f2fe, alpha: 0.48 },
      { r: 0.13, w: 160, h: 40, speed: 22, color: 0xfef08a, alpha: 0.48 },
      { r: 0.06, w: 140, h: 36, speed: 18, color: 0xffffff, alpha: 0.52 },
    ];
    const cloudConfigs = cloudBases.map((cb) => ({
      y: Math.round(cb.r * (groundY - 350) + 350),
      ...cb,
    }));

    for (let i = 0; i < cloudConfigs.length; i++) {
      const cc = cloudConfigs[i];
      const startCloudX = ((i * 190) % (towerWidth + 240)) - 120;
      const key = `tex-cloud-${i}`;
      const padX = Math.round(cc.w * 0.18) + 14;
      const padTop = Math.round(cc.h * 0.90) + 16;
      const padBottom = Math.round(cc.h * 0.45) + 12;
      const localX = -cc.w / 2 - padX;
      const localY = -padTop;
      const bakeW = cc.w + padX * 2;
      const bakeH = padTop + padBottom;

      // Single signature fluffy multi-billow cartoon cloud shape used uniformly across all clouds
      this.bake(key, localX, localY, bakeW, bakeH, (g) => {
        const w = cc.w;
        const h = cc.h;

        // 1. Soft Ambient Underbelly Shadow (gives volumetric 3D presence)
        g.fillStyle(0x1b2a53, cc.alpha * 0.14);
        g.fillRoundedRect(-w * 0.46, 0, w * 0.92, h * 0.44, h * 0.22);

        // 2. Main Fluffy Cloud Body
        g.fillStyle(cc.color, cc.alpha);
        g.fillRoundedRect(-w * 0.44, -h * 0.12, w * 0.88, h * 0.44, h * 0.22);
        g.fillCircle(-w * 0.36, h * 0.04, h * 0.26);
        g.fillCircle(w * 0.36, h * 0.04, h * 0.26);
        g.fillCircle(-w * 0.24, -h * 0.22, h * 0.40);
        g.fillCircle(-w * 0.02, -h * 0.42, h * 0.54);
        g.fillCircle(w * 0.22, -h * 0.26, h * 0.44);
        g.fillCircle(w * 0.38, -h * 0.08, h * 0.30);

        // 3. Sunlit Highlights on upper crests
        g.fillStyle(0xffffff, cc.alpha * 0.45);
        g.fillCircle(-w * 0.26, -h * 0.28, h * 0.28);
        g.fillCircle(-w * 0.04, -h * 0.50, h * 0.38);
        g.fillCircle(w * 0.20, -h * 0.32, h * 0.30);
      });
      const cloud = this.addBaked(key, startCloudX + localX, cc.y + localY, -25);

      this.clouds.push({
        container: cloud,
        x: startCloudX,
        y: cc.y,
        speed: cc.speed,
        width: cc.w,
        offsetX: localX,
      });
    }

    // 4. Inner Tower Wall Backdrop & Architectural Wash
    this.scene.add
      .rectangle(
        towerWidth / 2,
        worldHeight / 2,
        towerWidth - wallThickness * 2,
        worldHeight,
        0x1b2a53,
        0.06
      )
      .setDepth(-22);

    // Masonry stone bricks courses (NO bookshelves) — one shared texture
    this.bake('tex-brick', 0, 0, 88, 36, (g) => {
      g.fillStyle(0x1b2a53, 1);
      g.fillRoundedRect(0, 0, 88, 36, 5);
    });
    for (let y = groundY; y > 150; y -= 160) {
      this.addBaked('tex-brick', wallThickness + 40, y - 90, -22).setAlpha(0.04);
      this.addBaked('tex-brick', towerWidth - wallThickness - 128, y - 40, -22).setAlpha(0.04);
      this.addBaked('tex-brick', towerWidth / 2 - 44, y - 140, -22).setAlpha(0.04);
    }

    // 5. Grand Academy Squared Windows (Staggered Left & Right, Away from Steps)
    interface SquareWindowDef {
      x: number;
      y: number;
      size: number;
      side: 'left' | 'right';
      gridSize?: number;
      sunbeam?: boolean;
    }

    const squareWindows: SquareWindowDef[] = [];
    for (let s = 1; s <= 6; s++) {
      const startStep = s === 1 ? 1 : this.config.checkpointSteps[s - 2] + 1;
      const endStep =
        s <= this.config.numberOfCheckpoints
          ? this.config.checkpointSteps[s - 1]
          : this.config.totalSteps;
      const startY = this.getStepY(startStep);
      const endY = this.getStepY(endStep);
      const span = startY - endY;
      const y1 = Math.round(startY - span * 0.3);
      const y2 = Math.round(startY - span * 0.7);

      const hasSunbeam = s <= 3;
      if (s % 2 === 1) {
        squareWindows.push({
          x: 596,
          y: y1,
          size: 72,
          side: 'right',
          sunbeam: hasSunbeam,
        });
        squareWindows.push({
          x: 124,
          y: y2,
          size: 72,
          side: 'left',
          sunbeam: hasSunbeam,
        });
      } else {
        squareWindows.push({
          x: 124,
          y: y1,
          size: 72,
          side: 'left',
          sunbeam: hasSunbeam,
        });
        squareWindows.push({
          x: 596,
          y: y2,
          size: 72,
          side: 'right',
          sunbeam: hasSunbeam,
        });
      }
    }
    // Summit Sky Gallery (Twin squared observatory windows flanking summit arch)
    squareWindows.push({
      x: 130,
      y: 220,
      size: 82,
      side: 'left',
      gridSize: 3,
      sunbeam: false,
    });
    squareWindows.push({
      x: 590,
      y: 220,
      size: 82,
      side: 'right',
      gridSize: 3,
      sunbeam: false,
    });

    const stainedPanes = [0x3f9f9b, 0xd8356c, 0xee7b3c, 0x7e57d8]; // Teal, Rose, Orange, Violet

    // Sunbeams are a handful of big translucent polygons — kept as one small live Graphics
    const beamGraphics = this.scene.add.graphics();
    beamGraphics.setDepth(-20);

    for (let i = 0; i < squareWindows.length; i++) {
      const win = squareWindows[i];
      const wx = win.x;
      const wy = win.y;
      const size = win.size;
      const isNightWindow = wy <= band1H;
      const grid = win.gridSize || 2;
      const framePad = 8;
      const frameSize = size + framePad * 2;
      const sillW = frameSize + 14;
      const sillH = 6;

      const regionX = wx - sillW / 2 - 2;
      const regionY = wy - frameSize / 2 - 2;
      const key = `tex-window-${i}`;

      this.bake(key, regionX, regionY, sillW + 4, frameSize + sillH + 4, (winGraphics) => {
        // 1. Outer Deep Navy Stone Frame (Crisply Squared)
        winGraphics.fillStyle(0x0f1830, 0.98);
        winGraphics.fillRect(wx - frameSize / 2, wy - frameSize / 2, frameSize, frameSize);
        winGraphics.fillStyle(0x1b2a53, 1);
        winGraphics.fillRect(wx - frameSize / 2 + 2, wy - frameSize / 2 + 2, frameSize - 4, frameSize - 4);

        // 2. Sherbeni Flame Orange Inner Casing Line
        winGraphics.lineStyle(2.5, 0xee7b3c, 0.9);
        winGraphics.strokeRect(wx - size / 2 - 1, wy - size / 2 - 1, size + 2, size + 2);

        // 3. Projecting Architectural Stone Windowsill Underneath
        winGraphics.fillStyle(0x0f1830, 1);
        winGraphics.fillRect(wx - sillW / 2, wy + frameSize / 2, sillW, sillH);
        winGraphics.fillStyle(0x162244, 1);
        winGraphics.fillRect(wx - sillW / 2 + 1, wy + frameSize / 2, sillW - 2, sillH - 2);
        winGraphics.fillStyle(0xee7b3c, 0.85);
        winGraphics.fillRect(wx - sillW / 2 + 2, wy + frameSize / 2, sillW - 4, 1.5);

        // 4. Window Interior Cutout (Sky shows through)
        const skyBg = isNightWindow
          ? 0x091124
          : wy > band4Y
            ? 0xf8e7d6
            : wy > band3Y
              ? 0xf5cca5
              : 0xd97757;
        winGraphics.fillStyle(skyBg, 0.94);
        winGraphics.fillRect(wx - size / 2, wy - size / 2, size, size);

        // 5. Stained Glass Accent Corner Panes (Sherbeni Slide Colors)
        const cornerSize = Math.max(8, Math.floor(size * 0.16));
        winGraphics.fillStyle(stainedPanes[0], 0.88);
        winGraphics.fillRect(wx - size / 2 + 3, wy - size / 2 + 3, cornerSize, cornerSize);
        winGraphics.fillStyle(stainedPanes[1], 0.88);
        winGraphics.fillRect(wx + size / 2 - cornerSize - 3, wy - size / 2 + 3, cornerSize, cornerSize);
        winGraphics.fillStyle(stainedPanes[2], 0.88);
        winGraphics.fillRect(wx - size / 2 + 3, wy + size / 2 - cornerSize - 3, cornerSize, cornerSize);
        winGraphics.fillStyle(stainedPanes[3], 0.88);
        winGraphics.fillRect(wx + size / 2 - cornerSize - 3, wy + size / 2 - cornerSize - 3, cornerSize, cornerSize);

        // 6. Squared Mullions (Crossbars)
        if (grid === 2) {
          winGraphics.fillStyle(0x1b2a53, 0.95);
          winGraphics.fillRect(wx - size / 2, wy - 1.5, size, 3);
          winGraphics.fillRect(wx - 1.5, wy - size / 2, 3, size);
          winGraphics.lineStyle(1, 0xee7b3c, 0.5);
          winGraphics.lineBetween(wx - size / 2, wy, wx + size / 2, wy);
          winGraphics.lineBetween(wx, wy - size / 2, wx, wy + size / 2);
          winGraphics.fillStyle(0xfef08a, 1);
          winGraphics.fillRect(wx - 2.5, wy - 2.5, 5, 5);
        } else {
          const colW = size / 3;
          winGraphics.fillStyle(0x1b2a53, 0.95);
          winGraphics.fillRect(wx - size / 2 + colW - 1, wy - size / 2, 2.5, size);
          winGraphics.fillRect(wx - size / 2 + colW * 2 - 1, wy - size / 2, 2.5, size);
          winGraphics.fillRect(wx - size / 2, wy - size / 2 + colW - 1, size, 2.5);
          winGraphics.fillRect(wx - size / 2, wy - size / 2 + colW * 2 - 1, size, 2.5);
          winGraphics.fillStyle(0xfef08a, 1);
          winGraphics.fillRect(wx - 3, wy - 3, 6, 6);
        }

        // 7. Glass Sheen / Translucent Reflection across upper pane
        winGraphics.fillStyle(0xffffff, 0.1);
        winGraphics.fillPoints(
          [
            { x: wx - size / 2 + 4, y: wy - size / 2 + 4 },
            { x: wx - size / 2 + size * 0.45, y: wy - size / 2 + 4 },
            { x: wx - size / 2 + 4, y: wy - size / 2 + size * 0.45 },
          ],
          true
        );

        // 8. Night Sky Stars inside night windows
        if (isNightWindow) {
          winGraphics.fillStyle(0xfef08a, 0.95);
          winGraphics.fillCircle(wx - size * 0.22, wy - size * 0.2, 2.2);
          winGraphics.fillCircle(wx + size * 0.24, wy - size * 0.12, 1.8);
          winGraphics.fillCircle(wx - size * 0.14, wy + size * 0.22, 1.8);
          winGraphics.fillStyle(0xee7b3c, 0.9);
          winGraphics.fillCircle(wx + size * 0.18, wy + size * 0.24, 2.0);
        }
      });
      this.addBaked(key, regionX, regionY, -20);

      if (!isNightWindow && win.sunbeam) {
        // Soft diagonal sunbeam pouring inwards into the room
        const beamW = 120;
        const beamH = 110;
        const dir = win.side === 'left' ? 1 : -1;
        const beamStartX = win.side === 'left' ? wx + size / 2 : wx - size / 2;

        beamGraphics.fillStyle(0xee7b3c, 0.09);
        beamGraphics.fillPoints(
          [
            { x: beamStartX, y: wy - size * 0.25 },
            { x: beamStartX, y: wy + size * 0.45 },
            { x: beamStartX + dir * beamW, y: wy + size * 0.45 + beamH },
            { x: beamStartX + dir * (beamW * 0.45), y: wy + size * 0.45 + beamH },
          ],
          true
        );

        beamGraphics.fillStyle(0xfef08a, 0.05);
        beamGraphics.fillPoints(
          [
            { x: beamStartX, y: wy },
            { x: beamStartX, y: wy + size * 0.35 },
            { x: beamStartX + dir * (beamW * 0.75), y: wy + size * 0.35 + beamH * 0.8 },
            { x: beamStartX + dir * (beamW * 0.35), y: wy + size * 0.35 + beamH * 0.8 },
          ],
          true
        );
      }
    }

    // 6. Glowing Wall Sconces & Torches (Standard + Super-Radiant for Dark Background Levels)
    this.bake('tex-sconce', -32, -82, 64, 64, (g) => {
      // Warm ambient light aura
      g.fillStyle(0xee7b3c, 0.25);
      g.fillCircle(0, -50, 30);
      g.fillStyle(0xfef08a, 0.35);
      g.fillCircle(0, -50, 18);
      // Brass bracket
      g.fillStyle(0xd97706, 1);
      g.fillRect(-4, -48, 8, 14);
      g.fillStyle(0xfef08a, 1);
      g.fillRect(-3, -48, 6, 2);
      // Flame core
      g.fillStyle(0xee7b3c, 0.95);
      g.fillCircle(0, -54, 6);
      g.fillStyle(0xfef08a, 1);
      g.fillCircle(0, -54, 3.5);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, -54, 1.8);
    });

    // Super-Radiant Lantern for Darker Background Levels (High Contrast & Ambient Bloom)
    this.bake('tex-sconce-radiant', -52, -102, 104, 104, (g) => {
      // Wide ambient golden bloom
      g.fillStyle(0xf59e0b, 0.32);
      g.fillCircle(0, -50, 50);
      // Mid luminous aura
      g.fillStyle(0xfef08a, 0.52);
      g.fillCircle(0, -50, 32);
      // Inner incandescent warmth
      g.fillStyle(0xffedd5, 0.75);
      g.fillCircle(0, -50, 18);
      // Polished brass ornate bracket
      g.fillStyle(0xd97706, 1);
      g.fillRect(-5, -48, 10, 15);
      g.fillStyle(0xfef08a, 1);
      g.fillRect(-4, -48, 8, 2.5);
      g.fillCircle(0, -32, 2.5);
      // Brilliant incandescent flame/bulb core
      g.fillStyle(0xee7b3c, 1);
      g.fillCircle(0, -53, 9);
      g.fillStyle(0xfef08a, 1);
      g.fillCircle(0, -53, 6);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, -53, 3.5);
    });

    for (let y = groundY; y > 150; y -= 320) {
      const leftX = wallThickness + 16;
      const rightX = towerWidth - wallThickness - 16;
      const isDarkAltitude = y < groundY * 0.58;
      const key = isDarkAltitude ? 'tex-sconce-radiant' : 'tex-sconce';
      const offX = isDarkAltitude ? 52 : 32;
      const offY = isDarkAltitude ? 102 : 82;
      this.addBaked(key, leftX - offX, y - offY, -15);
      this.addBaked(key, rightX - offX, y - offY, -15);
    }

    // 7. Tower walls — the brick pattern repeats every 48px, so one short segment
    //    texture per side is reused all the way up the tower.
    const brickPeriod = 48;
    const segH = brickPeriod * 10;
    const bakeH = segH + 2; // 2px overlap hides any seam between segments
    const wallW = wallThickness + 4;
    const rightX = towerWidth - wallThickness;

    this.bake('tex-wall-left', -4, 0, wallW, bakeH, (g) => {
      g.fillStyle(0x0f1830, 1);
      g.fillRect(-4, 0, wallThickness + 4, bakeH);
      g.fillStyle(0x1b2a53, 1);
      g.fillRect(0, 0, wallThickness, bakeH);
      g.fillStyle(0x273b70, 1);
      for (let y = 0; y < bakeH; y += brickPeriod) {
        g.fillRoundedRect(4, y + 4, wallThickness - 10, 40, 5);
      }
      g.fillStyle(0xee7b3c, 1);
      g.fillRect(wallThickness - 4, 0, 4, bakeH);
    });

    this.bake('tex-wall-right', rightX, 0, wallW, bakeH, (g) => {
      g.fillStyle(0x0f1830, 1);
      g.fillRect(rightX, 0, wallThickness + 4, bakeH);
      g.fillStyle(0x1b2a53, 1);
      g.fillRect(rightX, 0, wallThickness, bakeH);
      g.fillStyle(0x273b70, 1);
      for (let y = 0; y < bakeH; y += brickPeriod) {
        g.fillRoundedRect(rightX + 6, y + 4, wallThickness - 10, 40, 5);
      }
      g.fillStyle(0xee7b3c, 1);
      g.fillRect(rightX, 0, 4, bakeH);
    });

    for (let y = 0; y < worldHeight; y += segH) {
      this.addBaked('tex-wall-left', -4, y, 15);
      this.addBaked('tex-wall-right', rightX, y, 15);
    }
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
      .text(centerX, groundY + 13, "🏰 START CLIMBING SHERBO'S TOWER", {
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
      towerWidth,
      regularPlatformWidth,
      checkpointPlatformWidth,
      platformHeight,
    } = this.config;

    const centerX = towerWidth / 2;

    const sectionOffsets: number[][] = [
      // Section 1 (4 steps before Checkpoint 1): Curves leftward then ascends right
      [-110, -60, 120, 170],
      // Section 2 (7 steps before Checkpoint 2): Sweeping asymmetric S-curve
      [130, 40, -120, -165, -75, 70, 150],
      // Section 3 (10 steps before Checkpoint 3): Ascending diagonal run, side clusters, stepping stones
      [-130, -30, 60, 160, 120, -20, -150, -110, 30, 140],
      // Section 4 (13 steps before Checkpoint 4): Wall climbs, center pivots, and varied hop spans
      [90, 170, 130, -10, -140, -180, -100, 40, 150, 80, -60, -160, -40],
      // Section 5 (16 steps before Checkpoint 5): Organic winding path with clustered elevations
      [-120, -170, -90, 20, 130, 180, 110, -30, -140, -80, 50, 160, 120, 10, -110, -165],
      // Section 6 (19 steps before Summit): Grand multi-arc ascent breaking all zig-zag predictability
      [140, 180, 90, -40, -150, -185, -100, 30, 145, 175, 95, -25, -135, -175, -85, 45, 155, 110, -20],
    ];

    for (let step = 1; step <= totalSteps; step++) {
      const stepInfo = getStepInfo(step, this.config);
      const {
        isSummit,
        isCheckpoint,
        checkpointNumber,
        sectionIndex,
        stepInSection,
      } = stepInfo;

      const y = this.getStepY(step);
      let x = centerX;

      const design =
        SECTION_DESIGNS[Math.min(sectionIndex, SECTION_DESIGNS.length) - 1];
      let kind: PlatformKind = 'normal';
      let widthScale = 1;
      let moveAmp = 0;

      if (!isCheckpoint && !isSummit) {
        const offsets =
          sectionOffsets[(sectionIndex - 1) % sectionOffsets.length];
        x = centerX + offsets[stepInSection % offsets.length];
        kind = getStepKind(sectionIndex, stepInSection);
        // Springs and moving platforms keep a comfortable landing size
        widthScale = kind === 'spring' ? Math.max(0.9, design.widthScale) : design.widthScale;
        if (kind === 'moving') {
          // Never slide into the tower walls
          const half = (regularPlatformWidth * widthScale) / 2;
          const minX = this.config.wallThickness + half + 6;
          const maxX = towerWidth - this.config.wallThickness - half - 6;
          x = Phaser.Math.Clamp(x, minX + 30, maxX - 30);
          moveAmp = Math.min(design.moveAmp, x - minX, maxX - x);
        }
      }

      const width =
        isCheckpoint || isSummit
          ? checkpointPlatformWidth
          : regularPlatformWidth * widthScale;
      const height =
        isCheckpoint || isSummit ? platformHeight + 4 : platformHeight;
      const textureKey = isSummit
        ? 'tex-summit-platform'
        : isCheckpoint
          ? 'tex-checkpoint-platform'
          : KIND_TEXTURE[kind];

      const sprite = this.staticGroup.create(
        x,
        y,
        textureKey
      ) as Phaser.Physics.Arcade.Sprite;
      sprite.setScale(widthScale / TEX_SCALE, 1 / TEX_SCALE);
      sprite.setDepth(5);
      sprite.refreshBody();

      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.checkCollision.up = true;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;

      const decorations: Phaser.GameObjects.GameObject[] = [];

      const checkpointNames: Record<number, string> = {
        1: 'CHECKPOINT ONE',
        2: 'CHECKPOINT TWO',
        3: 'CHECKPOINT THREE',
        4: 'CHECKPOINT FOUR',
        5: 'CHECKPOINT FIVE',
      };
      const checkpointTitle =
        checkpointNumber !== null
          ? checkpointNames[checkpointNumber] || `CHECKPOINT ${checkpointNumber}`
          : '';

      if (isCheckpoint) {
        const stepBadge = this.scene.add
          .text(
            centerX,
            y - 1,
            `⚡ ${checkpointTitle}`,
            {
              fontFamily: '"Fredoka", sans-serif',
              fontSize: '14px',
              color: '#ffffff',
              backgroundColor: '#ee7b3c',
              padding: { x: 8, y: 2 },
              fontStyle: 'bold',
            }
          )
          .setResolution(TEXT_RES)
          .setOrigin(0.5, 0.5)
          .setDepth(7);
        decorations.push(stepBadge);
      } else if (!isSummit) {
        const stepBadge = this.scene.add
          .text(x, y - 1, `${step}`, {
            fontFamily: '"Fredoka", sans-serif',
            fontSize: '13px',
            color: '#ffffff',
            backgroundColor: '#1b2a53',
            padding: { x: 8, y: 2 },
            fontStyle: 'bold',
          })
          .setResolution(TEXT_RES)
          .setOrigin(0.5, 0.5)
          .setDepth(6);
        decorations.push(stepBadge);
      }

      if (isCheckpoint && checkpointNumber !== null) {
        // Create an architectural locked Gate Door positioned directly on the checkpoint platform
        const door = this.createCheckpointDoor(checkpointNumber, centerX, y);
        this.checkpointDoors.set(checkpointNumber, door);
        decorations.push(door.container);

        const flagX = this.config.towerWidth - this.config.wallThickness - 68;

        // Warm luminous backlight halo so the flag is prominently visible against dark navy skies
        const flagAura = this.scene.add
          .circle(flagX + 20, y - 46, 32, 0xfef08a, 0.24)
          .setDepth(3);

        // Gleaming metallic flagpole with golden highlight (doesn't blend into dark navy)
        const pole = this.scene.add
          .rectangle(flagX, y - 34, 5, 52, 0xf8fafc)
          .setDepth(4);
        const poleShine = this.scene.add
          .rectangle(flagX + 1, y - 34, 2, 52, 0xfef08a)
          .setDepth(4);

        const finial = this.scene.add
          .circle(flagX, y - 60, 5, 0xfbbf24)
          .setDepth(5);
        const finialSparkle = this.scene.add
          .circle(flagX - 1, y - 61, 2, 0xffffff)
          .setDepth(6);

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
        this.flagSteps.push(step);

        decorations.push(flagAura, pole, poleShine, finial, finialSparkle, flag.getGameObject());
      }

      if (isSummit) {
        const flagX = this.config.towerWidth - this.config.wallThickness - 68;

        const summitAura = this.scene.add
          .circle(flagX + 24, y - 46, 38, 0xfef08a, 0.30)
          .setDepth(3);

        const pole = this.scene.add
          .rectangle(flagX, y - 34, 5, 52, 0xf8fafc)
          .setDepth(4);
        const poleShine = this.scene.add
          .rectangle(flagX + 1, y - 34, 2, 52, 0xfef08a)
          .setDepth(4);

        const finial = this.scene.add
          .circle(flagX, y - 60, 5.5, 0xfbbf24)
          .setDepth(5);
        const finialSparkle = this.scene.add
          .circle(flagX - 1, y - 61, 2, 0xffffff)
          .setDepth(6);

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
        this.flagSteps.push(step);

        const finishSign = this.scene.add
          .text(flagX - 8, y - 46, '🏁 FINISH LINE', {
            fontFamily: '"Fredoka", sans-serif',
            fontSize: '14px',
            color: '#fef08a',
            backgroundColor: '#0a1020',
            stroke: '#ee7b3c',
            strokeThickness: 2.5,
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
          summitAura,
          pole,
          poleShine,
          finial,
          finialSparkle,
          summitFlag.getGameObject(),
          finishSign,
          archGlow,
          trophyText
        );
      }

      const isInitiallyUnlocked = sectionIndex === 1;
      const platformData: PlatformData = {
        kind,
        baseX: x,
        moveAmp,
        moveSpeed: design.moveSpeed * (step % 2 === 0 ? 1 : 0.85),
        movePhase: step * 1.7,
        widthScale,
        crumbleDelay: design.crumbleDelay,
        crumbleState: 0,
        crumbleTimer: 0,
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
      this.spriteToPlatform.set(sprite, platformData);
      if (kind === 'moving') this.movingPlatforms.push(platformData);
      if (kind === 'crumble') this.crumblePlatforms.push(platformData);
      this.applyPlatformLockState(platformData, isInitiallyUnlocked, false);
    }
  }

  private createCheckpointDoor(
    checkpointNumber: number,
    platformCenterX: number,
    platformY: number
  ): CheckpointDoor {
    const doorW = 76;
    const doorH = 92;
    const footY = platformY - 6; // Rests squarely on the checkpoint platform
    const doorTopY = footY - doorH;

    const container = this.scene.add.container(platformCenterX, 0);
    container.setDepth(6);

    // 1. Outer Heavy Architectural Stone Arch Frame (Deep Navy with Sherbeni Orange border & keystone)
    const doorFrame = this.scene.add.graphics();
    // Shadow backing
    doorFrame.fillStyle(0x0a1020, 0.98);
    doorFrame.fillRoundedRect(-doorW / 2 - 8, doorTopY - 8, doorW + 16, doorH + 8, 10);
    // Deep Navy stone arch
    doorFrame.fillStyle(0x1b2a53, 1);
    doorFrame.fillRoundedRect(-doorW / 2 - 4, doorTopY - 4, doorW + 8, doorH + 4, 8);
    // Sherbeni Flame Orange inner casing
    doorFrame.lineStyle(2.5, 0xee7b3c, 0.95);
    doorFrame.strokeRoundedRect(-doorW / 2 - 1, doorTopY - 1, doorW + 2, doorH + 1, 6);
    // Arch Keystone at top center
    doorFrame.fillStyle(0xee7b3c, 1);
    doorFrame.fillRect(-6, doorTopY - 7, 12, 7);
    doorFrame.fillStyle(0xfef08a, 1);
    doorFrame.fillRect(-2, doorTopY - 5, 4, 3);

    const doorThemes: Record<
      number,
      {
        top: number;
        bottom: number;
        rays: number;
        glow: number;
        stars?: boolean;
      }
    > = {
      // Gate 1 (Dawn): Warm peach cream to soft amber
      1: {
        top: 0xf8e7d6,
        bottom: 0xee7b3c,
        rays: 0xfef08a,
        glow: 0xee7b3c,
      },
      // Gate 2 (Golden Hour): Radiant warm gold into amber
      2: {
        top: 0xfef08a,
        bottom: 0xd97706,
        rays: 0xfde047,
        glow: 0xf59e0b,
      },
      // Gate 3 (Sunset / Twilight): Deep twilight crimson into warm dark amber
      3: {
        top: 0xb84b2c,
        bottom: 0x3b1111,
        rays: 0xfba680,
        glow: 0xe11d48,
      },
      // Gate 4 (Twilight Indigo): Deep indigo into dark twilight navy
      4: {
        top: 0x312e81,
        bottom: 0x0f172a,
        rays: 0xc7d2fe,
        glow: 0x818cf8,
        stars: true,
      },
      // Gate 5 (Cosmic Midnight): Deep cosmic midnight space navy matching the sky
      5: {
        top: 0x1b2a53,
        bottom: 0x070c1a,
        rays: 0x7dd3fc,
        glow: 0x38bdf8,
        stars: true,
      },
    };

    const theme = doorThemes[checkpointNumber] || doorThemes[1];

    // 2. Interior Portal Room / Sky Cutout matching current level background
    const doorInterior = this.scene.add.graphics();
    doorInterior.fillGradientStyle(theme.top, theme.top, theme.bottom, theme.bottom, 1);
    doorInterior.fillRoundedRect(-doorW / 2 + 2, doorTopY + 2, doorW - 4, doorH - 4, 4);

    if (theme.stars) {
      doorInterior.fillStyle(0xffffff, 0.9);
      doorInterior.fillCircle(-doorW * 0.22, doorTopY + doorH * 0.28, 1.4);
      doorInterior.fillCircle(doorW * 0.24, doorTopY + doorH * 0.22, 1.2);
      doorInterior.fillCircle(-doorW * 0.08, doorTopY + doorH * 0.55, 1.5);
      doorInterior.fillCircle(doorW * 0.18, doorTopY + doorH * 0.65, 1.3);
      doorInterior.fillStyle(theme.rays, 0.85);
      doorInterior.fillCircle(doorW * 0.05, doorTopY + doorH * 0.35, 1.6);
    }

    // 3. Volumetric Light Rays pouring outward when opened
    const lightRays = this.scene.add.graphics();
    lightRays.fillStyle(theme.rays, 0.28);
    lightRays.fillTriangle(-15, footY - 10, -55, footY + 12, 10, footY + 12);
    lightRays.fillTriangle(15, footY - 10, -10, footY + 12, 55, footY + 12);
    lightRays.fillTriangle(0, doorTopY + 20, -45, footY + 15, 45, footY + 15);
    lightRays.setAlpha(0); // Starts invisible while locked

    // 4. Two Heavy Wooden / Reinforced Iron Door Leaves
    const halfW = doorW / 2 - 2;
    // Left Door Leaf (x position will pivot / translate left on open)
    const doorLeft = this.scene.add.graphics();
    doorLeft.fillStyle(0x152244, 1);
    doorLeft.fillRoundedRect(-halfW - 1, doorTopY + 2, halfW, doorH - 4, { tl: 4, bl: 0, tr: 0, br: 0 });
    // Wood / Iron planking grooves & rivets
    doorLeft.lineStyle(1.5, 0x0f1830, 0.85);
    doorLeft.strokeRect(-halfW + 3, doorTopY + 6, halfW - 7, doorH - 12);
    doorLeft.fillStyle(0xee7b3c, 1);
    doorLeft.fillCircle(-halfW + 7, doorTopY + 16, 2.2);
    doorLeft.fillCircle(-halfW + 7, footY - 18, 2.2);
    // Brass handle ring
    doorLeft.lineStyle(2, 0xfef08a, 1);
    doorLeft.strokeCircle(-5, doorTopY + doorH * 0.52, 4);

    // Right Door Leaf (x position will pivot / translate right on open)
    const doorRight = this.scene.add.graphics();
    doorRight.fillStyle(0x152244, 1);
    doorRight.fillRoundedRect(1, doorTopY + 2, halfW, doorH - 4, { tr: 4, br: 0, tl: 0, bl: 0 });
    doorRight.lineStyle(1.5, 0x0f1830, 0.85);
    doorRight.strokeRect(4, doorTopY + 6, halfW - 7, doorH - 12);
    doorRight.fillStyle(0xee7b3c, 1);
    doorRight.fillCircle(halfW - 5, doorTopY + 16, 2.2);
    doorRight.fillCircle(halfW - 5, footY - 18, 2.2);
    // Brass handle ring
    doorRight.lineStyle(2, 0xfef08a, 1);
    doorRight.strokeCircle(5, doorTopY + doorH * 0.52, 4);

    // 5. Central Pulsing Lock Core
    const lockY = doorTopY + doorH * 0.52;
    const glow = this.scene.add.circle(0, lockY, 22, 0xee7b3c, 0.45);

    const lockIcon = this.scene.add
      .text(0, lockY, '🔒', {
        fontSize: '24px',
      })
      .setResolution(TEXT_RES)
      .setOrigin(0.5, 0.5);

    container.add([doorFrame, doorInterior, lightRays, doorLeft, doorRight, glow, lockIcon]);

    return {
      checkpointNumber,
      container,
      doorFrame,
      doorInterior,
      doorLeft,
      doorRight,
      lightRays,
      lockIcon,
      glow,
      lockY,
      isUnlocked: false,
    };
  }

  private createSectionBarrier(): void {
    const centerX = this.config.towerWidth / 2;
    const barrierY = this.getBarrierYForSection(1);

    // Keep an invisible physics collider high above so players cant jump over before opening
    this.ceilingBarrier = this.scene.physics.add.staticSprite(
      centerX,
      barrierY,
      'tex-barrier'
    );
    this.ceilingBarrier.setScale(1 / TEX_SCALE);
    this.ceilingBarrier.setAlpha(0); // Invisible ceiling physics
    this.ceilingBarrier.refreshBody();
  }

  private getBarrierYForSection(sectionIndex: number): number {
    const maxStepInSection = getMaxStepForSection(sectionIndex, this.config);
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
        platform.sprite.setScale(baseScale * platform.widthScale * 0.7, baseScale * 0.7);
        this.scene.tweens.add({
          targets: platform.sprite,
          alpha: 1,
          scaleX: baseScale * platform.widthScale,
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
        platform.sprite.setScale(baseScale * platform.widthScale, baseScale);
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

    // 1. Animate unlocking the door on the checkpoint platform (checkpointNumber = sectionIndex - 1)
    const prevCheckpointNum = sectionIndex - 1;
    const door = this.checkpointDoors.get(prevCheckpointNum);
    if (door && !door.isUnlocked) {
      door.isUnlocked = true;

      // Swap lock icon to unlock and burst bright portal glow matching level atmosphere
      door.lockIcon.setText('🔓');
      const burstColors: Record<number, number> = {
        1: 0xfef08a,
        2: 0xfde047,
        3: 0xfba680,
        4: 0xc7d2fe,
        5: 0x7dd3fc,
      };
      const burstColor = burstColors[prevCheckpointNum] || 0xfef08a;
      door.glow.setFillStyle(burstColor, 0.95);

      this.scene.tweens.add({
        targets: door.glow,
        scale: 2.8,
        alpha: 0,
        duration: 650,
        ease: 'Quad.easeOut',
      });

      // Reveal brilliant volumetric portal light pouring through
      this.scene.tweens.add({
        targets: door.lightRays,
        alpha: 0.85,
        duration: 400,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
      });

      // Swing left door leaf wide open (sliding & swinging outward)
      this.scene.tweens.add({
        targets: door.doorLeft,
        scaleX: 0.08,
        x: -28,
        alpha: 0.45,
        duration: 600,
        ease: 'Cubic.easeInOut',
      });

      // Swing right door leaf wide open (sliding & swinging outward)
      this.scene.tweens.add({
        targets: door.doorRight,
        scaleX: 0.08,
        x: 28,
        alpha: 0.45,
        duration: 600,
        ease: 'Cubic.easeInOut',
      });

      // Floating unlocked badge rise and fade
      this.scene.tweens.add({
        targets: door.lockIcon,
        y: door.lockY - 32,
        scale: 1.4,
        alpha: 0,
        duration: 650,
        ease: 'Cubic.easeOut',
      });
    }

    // 2. Reveal the new section steps with staggered bounce animation
    this.platforms.forEach((platform) => {
      if (platform.sectionIndex === sectionIndex) {
        this.applyPlatformLockState(platform, true, true);
      }
    });

    // Reveal the coins of the new section
    this.coins.forEach((c) => {
      if (c.sectionIndex === sectionIndex && !c.collected) {
        c.image.setVisible(true).setAlpha(0);
        this.scene.tweens.add({ targets: c.image, alpha: 1, duration: 400 });
      }
    });

    const totalSections = this.config.numberOfCheckpoints + 1;
    if (sectionIndex <= totalSections) {
      const newBarrierY = this.getBarrierYForSection(sectionIndex);
      this.ceilingBarrier.setY(newBarrierY);
      this.ceilingBarrier.refreshBody();
    }
  }

  public resetSections(): void {
    this.unlockedSection = 1;
    this.moveClock = 0;
    this.platforms.forEach((platform) => {
      const unlocked = platform.sectionIndex === 1;
      if (platform.kind === 'moving') this.setPlatformX(platform, platform.baseX);
      this.scene.tweens.killTweensOf(platform.sprite);
      platform.sprite.setPosition(platform.x, platform.y).setAngle(0);
      platform.crumbleState = 0;
      platform.crumbleTimer = 0;
      this.applyPlatformLockState(platform, unlocked, false);
    });

    // Put every coin back
    this.coinsCollected = 0;
    this.coins.forEach((c) => {
      this.scene.tweens.killTweensOf(c.image);
      c.collected = false;
      c.image.setPosition(c.x, c.y).setScale(0.8).setAlpha(1);
      c.image.setVisible(c.sectionIndex === 1);
    });

    // Reset all doors back to locked state
    this.checkpointDoors.forEach((door) => {
      this.scene.tweens.killTweensOf([
        door.lockIcon,
        door.glow,
        door.doorLeft,
        door.doorRight,
        door.lightRays,
      ]);
      door.isUnlocked = false;
      door.lockIcon.setText('🔒');
      door.lockIcon.setPosition(0, door.lockY).setAlpha(1).setScale(1);
      door.doorLeft.setScale(1, 1).setAlpha(1).setX(0);
      door.doorRight.setScale(1, 1).setAlpha(1).setX(0);
      door.lightRays.setAlpha(0);
      door.glow.setPosition(0, door.lockY).setScale(1).setAlpha(0.45).setFillStyle(0xee7b3c, 0.45);
    });

    const barrierY = this.getBarrierYForSection(1);
    this.ceilingBarrier.setY(barrierY);
    this.ceilingBarrier.refreshBody();
  }

  /**
   * @param worldRunning false while the game is paused on a question (nothing may move then)
   * @param standingOn the platform the climber is standing on this frame (if any)
   * @returns how far the platform under the climber moved, so the climber can be carried along
   */
  public update(
    time: number,
    delta: number,
    worldRunning: boolean = true,
    standingOn: PlatformData | null = null
  ): number {
    // Only animate / draw flags and gate doors that are actually near the camera.
    // (Each one is a live vector Graphics that is expensive to rebuild every frame.)
    const view = this.scene.cameras.main.worldView;
    const top = view.y - 180;
    const bottom = view.bottom + 180;
    let carryDx = 0;

    if (worldRunning) {
      this.moveClock += delta * 0.001;

      // Moving platforms (pre-filtered list, only update ones near the screen)
      for (let i = 0; i < this.movingPlatforms.length; i++) {
        const p = this.movingPlatforms[i];
        if (!p.unlocked || p.y <= top - 200 || p.y >= bottom + 200) continue;
        const nx = p.baseX + Math.sin(this.moveClock * p.moveSpeed + p.movePhase) * p.moveAmp;
        const dx = nx - p.x;
        this.setPlatformX(p, nx);
        if (standingOn === p) carryDx = dx;
      }

      // Crumbling platforms (pre-filtered list)
      for (let i = 0; i < this.crumblePlatforms.length; i++) {
        const p = this.crumblePlatforms[i];
        if (!p.unlocked || p.crumbleState === 0) continue;
        p.crumbleTimer -= delta;
        if (p.crumbleState === 1) {
          // Shake harder as it is about to give way
          const k = 1 - Math.max(0, p.crumbleTimer) / p.crumbleDelay;
          p.sprite.x = p.x + Math.sin(time * 0.09) * (1 + k * 2.5);
          p.sprite.setAngle(Math.sin(time * 0.07) * k * 2);
          if (p.crumbleTimer <= 0) {
            p.crumbleState = 2;
            p.crumbleTimer = 2400;
            (p.sprite.body as Phaser.Physics.Arcade.StaticBody).enable = false;
            p.decorations.forEach((d: any) => d.setVisible?.(false));
            sfx.crumbleFall();
            this.scene.tweens.add({
              targets: p.sprite,
              y: p.y + 90,
              alpha: 0,
              angle: p.stepNumber % 2 === 0 ? 14 : -14,
              duration: 420,
              ease: 'Quad.easeIn',
            });
          }
        } else if (p.crumbleTimer <= 0) {
          this.restoreCrumbled(p, true);
        }
      }
    }

    // Gentle coin bobbing (visible coins only)
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      if (c.collected || !c.image.visible) continue;
      if (c.y < top || c.y > bottom) continue;
      c.image.y = c.y + Math.sin(time * 0.004 + c.phase) * 4;
    }

    // 1. Update physically-simulated waving flags
    for (let i = 0; i < this.wavingFlags.length; i++) {
      const platform = this.platforms.get(this.flagSteps[i]);
      const onScreen =
        !!platform && platform.unlocked && platform.y > top && platform.y < bottom;
      this.wavingFlags[i].setVisible(onScreen);
      if (onScreen) this.wavingFlags[i].update(time);
    }

    const pulse = 0.5 + 0.5 * Math.sin(time * 0.004);
    this.checkpointDoors.forEach((door, checkpointNumber) => {
      const cpStep = this.config.checkpointSteps[checkpointNumber - 1];
      const platform = this.platforms.get(cpStep);
      const visible =
        !!platform && platform.unlocked && platform.y > top && platform.y < bottom;
      door.container.setVisible(visible);
      if (visible && !door.isUnlocked) {
        door.glow.setScale(0.88 + pulse * 0.35);
        door.glow.setAlpha(0.32 + pulse * 0.35);
      }
    });

    // 2. Update drifting clouds across the tower (only move display objects on-screen)
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
      if (c.y > top && c.y < bottom) {
        c.container.setX(c.x + c.offsetX);
      }
    }

    return carryDx;
  }
}
