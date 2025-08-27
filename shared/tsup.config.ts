import { defineConfig } from 'tsup';

export default defineConfig((opts) => ({
  entry: {
    index: 'src/index.ts',
    'constants/index': 'src/util/constants.ts',
    'util/index': 'src/util/index.ts',
    'types/index': 'src/types/index.ts',
  },
  dts: !!opts.dts,
  splitting: false,
  format: 'esm',
  outDir: 'dist',
  sourcemap: true,
  tsconfig: 'tsconfig.prod.json',
}));
