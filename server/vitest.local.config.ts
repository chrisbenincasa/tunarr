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
    globals: true,
    watch: false,
    include: ['src/**/*.local.test.ts'],
    testTimeout: 60_000,
    silent: false,
    reporters: ['verbose'],
    typecheck: {
      tsconfig: 'tsconfig.test.json',
    },
  },
  define: {
    'import.meta.vitest': false,
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
