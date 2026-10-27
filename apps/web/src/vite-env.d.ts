/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: public demo passwords to pre-fill on the login page (the same ones the README lists). */
  readonly VITE_DEMO_AUTHOR_PASSWORD?: string;
  readonly VITE_DEMO_ADMIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
