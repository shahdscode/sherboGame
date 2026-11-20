import Phaser from 'phaser';

export interface WavingFlagOptions {
  scene: Phaser.Scene;
  x: number; // Flagpole attachment X
  y: number; // Vertical center Y at attachment
  width?: number; // Total length of flag in px (default: 44)
  height?: number; // Height at hoist (pole) in px (default: 24)
  tipHeight?: number; // Height at free tip in px (default: 4 for tapered pennant)
  baseColor?: number; // Primary fabric color (default: 0xee7b3c Sherbeni flame)
  stripeColor?: number; // Interior emblem/stripe color (default: 0xffffff)
  windSpeed?: number; // Speed multiplier for wind
  phaseOffset?: number; // Phase offset so different flags don't flap in robotic lockstep
  depth?: number;
  isSummit?: boolean;
}

interface FlagShape {
  width: number;
  height: number;
  tipHeight: number;
  baseColor: number;
  stripeColor: number;
  isSummit: boolean;
}

/**
 * Every wave frequency is a whole multiple of LOOP_OMEGA, so the motion repeats exactly
 * every LOOP_SECONDS of wind time and can be pre-drawn as a seamless loop.
 */
const LOOP_OMEGA = 6.4 / 3;
const LOOP_SECONDS = (2 * Math.PI) / LOOP_OMEGA; // ≈ 2.95s
/** ~20 fps at normal wind speed (the old live flag redrew at most every 32ms). */
const FRAME_COUNT = 60;
const FRAME_COLUMNS = 10;
/** Texture pixels per world unit (same 2x as the platform textures). */
const TEX_RES = 2;
const SEGMENTS = 12;
/** Room left of the pole attachment for the hoist rings. */
const HOIST_PAD = 3;
/** Largest vertical wave displacement: 6.2 + 2.4 + 1.2 (waves) + 2 (gust). */
const MAX_WAVE = 11.8;

interface SheetLayout {
  cellW: number; // texture px
  cellH: number; // texture px
  originX: number; // 0..1, pole attachment inside a cell
  originY: number;
}

/**
 * Physically-simulated waving flag:
 * 1. Traveling harmonic wave equation (waves propagate from pole to tip)
 * 2. Natural cloth envelope (fixed anchor at hoist, vigorous snapping at free fly end)
 * 3. 3D surface fold illumination (specular highlights on crests and shadows in troughs)
 * 4. Horizontal cloth foreshortening (preserves fabric arc length as folds deepen)
 * 5. Multi-harmonic ripple & tip flutter for organic cloth behavior
 *
 * One loop of the motion is drawn ONCE per flag shape into a sprite sheet; each flag is
 * then just an image whose frame advances with time. Redrawing the cloth live (a Graphics
 * object cleared and refilled every 32ms) made Phaser re-triangulate it on the CPU every
 * frame, a large share of the frame time on slow phones.
 */
export class WavingFlag {
  private image: Phaser.GameObjects.Image;
  private windSpeed: number;
  private phaseOffset: number;
  private frame = -1;

  constructor(options: WavingFlagOptions) {
    const isSummit = !!options.isSummit;
    const shape: FlagShape = {
      width: options.width ?? 44,
      height: options.height ?? 24,
      tipHeight: options.tipHeight ?? (isSummit ? 18 : 4),
      baseColor: options.baseColor ?? 0xee7b3c,
      stripeColor: options.stripeColor ?? (isSummit ? 0xfef08a : 0xffffff),
      isSummit,
    };
    this.windSpeed = options.windSpeed ?? 1.0;
    this.phaseOffset = options.phaseOffset ?? 0;

    const { key, layout } = bakeFlagSheet(options.scene, shape);
    this.image = options.scene.add
      .image(options.x, options.y, key, 0)
      .setOrigin(layout.originX, layout.originY)
      .setScale(1 / TEX_RES)
      .setDepth(options.depth ?? 5);

    this.update(0);
  }

  public getGameObject(): Phaser.GameObjects.Image {
    return this.image;
  }

  public setVisible(visible: boolean): void {
    this.image.setVisible(visible);
  }

  public destroy(): void {
    this.image.destroy();
  }

  public update(timeMs: number): void {
    const t = timeMs * 0.001 * this.windSpeed + this.phaseOffset;
    const loopPos = ((t % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;
    const frame = Math.floor((loopPos / LOOP_SECONDS) * FRAME_COUNT) % FRAME_COUNT;
    if (frame === this.frame) return;
    this.frame = frame;
    this.image.setFrame(frame);
  }
}

const sheetLayouts = new Map<string, SheetLayout>();

/** Draws one wave loop of `shape` into a sprite sheet texture (once per scene texture manager). */
function bakeFlagSheet(scene: Phaser.Scene, shape: FlagShape): { key: string; layout: SheetLayout } {
  const key = [
    'tex-flag',
    shape.width,
    shape.height,
    shape.tipHeight,
    shape.baseColor.toString(16),
    shape.stripeColor.toString(16),
    shape.isSummit ? 'summit' : 'pennant',
  ].join('-');

  // Cell size in world units, then rounded up to whole texture pixels.
  const halfH = Math.max(shape.height, shape.tipHeight) / 2 + MAX_WAVE + 2;
  const cellW = Math.ceil((shape.width + HOIST_PAD + 3) * TEX_RES);
  const cellH = Math.ceil(halfH * 2 * TEX_RES);
  const layout: SheetLayout = {
    cellW,
    cellH,
    originX: (HOIST_PAD * TEX_RES) / cellW,
    originY: 0.5,
  };

  if (scene.textures.exists(key) && sheetLayouts.has(key)) return { key, layout };

  const rows = Math.ceil(FRAME_COUNT / FRAME_COLUMNS);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.scaleCanvas(TEX_RES, TEX_RES);
  for (let i = 0; i < FRAME_COUNT; i++) {
    const col = i % FRAME_COLUMNS;
    const row = Math.floor(i / FRAME_COLUMNS);
    const ox = (col * cellW) / TEX_RES + HOIST_PAD;
    const oy = (row * cellH + cellH / 2) / TEX_RES;
    drawFlag(g, shape, ox, oy, (i / FRAME_COUNT) * LOOP_SECONDS);
  }
  if (scene.textures.exists(key)) scene.textures.remove(key);
  g.generateTexture(key, cellW * FRAME_COLUMNS, cellH * rows);
  g.destroy();

  const texture = scene.textures.get(key);
  for (let i = 0; i < FRAME_COUNT; i++) {
    texture.add(i, 0, (i % FRAME_COLUMNS) * cellW, Math.floor(i / FRAME_COLUMNS) * cellH, cellW, cellH);
  }
  sheetLayouts.set(key, layout);
  return { key, layout };
}

function shadeColor(color: number, factor: number): number {
  const r0 = (color >> 16) & 0xff;
  const g0 = (color >> 8) & 0xff;
  const b0 = color & 0xff;
  let r: number;
  let g: number;
  let b: number;

  if (factor >= 1) {
    // Lighten towards warm sunlight highlight
    const t = Math.min(1, (factor - 1) * 1.4);
    r = Math.round(r0 + (255 - r0) * t);
    g = Math.round(g0 + (250 - g0) * t);
    b = Math.round(b0 + (220 - b0) * t);
  } else {
    // Keep shadows luminous and radiant even against dark backgrounds
    const t = Math.max(0.78, factor);
    r = Math.round(r0 * t);
    g = Math.round(g0 * t);
    b = Math.round(b0 * t);
  }

  return (r << 16) | (g << 8) | b;
}

/** Draws the flag at wind time `t`, with the pole attachment at (x, y). */
function drawFlag(
  graphics: Phaser.GameObjects.Graphics,
  shape: FlagShape,
  x: number,
  y: number,
  t: number
): void {
  const n = SEGMENTS;

  // Harmonic wave parameters (traveling left -> right); frequencies are multiples of LOOP_OMEGA
  const k1 = Math.PI * 2.5; // Primary billow (~1.25 waves along length)
  const w1 = 3 * LOOP_OMEGA; // 6.4
  const k2 = Math.PI * 6.2; // Secondary flutter (~3.1 ripples)
  const w2 = 6 * LOOP_OMEGA; // 12.8
  const k3 = Math.PI * 11.0; // High-frequency cloth tip snap
  const w3 = 9 * LOOP_OMEGA; // 19.2

  const topPoints: { x: number; y: number }[] = [];
  const botPoints: { x: number; y: number }[] = [];
  const sTopPoints: { x: number; y: number }[] = [];
  const sBotPoints: { x: number; y: number }[] = [];

  // Low-frequency vertical wind lift (gusting under the fabric)
  const gust = Math.sin(t * LOOP_OMEGA) * 2.0;

  for (let i = 0; i <= n; i++) {
    const u = i / n;

    // Amplitude envelope: 0 at flagpole, smoothly increases with whip curve toward tip
    const env = Math.pow(u, 1.28);

    const wave1 = Math.sin(k1 * u - w1 * t);
    const wave2 = Math.sin(k2 * u - w2 * t + 0.9);
    const wave3 = Math.sin(k3 * u - w3 * t + 2.1);

    // Vertical displacement along traveling wave
    const waveY = env * (6.2 * wave1 + 2.4 * wave2 + 1.2 * wave3) + gust * u;

    // Approximate derivative (wave slope) for foreshortening
    const slopeApprox =
      env * (k1 * Math.cos(k1 * u - w1 * t) * 6.2 + k2 * Math.cos(k2 * u - w2 * t + 0.9) * 2.4) * 0.035;

    // Horizontal foreshortening: as folds deepen, projected cloth length slightly contracts
    const foldFactor = 1 - 0.065 * Math.min(1, slopeApprox * slopeApprox);
    const posX = x + u * shape.width * foldFactor;

    // Height tapers from hoist to tip
    const currentH = shape.height * (1 - u) + shape.tipHeight * u;
    const centerY = y + waveY;

    topPoints.push({ x: posX, y: centerY - currentH / 2 });
    botPoints.push({ x: posX, y: centerY + currentH / 2 });

    // Interior accent stripe / badge geometry
    const stripeHalfH = shape.isSummit ? currentH * 0.28 : currentH * 0.18;
    sTopPoints.push({ x: posX, y: centerY - stripeHalfH });
    sBotPoints.push({ x: posX, y: centerY + stripeHalfH });
  }

  // 1. Draw 3D-shaded cloth segments from pole to tip
  for (let i = 0; i < n; i++) {
    const p0Top = topPoints[i];
    const p1Top = topPoints[i + 1];
    const p0Bot = botPoints[i];
    const p1Bot = botPoints[i + 1];

    // Slope of this specific quad segment determines sunlight catch vs fold shadow
    const dx = Math.max(0.2, p1Top.x - p0Top.x);
    const dy = (p1Top.y + p1Bot.y) / 2 - (p0Top.y + p0Bot.y) / 2;
    const segmentSlope = dy / dx;

    // Light factor: 1.0 = neutral, >1.0 = illuminated crest, <1.0 = valley shadow
    const lightFactor = 1.0 - segmentSlope * 0.42;

    // Base cloth quad (with 0.4px overlap to eliminate subpixel raster seams)
    graphics.fillStyle(shadeColor(shape.baseColor, lightFactor), 1);
    graphics.fillPoints(
      [
        { x: p0Top.x, y: p0Top.y },
        { x: p1Top.x + 0.4, y: p1Top.y },
        { x: p1Bot.x + 0.4, y: p1Bot.y },
        { x: p0Bot.x, y: p0Bot.y },
      ],
      true
    );

    // Center accent stripe with matching fold illumination
    const sp0Top = sTopPoints[i];
    const sp1Top = sTopPoints[i + 1];
    const sp0Bot = sBotPoints[i];
    const sp1Bot = sBotPoints[i + 1];
    graphics.fillStyle(shadeColor(shape.stripeColor, lightFactor), 0.94);
    graphics.fillPoints(
      [
        { x: sp0Top.x, y: sp0Top.y },
        { x: sp1Top.x + 0.4, y: sp1Top.y },
        { x: sp1Bot.x + 0.4, y: sp1Bot.y },
        { x: sp0Bot.x, y: sp0Bot.y },
      ],
      true
    );
  }

  // 2. Crisp, luminous hem outlines along fluttering edges for high visibility against dark skies
  graphics.lineStyle(1.4, 0xffffff, 0.72);
  graphics.strokePoints(topPoints, false);
  graphics.strokePoints(botPoints, false);

  // Free fly edge (tip vertical seam)
  const lastTop = topPoints[n];
  const lastBot = botPoints[n];
  graphics.lineStyle(1.4, 0xffffff, 0.85);
  graphics.lineBetween(lastTop.x, lastTop.y, lastBot.x, lastBot.y);

  // 3. Hoist attachment rings (connects fabric to the physical flagpole)
  graphics.fillStyle(0xfef08a, 1);
  graphics.fillCircle(x, topPoints[0].y, 2.0);
  graphics.fillCircle(x, botPoints[0].y, 1.8);
}
