/**
 * Versioned URL for a file under public/stickers or public/sounds.
 *
 * Appends ?v=<content hash> (computed at build time in vite.config.ts), so the browser
 * can keep these files cached for a long time and still fetch a fresh copy as soon as
 * a file changes. Use it for every /stickers/ and /sounds/ reference.
 */
const hashes: Record<string, string> =
  typeof __PUBLIC_ASSET_HASHES__ !== 'undefined' ? __PUBLIC_ASSET_HASHES__ : {};

export function assetUrl(path: string): string {
  const hash = hashes[path];
  return hash ? `${path}?v=${hash}` : path;
}
