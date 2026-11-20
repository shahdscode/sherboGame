import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Content hash of every file under public/stickers and public/sounds, keyed by its
 * public URL path ("/sounds/bgm.m4a" → "a1b2c3d4"). src/utils/assetUrl.ts appends it
 * as ?v=, so nginx can cache these folders for a long time and a changed file still
 * gets a new URL on the next deploy.
 */
function hashPublicAssets(): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const dir of ['stickers', 'sounds']) {
    for (const entry of readdirSync(join('public', dir), { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const bytes = readFileSync(join('public', dir, entry.name));
      hashes[`/${dir}/${entry.name}`] = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
    }
  }
  return hashes;
}

export default defineConfig({
  plugins: [react()],
  define: {
    __PUBLIC_ASSET_HASHES__: JSON.stringify(hashPublicAssets()),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          vendor: ['react', 'react-dom', 'lucide-react', 'canvas-confetti'],
        },
      },
    },
    chunkSizeWarningLimit: 1600,
  },
});
