import { defineConfig } from 'tsup';

export default defineConfig((opts) => ({
  entry: {
    index: 'src/index.ts',
    'schemas/index': 'src/schemas/index.ts',
    'plex/index': 'src/plex/index.ts',
    'api/index': 'src/api/index.ts',
    'jellyfin/index': 'src/jellyfin/index.ts',
  },
  format: 'esm',
  dts: !!opts.dts,
  outDir: 'build',
  splitting: false,
  sourcemap: false,
  target: 'esnext',
}));
