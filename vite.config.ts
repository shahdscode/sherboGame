import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin, type Rollup } from 'vite';
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

/** Files the start screen waits on, besides the JS/CSS chunks (bgm loads after Start). */
const PRELOADED_PUBLIC_ASSETS = [
  '/stickers/character-atlas.webp',
  '/stickers/actions-atlas.webp',
  '/stickers/main-sticker.webp',
];

/**
 * Emits dist/preload.html: a page that only downloads the game's JS/CSS chunks and
 * start-screen images into the HTTP cache, one at a time at low priority, without
 * running the game. The student app opens it in a hidden frame ~45s before a tower
 * game appears in a video. It has to be a frame on this origin: browsers partition
 * the HTTP cache per frame site, so a prefetch from the student app's own page would
 * not be reused by the game's frame. Skipped when the viewer has Data Saver or 2G.
 */
function preloadPage(hashes: Record<string, string>): Plugin {
  return {
    name: 'sherbo-preload-page',
    apply: 'build',
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(
        (file): file is Rollup.OutputChunk => file.type === 'chunk' && file.isEntry,
      );
      if (!entry) throw new Error('preload.html: no entry chunk in the bundle');
      const css = [...(entry.viteMetadata?.importedCss ?? [])];
      const urls = [
        ...[entry.fileName, ...entry.imports, ...css].map((file) => `/${file}`),
        ...PRELOADED_PUBLIC_ASSETS.map((path) => {
          if (!hashes[path]) throw new Error(`preload.html: missing public asset ${path}`);
          return `${path}?v=${hashes[path]}`;
        }),
      ];
      const script = `(function () {
  var c = navigator.connection;
  if (c && (c.saveData || /2g$/.test(c.effectiveType || ''))) return;
  var urls = ${JSON.stringify(urls)};
  var i = 0;
  function next() {
    if (i >= urls.length) return;
    fetch(urls[i++], { priority: 'low' })
      .then(function (res) { return res.arrayBuffer(); })
      .catch(function () {})
      .then(next);
  }
  next();
})();`;
      this.emitFile({
        type: 'asset',
        fileName: 'preload.html',
        source: `<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Sherbo Tower preload</title></head>
<body><script>
${script}
</script></body></html>
`,
      });
    },
  };
}

const publicAssetHashes = hashPublicAssets();

export default defineConfig({
  plugins: [react(), preloadPage(publicAssetHashes)],
  define: {
    __PUBLIC_ASSET_HASHES__: JSON.stringify(publicAssetHashes),
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
