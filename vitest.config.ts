import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['web', 'server', 'shared'],
  },
});
