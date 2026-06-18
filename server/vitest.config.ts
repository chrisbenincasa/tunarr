import swc from '@rollup/plugin-swc';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globalSetup: ['src/testing/globalTestSetup.ts'],
    globals: true,
    watch: false,
    includeSource: ['src/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      // Comment this out if developing locally and you want
      // to easily debug tests right in an editor like VS Code
      '**/*.local.test.ts',
    ],
    setupFiles: [
      'src/testing/matchers/PixelFormatMatcher.ts',
      'src/testing/matchers/FrameSizeMatcher.ts',
    ],
    coverage: {
      provider: 'v8',
    },
    typecheck: {
      tsconfig: 'tsconfig.test.json',
    },
    silent: true,
    reporters: ['dot'],
    env: {
      NODE_ENV: 'test',
    },
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
  plugins: [
    swc({
      swc: {
        jsc: {
          parser: {
            syntax: 'typescript',
            decorators: true,
          },
          target: 'esnext',
          transform: {
            decoratorMetadata: true,
          },
        },
      },
    }),
  ],
});
