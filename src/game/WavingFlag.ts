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

/**
 * Procedural physically-simulated waving flag with:
 * 1. Traveling harmonic wave equation (waves propagate from pole to tip)
 * 2. Natural cloth envelope (fixed anchor at hoist, vigorous snapping at free fly end)
 * 3. 3D surface fold illumination (dynamic specular highlights on crests and shadows in troughs)
 * 4. Horizontal cloth foreshortening (preserves fabric arc length as folds deepen)
 * 5. Multi-harmonic ripple & tip flutter for organic cloth behavior
 */
export class WavingFlag {
  private graphics: Phaser.GameObjects.Graphics;
  private x: number;
  private y: number;
  private width: number;
  private height: number;
  private tipHeight: number;
  private baseR: number;
  private baseG: number;
  private baseB: number;
  private stripeR: number;
  private stripeG: number;
  private stripeB: number;
  private windSpeed: number;
  private phaseOffset: number;
  private isSummit: boolean;
  private segments: number = 18;

  constructor(options: WavingFlagOptions) {
    this.x = options.x;
    this.y = options.y;
    this.width = options.width ?? 44;
    this.height = options.height ?? 24;
    this.tipHeight = options.tipHeight ?? (options.isSummit ? 18 : 4);
    this.windSpeed = options.windSpeed ?? 1.0;
    this.phaseOffset = options.phaseOffset ?? 0;
    this.isSummit = !!options.isSummit;

    const baseColor = options.baseColor ?? 0xee7b3c;
    this.baseR = (baseColor >> 16) & 0xff;
    this.baseG = (baseColor >> 8) & 0xff;
    this.baseB = baseColor & 0xff;

    const stripeColor = options.stripeColor ?? (this.isSummit ? 0xfef08a : 0xffffff);
    this.stripeR = (stripeColor >> 16) & 0xff;
    this.stripeG = (stripeColor >> 8) & 0xff;
    this.stripeB = stripeColor & 0xff;

    this.graphics = options.scene.add.graphics();
    this.graphics.setDepth(options.depth ?? 5);

    this.render(0);
  }

  public getGameObject(): Phaser.GameObjects.Graphics {
    return this.graphics;
  }

  public setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  public destroy(): void {
    this.graphics.destroy();
  }

  public update(timeMs: number): void {
    this.render(timeMs);
  }

  private shadeColor(r0: number, g0: number, b0: number, factor: number): number {
    let r: number;
    let g: number;
    let b: number;

    if (factor >= 1) {
      // Lighten towards warm sunlight highlight
      const t = Math.min(1, (factor - 1) * 1.25);
      r = Math.round(r0 + (255 - r0) * t);
      g = Math.round(g0 + (235 - g0) * t);
      b = Math.round(b0 + (210 - b0) * t);
    } else {
      // Darken towards deep fabric fold shadow
      const t = Math.max(0.48, factor);
      r = Math.round(r0 * t);
      g = Math.round(g0 * t);
      b = Math.round(b0 * t);
    }

    return (r << 16) | (g << 8) | b;
  }

  private render(timeMs: number): void {
    this.graphics.clear();

    const t = (timeMs * 0.001) * this.windSpeed + this.phaseOffset;
    const n = this.segments;

    // Harmonic wave parameters (traveling left -> right)
    const k1 = Math.PI * 2.5; // Primary billow (~1.25 waves along length)
    const w1 = 6.4;
    const k2 = Math.PI * 6.2; // Secondary flutter (~3.1 ripples)
    const w2 = 12.8;
    const k3 = Math.PI * 11.0; // High-frequency cloth tip snap
    const w3 = 19.5;

    // Store calculated slice positions
    const topPoints: { x: number; y: number }[] = [];
    const botPoints: { x: number; y: number }[] = [];
    const sTopPoints: { x: number; y: number }[] = [];
    const sBotPoints: { x: number; y: number }[] = [];
    const slopes: number[] = [];

    // Low-frequency vertical wind lift (gusting under the fabric)
    const gust = Math.sin(t * 1.5 + this.phaseOffset) * 2.0;

    for (let i = 0; i <= n; i++) {
      const u = i / n;

      // Amplitude envelope: 0 at flagpole, smoothly increases with whip curve toward tip
      const env = Math.pow(u, 1.28);

      const wave1 = Math.sin(k1 * u - w1 * t);
      const wave2 = Math.sin(k2 * u - w2 * t + 0.9);
      const wave3 = Math.sin(k3 * u - w3 * t + 2.1);

      // Vertical displacement along traveling wave
      const waveY = env * (6.2 * wave1 + 2.4 * wave2 + 1.2 * wave3) + gust * u;

      // Approximate derivative (wave slope) for foreshortening and 3D lighting
      const slopeApprox =
        env * (k1 * Math.cos(k1 * u - w1 * t) * 6.2 + k2 * Math.cos(k2 * u - w2 * t + 0.9) * 2.4) * 0.035;
      slopes.push(slopeApprox);

      // Horizontal foreshortening: as folds deepen, projected cloth length slightly contracts
      const foldFactor = 1 - 0.065 * Math.min(1, slopeApprox * slopeApprox);
      const posX = this.x + u * this.width * foldFactor;

      // Height tapers from hoist to tip
      const currentH = this.height * (1 - u) + this.tipHeight * u;
      const centerY = this.y + waveY;

      const topY = centerY - currentH / 2;
      const botY = centerY + currentH / 2;

      topPoints.push({ x: posX, y: topY });
      botPoints.push({ x: posX, y: botY });

      // Interior accent stripe / badge geometry
      const stripeHalfH = this.isSummit ? currentH * 0.28 : currentH * 0.18;
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
      const sliceColor = this.shadeColor(this.baseR, this.baseG, this.baseB, lightFactor);

      // Render base cloth quad (with 0.4px overlap to eliminate subpixel raster seams)
      this.graphics.fillStyle(sliceColor, 1);
      this.graphics.fillPoints(
        [
          { x: p0Top.x, y: p0Top.y },
          { x: p1Top.x + 0.4, y: p1Top.y },
          { x: p1Bot.x + 0.4, y: p1Bot.y },
          { x: p0Bot.x, y: p0Bot.y },
        ],
        true
      );

      // Render center accent stripe with matching fold illumination
      const sp0Top = sTopPoints[i];
      const sp1Top = sTopPoints[i + 1];
      const sp0Bot = sBotPoints[i];
      const sp1Bot = sBotPoints[i + 1];

      const stripeSliceColor = this.shadeColor(this.stripeR, this.stripeG, this.stripeB, lightFactor);
      this.graphics.fillStyle(stripeSliceColor, 0.94);
      this.graphics.fillPoints(
        [
          { x: sp0Top.x, y: sp0Top.y },
          { x: sp1Top.x + 0.4, y: sp1Top.y },
          { x: sp1Bot.x + 0.4, y: sp1Bot.y },
          { x: sp0Bot.x, y: sp0Bot.y },
        ],
        true
      );
    }

    // 2. Hem outlines along the fluttering edges for crisp tactile definition
    this.graphics.lineStyle(1.2, 0x1b2a53, 0.38);
    this.graphics.strokePoints(topPoints, false);
    this.graphics.strokePoints(botPoints, false);

    // Free fly edge (tip vertical seam)
    const lastTop = topPoints[n];
    const lastBot = botPoints[n];
    this.graphics.lineStyle(1.2, 0x1b2a53, 0.45);
    this.graphics.lineBetween(lastTop.x, lastTop.y, lastBot.x, lastBot.y);

    // 3. Hoist attachment rings (connects fabric to the physical flagpole)
    this.graphics.fillStyle(0x1b2a53, 0.95);
    this.graphics.fillCircle(this.x, topPoints[0].y, 1.8);
    this.graphics.fillCircle(this.x, botPoints[0].y, 1.8);
  }
}
