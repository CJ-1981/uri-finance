/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_AUTH_TITLE?: string;
  readonly VITE_APP_AUTH_SUBTITLE?: string;
  readonly VITE_APP_AUTH_TITLE_KO?: string;
  readonly VITE_APP_AUTH_SUBTITLE_KO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __BUILD_TIME__: string;
declare const __APP_VERSION__: string;
