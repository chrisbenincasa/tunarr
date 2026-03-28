import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'web/vitest.config.ts',
      'server/vitest.config.ts',
      'server/vitest.local.config.ts',
      'shared',
    ],
  },
});
