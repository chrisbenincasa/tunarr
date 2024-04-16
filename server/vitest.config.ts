import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    includeSource: ['src/**/*.test.ts'],
  },
  define: {
    'import.meta.vitest': false,
  },
  build: {
    lib: {
      formats: ['es', 'cjs'],
      entry: './index.ts',
      fileName: 'index',
    },
  },
});
