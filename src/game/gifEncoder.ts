/**
 * Pure TypeScript animated GIF encoder (GIF89a).
 * Zero external dependencies. Works in both browser and Node.js environments.
 */

// Simple Median-Cut Color Quantizer to convert 32-bit RGBA frames into 256-color palettes
interface ColorBox {
  rMin: number;
  rMax: number;
  gMin: number;
  gMax: number;
  bMin: number;
  bMax: number;
  colors: number[]; // 0xRRGGBB values
}

function getColorRange(box: ColorBox): { channel: 'r' | 'g' | 'b'; range: number } {
  const rRange = box.rMax - box.rMin;
  const gRange = box.gMax - box.gMin;
  const bRange = box.bMax - box.bMin;
  const maxRange = Math.max(rRange, gRange, bRange);
  if (maxRange === rRange) return { channel: 'r', range: rRange };
  if (maxRange === gRange) return { channel: 'g', range: gRange };
  return { channel: 'b', range: bRange };
}

function splitBox(box: ColorBox): [ColorBox, ColorBox] {
  const { channel } = getColorRange(box);
  const shift = channel === 'r' ? 16 : channel === 'g' ? 8 : 0;

  box.colors.sort((c1, c2) => {
    const v1 = (c1 >> shift) & 0xff;
    const v2 = (c2 >> shift) & 0xff;
    return v1 - v2;
  });

  const medianIdx = Math.floor(box.colors.length / 2);
  const colors1 = box.colors.slice(0, medianIdx);
  const colors2 = box.colors.slice(medianIdx);

  const makeBox = (colors: number[]): ColorBox => {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const c of colors) {
      const r = (c >> 16) & 0xff;
      const g = (c >> 8) & 0xff;
      const b = c & 0xff;
      if (r < rMin) rMin = r;
      if (r > rMax) rMax = r;
      if (g < gMin) gMin = g;
      if (g > gMax) gMax = g;
      if (b < bMin) bMin = b;
      if (b > bMax) bMax = b;
    }
    return { rMin, rMax, gMin, gMax, bMin, bMax, colors };
  };

  return [makeBox(colors1), makeBox(colors2)];
}

export function buildPalette(pixels: Uint8ClampedArray, maxColors: number = 256): number[] {
  // Step 1: Sample distinct colors
  const colorSet = new Set<number>();
  const totalPixels = pixels.length / 4;
  const step = Math.max(1, Math.floor(totalPixels / 10000)); // Sample up to 10k pixels for speed

  for (let i = 0; i < totalPixels; i += step) {
    const offset = i * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    // Quantize 5 bits per channel to group very close shades
    const key = ((r & 0xf8) << 16) | ((g & 0xf8) << 8) | (b & 0xf8);
    colorSet.add(key);
  }

  const distinctColors = Array.from(colorSet);
  if (distinctColors.length <= maxColors) {
    const palette = distinctColors.slice();
    while (palette.length < maxColors) {
      palette.push(0x000000);
    }
    return palette;
  }

  // Step 2: Median-Cut
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (const c of distinctColors) {
    const r = (c >> 16) & 0xff;
    const g = (c >> 8) & 0xff;
    const b = c & 0xff;
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
    if (g < gMin) gMin = g;
    if (g > gMax) gMax = g;
    if (b < bMin) bMin = b;
    if (b > bMax) bMax = b;
  }

  const initialBox: ColorBox = {
    rMin, rMax, gMin, gMax, bMin, bMax,
    colors: distinctColors,
  };

  const boxes: ColorBox[] = [initialBox];
  while (boxes.length < maxColors) {
    // Find box with greatest range
    let bestIdx = -1;
    let maxRange = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].colors.length > 1) {
        const { range } = getColorRange(boxes[i]);
        if (range > maxRange) {
          maxRange = range;
          bestIdx = i;
        }
      }
    }

    if (bestIdx === -1) break;
    const [b1, b2] = splitBox(boxes[bestIdx]);
    boxes.splice(bestIdx, 1, b1, b2);
  }

  const palette: number[] = [];
  for (const b of boxes) {
    if (b.colors.length === 0) continue;
    let rSum = 0, gSum = 0, bSum = 0;
    for (const c of b.colors) {
      rSum += (c >> 16) & 0xff;
      gSum += (c >> 8) & 0xff;
      bSum += c & 0xff;
    }
    const rAvg = Math.round(rSum / b.colors.length);
    const gAvg = Math.round(gSum / b.colors.length);
    const bAvg = Math.round(bSum / b.colors.length);
    palette.push((rAvg << 16) | (gAvg << 8) | bAvg);
  }

  while (palette.length < maxColors) {
    palette.push(0x000000);
  }

  return palette.slice(0, maxColors);
}

// Map each pixel to the closest color in the palette
export function mapPixelsToPalette(
  pixels: Uint8ClampedArray,
  palette: number[]
): Uint8Array {
  const numPixels = pixels.length / 4;
  const indexed = new Uint8Array(numPixels);

  // Cache closest matches for fast lookup
  const cache = new Map<number, number>();

  for (let i = 0; i < numPixels; i++) {
    const offset = i * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    const key = (r << 16) | (g << 8) | b;

    let match = cache.get(key);
    if (match === undefined) {
      let minDist = Infinity;
      let bestIdx = 0;
      for (let p = 0; p < palette.length; p++) {
        const pr = (palette[p] >> 16) & 0xff;
        const pg = (palette[p] >> 8) & 0xff;
        const pb = palette[p] & 0xff;
        // Euclidean color distance
        const dr = r - pr;
        const dg = g - pg;
        const db = b - pb;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
          minDist = dist;
          bestIdx = p;
          if (dist === 0) break;
        }
      }
      match = bestIdx;
      cache.set(key, match);
    }

    indexed[i] = match;
  }

  return indexed;
}

// LZW Compressor for GIF
class LZWEncoder {
  private output: number[] = [];
  private curAccum = 0;
  private curBits = 0;
  private initCodeSize = 8;
  private clearCode: number;
  private eofCode: number;
  private codeSize: number;
  private maxCode: number;
  private table: Map<number, number> = new Map();
  private nextCode: number;

  constructor(initCodeSize: number = 8) {
    this.initCodeSize = initCodeSize;
    this.clearCode = 1 << initCodeSize; // 256
    this.eofCode = this.clearCode + 1;  // 257
    this.codeSize = initCodeSize + 1;   // 9
    this.maxCode = (1 << this.codeSize) - 1;
    this.nextCode = this.clearCode + 2;
  }

  private writeBits(code: number) {
    this.curAccum |= code << this.curBits;
    this.curBits += this.codeSize;
    while (this.curBits >= 8) {
      this.output.push(this.curAccum & 0xff);
      this.curAccum >>= 8;
      this.curBits -= 8;
    }
  }

  private flushBits() {
    if (this.curBits > 0) {
      this.output.push(this.curAccum & 0xff);
      this.curAccum = 0;
      this.curBits = 0;
    }
  }

  private resetTable() {
    this.table.clear();
    this.codeSize = this.initCodeSize + 1;
    this.maxCode = (1 << this.codeSize) - 1;
    this.nextCode = this.clearCode + 2;
  }

  public encode(pixels: Uint8Array): Uint8Array {
    this.output = [];
    this.curAccum = 0;
    this.curBits = 0;
    this.resetTable();

    // Start with clear code
    this.writeBits(this.clearCode);

    if (pixels.length === 0) {
      this.writeBits(this.eofCode);
      this.flushBits();
      return new Uint8Array(this.output);
    }

    let prefix = pixels[0];

    for (let i = 1; i < pixels.length; i++) {
      const k = pixels[i];
      const key = (prefix << 8) | k;

      if (this.table.has(key)) {
        prefix = this.table.get(key)!;
      } else {
        this.writeBits(prefix);

        if (this.nextCode < 4096) {
          this.table.set(key, this.nextCode++);
          if (this.nextCode > this.maxCode && this.codeSize < 12) {
            this.codeSize++;
            this.maxCode = (1 << this.codeSize) - 1;
          }
        } else {
          // Table is full: emit clear code and reset
          this.writeBits(this.clearCode);
          this.resetTable();
        }

        prefix = k;
      }
    }

    this.writeBits(prefix);
    this.writeBits(this.eofCode);
    this.flushBits();

    // Package output into GIF data sub-blocks of at most 255 bytes each
    const packaged: number[] = [];
    let idx = 0;
    while (idx < this.output.length) {
      const blockSize = Math.min(255, this.output.length - idx);
      packaged.push(blockSize);
      for (let b = 0; b < blockSize; b++) {
        packaged.push(this.output[idx + b]);
      }
      idx += blockSize;
    }
    packaged.push(0); // Block terminator

    return new Uint8Array(packaged);
  }
}

export interface GifFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
  delayMs: number;
}

export class GifEncoder {
  private width: number;
  private height: number;
  private frames: GifFrame[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public addFrame(imageData: ImageData | { data: Uint8ClampedArray; width: number; height: number }, delayMs: number = 100) {
    this.frames.push({
      width: imageData.width,
      height: imageData.height,
      data: imageData.data,
      delayMs,
    });
  }

  public render(): Uint8Array {
    if (this.frames.length === 0) {
      throw new Error('Cannot render GIF: no frames added');
    }

    const bytes: number[] = [];

    // 1. Signature & Version: GIF89a
    const sig = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]; // 'GIF89a'
    for (const b of sig) bytes.push(b);

    // 2. Logical Screen Descriptor
    // Width & Height (uint16 LE)
    bytes.push(this.width & 0xff, (this.width >> 8) & 0xff);
    bytes.push(this.height & 0xff, (this.height >> 8) & 0xff);
    // Packed field: 0xF7 = Global Color Table Flag (1), Color Resolution (111 = 8 bits), Sort (0), GCT Size (111 = 256 colors)
    bytes.push(0xf7);
    // Background Color Index
    bytes.push(0x00);
    // Pixel Aspect Ratio
    bytes.push(0x00);

    // 3. Global Color Table (sample first frame for palette)
    const palette = buildPalette(this.frames[0].data, 256);
    for (let i = 0; i < 256; i++) {
      const c = palette[i] || 0;
      bytes.push((c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff);
    }

    // 4. Netscape 2.0 Loop Extension (Infinite Loop)
    bytes.push(0x21, 0xff, 0x0b); // Extension Introducer, App Extension Label, Block Size (11)
    const netscape = [0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30]; // 'NETSCAPE2.0'
    for (const b of netscape) bytes.push(b);
    bytes.push(0x03, 0x01, 0x00, 0x00, 0x00); // Sub-block: loop count 0 (infinite) + terminator

    // 5. Frames
    const lzw = new LZWEncoder(8);

    for (const frame of this.frames) {
      // Graphic Control Extension
      const delayUnits = Math.max(2, Math.round(frame.delayMs / 10)); // in 1/100ths of second
      bytes.push(0x21, 0xf9, 0x04);
      bytes.push(0x04); // Disposal method: 1 (do not dispose, overwrite)
      bytes.push(delayUnits & 0xff, (delayUnits >> 8) & 0xff);
      bytes.push(0x00); // Transparent color index
      bytes.push(0x00); // Block terminator

      // Image Descriptor
      bytes.push(0x2c); // Image Separator
      bytes.push(0x00, 0x00); // Left
      bytes.push(0x00, 0x00); // Top
      bytes.push(frame.width & 0xff, (frame.width >> 8) & 0xff);
      bytes.push(frame.height & 0xff, (frame.height >> 8) & 0xff);
      bytes.push(0x00); // Packed: no local color table, not interlaced

      // LZW Minimum Code Size
      bytes.push(0x08);

      // Quantize and map pixels
      const indexed = mapPixelsToPalette(frame.data, palette);
      const compressed = lzw.encode(indexed);
      for (let i = 0; i < compressed.length; i++) {
        bytes.push(compressed[i]);
      }
    }

    // 6. Trailer
    bytes.push(0x3b);

    return new Uint8Array(bytes);
  }
}
