import { lingui } from '@lingui/vite-plugin';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import svgr from 'vite-plugin-svgr';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react({
      plugins: [['@lingui/swc-plugin', {}]],
    }),
    lingui(),
    svgr(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          includeSource: ['src/**/*.test.ts', 'src/**/*.test.tsx'],

          // Component tests mount the full provider tree per test, and pickers
          // like LanguagePreferencesList render every ISO 639 language. That
          // lands within ~2.5s of the 5s default on a cold CI runner, so
          // whichever test runs first absorbs module init and times out.
          testTimeout: 15_000,
        },
      },
      {
        extends: true,

        // Runs every story as a test in a real browser, including the a11y
        // checks configured in .storybook/preview.tsx.
        plugins: [
          storybookTest({ configDir: path.join(__dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
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
