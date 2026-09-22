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
    // Scope collection to source. Vitest 4 dropped `**/dist/**` from the
    // default excludes, so without this the compiled copies in dist/ run
    // alongside their sources, and a test deleted from src/ keeps running
    // from a stale build output until someone cleans it.
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
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
