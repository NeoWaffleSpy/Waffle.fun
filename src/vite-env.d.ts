/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Which backend implementation `src/services` uses. Defaults to `local`. */
  readonly VITE_BACKEND?: import('./services/types').BackendKind;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
