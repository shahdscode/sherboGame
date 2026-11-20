/**
 * Which character sprite sheets to load. Shared by Player.ts and the preload page
 * (vite.config.ts), which must pick the same files. Keep it free of DOM types: the
 * Vite config imports it too.
 */
export interface CharacterAtlas {
  character: string;
  actions: string;
  frameWidth: number;
  frameHeight: number;
  spacing: number;
}

/** Full-size frames: needed on desktops/tablets, where the climber renders up to ~360px tall. */
export const HD_ATLAS: CharacterAtlas = {
  character: '/stickers/character-atlas.webp',
  actions: '/stickers/actions-atlas.webp',
  frameWidth: 240,
  frameHeight: 360,
  spacing: 4,
};

/**
 * 60% frames (scripts/make-sd-atlases.py) for phones, where the climber is ~104 css px
 * tall at no more than 2x render resolution. About a third of the GPU memory and
 * download of the full-size sheets.
 */
export const SD_ATLAS: CharacterAtlas = {
  character: '/stickers/character-atlas-sd.webp',
  actions: '/stickers/actions-atlas-sd.webp',
  frameWidth: 144,
  frameHeight: 216,
  spacing: 4,
};

/** Screens whose short side is below this many css px (phones) get the SD sheets. */
export const SD_ATLAS_MAX_SCREEN_SIDE = 600;

/** `screenShortSide`: Math.min(screen.width, screen.height), which doesn't change on rotation. */
export const pickCharacterAtlas = (screenShortSide: number): CharacterAtlas =>
  screenShortSide > 0 && screenShortSide < SD_ATLAS_MAX_SCREEN_SIDE ? SD_ATLAS : HD_ATLAS;
