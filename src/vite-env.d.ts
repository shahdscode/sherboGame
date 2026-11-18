/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sherbeni API base, e.g. https://api.example.com/api/v1 — used for games opened with ?game=<id>. */
  readonly VITE_API_URL?: string;
}
