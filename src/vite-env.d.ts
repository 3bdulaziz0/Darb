/// <reference types="vite/client" />

/**
 * Only VITE_-prefixed variables exist here, and every one of them is shipped
 * to the browser in plain text. The Gemini key is deliberately NOT in this
 * list — it has no prefix and lives on the server. See .env.example.
 */
interface ImportMetaEnv {
  /** Set to '1' to use the offline stub instead of calling the model. */
  readonly VITE_RAWI_USE_STUB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
