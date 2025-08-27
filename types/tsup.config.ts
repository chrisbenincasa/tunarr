import { defineConfig } from 'tsup';

export default defineConfig((opts) => ({
  entry: {
    index: 'src/index.ts',
    'schemas/index': 'src/schemas/index.ts',
    'plex/index': 'src/plex/index.ts',
    'api/index': 'src/api/index.ts',
    'jellyfin/index': 'src/jellyfin/index.ts',
    'emby/index': 'src/emby/index.ts',
  },
  format: 'esm',
  dts: !!opts.dts,
  outDir: 'dist',
  splitting: false,
  sourcemap: false,
  target: 'esnext',
}));
