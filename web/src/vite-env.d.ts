/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TUNARR_BACKEND_URI?: string;
}

// Lingui catalogs are compiled on import by @lingui/vite-plugin.
declare module '*.po' {
  import type { Messages } from '@lingui/core';
  export const messages: Messages;
}
