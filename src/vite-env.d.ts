/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sherbeni API base, e.g. https://api.example.com/api/v1 — used for games opened with ?game=<id>. */
  readonly VITE_API_URL?: string;
}

/** Injected by vite.config.ts: public URL path → content hash for public/stickers and public/sounds. */
declare const __PUBLIC_ASSET_HASHES__: Record<string, string>;
