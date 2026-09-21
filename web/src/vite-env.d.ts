/// <reference types="vite/client" />

// Lingui catalogs are compiled on import by @lingui/vite-plugin.
declare module '*.po' {
  import type { Messages } from '@lingui/core';
  export const messages: Messages;
}
