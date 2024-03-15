import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'constants/index': 'src/util/constants.ts',
    'util/index': 'src/util/index.ts',
    'types/index': 'src/types/index.ts',
  },
  dts: true,
  splitting: false,
  format: 'esm',
  outDir: 'build',
  sourcemap: true,
});
