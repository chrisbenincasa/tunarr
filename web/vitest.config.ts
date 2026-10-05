import { lingui } from '@lingui/vite-plugin';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    includeSource: ['src/**/*.test.ts', 'src/**/*.test.tsx'],

    // Component tests mount the full provider tree per test, and pickers like
    // LanguagePreferencesList render every ISO 639 language. That lands within
    // ~2.5s of the 5s default on a cold CI runner, so whichever test runs
    // first absorbs module init and times out.
    testTimeout: 15_000,
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
