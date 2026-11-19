/**
 * Tower layout data shared by the Phaser scene and the score maths: which
 * platform kind sits on each step, and where coins go. No Phaser imports, so
 * it also runs in node tests and in the max-score calculation.
 */
import {
  towerConfig,
  buildTowerGeometry,
  getStepInfo,
  type TowerConfig,
} from '../data/towerConfig.ts';

/**
 * Platform behaviours. Each tower section introduces new ones, so the climb gets
 * harder (and more interesting) with every gate:
 *  normal  – solid step
 *  moving  – slides left/right and carries the climber
 *  crumble – shakes, then falls away shortly after being stepped on (it grows back)
 *  ice     – slippery: the climber accelerates and stops slowly
 *  spring  – launches the climber high into the air
 */
export type PlatformKind = 'normal' | 'moving' | 'crumble' | 'ice' | 'spring';

export interface SectionDesign {
  /** Platform width multiplier (platforms get narrower higher up). */
  widthScale: number;
  /** Behaviour per regular step of the section (index = step inside the section). */
  kinds: Partial<Record<number, PlatformKind>>;
  /** Horizontal travel (px each side) and speed (radians/sec) of moving platforms. */
  moveAmp: number;
  moveSpeed: number;
  /** Time (ms) a crumbling platform holds after being stepped on. */
  crumbleDelay: number;
}

export const SECTION_DESIGNS: SectionDesign[] = [
  // Section 1 — warm-up: plain steps only
  { widthScale: 1, kinds: {}, moveAmp: 0, moveSpeed: 0, crumbleDelay: 900 },
  // Section 2 — moving platforms appear
  { widthScale: 1, kinds: { 2: 'moving', 5: 'moving' }, moveAmp: 55, moveSpeed: 1.3, crumbleDelay: 900 },
  // Section 3 — crumbling steps join in
  {
    widthScale: 0.94,
    kinds: { 1: 'crumble', 3: 'moving', 5: 'crumble', 7: 'moving', 8: 'crumble' },
    moveAmp: 65,
    moveSpeed: 1.5,
    crumbleDelay: 800,
  },
  // Section 4 — ice and the first spring
  {
    widthScale: 0.9,
    kinds: { 1: 'ice', 2: 'ice', 4: 'moving', 5: 'crumble', 7: 'spring', 9: 'moving', 10: 'ice', 11: 'crumble' },
    moveAmp: 75,
    moveSpeed: 1.75,
    crumbleDelay: 700,
  },
  // Section 5 — everything, faster
  {
    widthScale: 0.85,
    kinds: {
      1: 'moving', 2: 'ice', 3: 'crumble', 5: 'moving', 6: 'spring', 8: 'crumble',
      9: 'moving', 10: 'ice', 11: 'crumble', 13: 'moving', 14: 'ice',
    },
    moveAmp: 85,
    moveSpeed: 2.0,
    crumbleDelay: 620,
  },
  // Section 6 — the final ascent
  {
    widthScale: 0.8,
    kinds: {
      1: 'moving', 2: 'crumble', 3: 'ice', 4: 'moving', 6: 'crumble', 7: 'spring', 8: 'moving',
      9: 'ice', 10: 'crumble', 12: 'moving', 13: 'ice', 14: 'crumble', 15: 'spring', 16: 'moving',
      17: 'crumble',
    },
    moveAmp: 95,
    moveSpeed: 2.3,
    crumbleDelay: 540,
  },
];

/** The kind of a regular (non-checkpoint, non-summit) step. */
export function getStepKind(sectionIndex: number, stepInSection: number): PlatformKind {
  const design = SECTION_DESIGNS[Math.min(sectionIndex, SECTION_DESIGNS.length) - 1];
  return design.kinds[stepInSection] ?? 'normal';
}

/**
 * Coins placed above a regular step: two high above a spring (only its launch
 * reaches them), one above every even-numbered step, none otherwise.
 */
export function coinsForStep(kind: PlatformKind, stepNumber: number): number {
  if (kind === 'spring') return 2;
  return stepNumber % 2 === 0 ? 1 : 0;
}

/** Number of coins in a tower with `levelCount` levels (gates). */
export function countTowerCoins(levelCount: number): number {
  const config: TowerConfig = { ...towerConfig, ...buildTowerGeometry(levelCount) };
  let coins = 0;
  for (let step = 1; step <= config.totalSteps; step++) {
    const info = getStepInfo(step, config);
    if (info.isCheckpoint || info.isSummit) continue;
    coins += coinsForStep(getStepKind(info.sectionIndex, info.stepInSection), step);
  }
  return coins;
}
