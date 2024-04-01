import { copy } from 'esbuild-plugin-copy';
import fg from 'fast-glob';
import path from 'node:path';
import { defineConfig } from 'tsup';
import { mikroOrmProdPlugin } from './esbuild/mikro-orm-prod-plugin.js';
import { nativeNodeModulesPlugin } from './esbuild/native-node-module.js';
import { nodeProtocolPlugin } from './esbuild/node-protocol.js';

const migrations = await fg('src/migrations/*');

const migrationEntries = migrations
  .map((m) => ({
    [`migrations/${path.basename(m).replace('.ts', '')}`]: m,
  }))
  .reduce((prev, curr) => ({ ...prev, ...curr }));

export default defineConfig({
  entry: { index: 'src/index.ts', ...migrationEntries },
  splitting: false,
  sourcemap: 'inline',
  clean: true,
  format: 'esm',
  shims: true,
  inject: ['cjs-shim.ts'],
  noExternal: [
    /^((?!(mysql|mysql2|sqlite3|pg|tedious|pg-query-stream|oracledb)).)*$/,
  ],
  external: [
    'mysql',
    'mysql2',
    'sqlite3',
    'pg',
    'tedious',
    'pg-query-stream',
    'oracledb',
    'assert',
  ],
  esbuildPlugins: [
    mikroOrmProdPlugin(),
    nativeNodeModulesPlugin(),
    nodeProtocolPlugin(),
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: ['node_modules/@fastify/swagger-ui/static/*'],
        to: ['build/static'],
      },
    }),
  ],
  silent: false,
  metafile: true,
});
