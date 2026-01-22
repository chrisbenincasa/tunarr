import '@dotenvx/dotenvx/config';

import esbuild from 'esbuild';
import fg from 'fast-glob';
import fs from 'node:fs';
import { basename } from 'node:path';
import { format } from 'node:util';
import { rimraf } from 'rimraf';
import { nativeNodeModulesPlugin } from '../esbuild/native-node-module.ts';
import { nodeProtocolPlugin } from '../esbuild/node-protocol.ts';

import { trimStart } from 'lodash-es';
import { createRequire } from 'node:module';
import { generateEnvModule } from './generateEnvModule.ts';
const __require = createRequire(import.meta.url);
const esbuildPluginPino = __require('esbuild-plugin-pino');

const DIST_DIR = 'dist';

if (fs.existsSync(DIST_DIR)) {
  console.log('Deleting old build...');
  await rimraf(DIST_DIR);
}

fs.mkdirSync(DIST_DIR);

console.log('Copying images...');
fs.cpSync('src/resources/images', `${DIST_DIR}/resources/images`, {
  recursive: true,
});

const isEdgeBuild = process.env.TUNARR_EDGE_BUILD === 'true';

// TODO: Do we want to hard-code any TUNARR_ prefixed environment variables at build time?
await generateEnvModule([
  'NODE_ENV',
  'TUNARR_VERSION',
  'TUNARR_BUILD',
  'TUNARR_EDGE_BUILD',
]);
const define = {
  'process.env.NODE_ENV': '"production"',
  'process.env.TUNARR_VERSION': `"${trimStart(process.env.TUNARR_VERSION, 'v')}"`,
  'process.env.TUNARR_BUILD': `"${process.env.TUNARR_BUILD}"`,
  'process.env.TUNARR_EDGE_BUILD': `"${isEdgeBuild}"`,
  'import.meta.url': '__import_meta_url',
};

console.debug(format('Building with Tunarr env: %O', define));

console.log('Bundling app...');
const result = await esbuild.build({
  entryPoints: {
    bundle: 'src/index.ts',
  },
  outExtension: {
    '.js': '.cjs',
  },
  bundle: true,
  minify: true,
  outdir: DIST_DIR,
  logLevel: 'info',
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  inject: [
    './esbuild/bundlerPathsOverrideShim.ts',
    './esbuild/importMetaUrlShim.ts',
  ],
  tsconfig: './tsconfig.build.json',
  external: [
    'mysql',
    'mysql2',
    'sqlite3',
    'pg',
    'tedious',
    'pg-query-stream',
    'oracledb',
    'mariadb',
    'libsql',
  ],
  mainFields: ['module', 'main'],
  plugins: [
    nativeNodeModulesPlugin(),
    nodeProtocolPlugin(),
    // copy({
    //   resolveFrom: 'cwd',
    //   assets: {
    //     from: ['node_modules/@fastify/swagger-ui/static/*'],
    //     to: ['build/static'],
    //   },
    // }),
    esbuildPluginPino({
      transports: ['pino-pretty', 'pino-roll'],
    }),
  ],
  keepNames: true, // This is to ensure that Entity class names remain the same
  metafile: true,
  define,
});

fs.writeFileSync(`${DIST_DIR}/meta.json`, JSON.stringify(result.metafile));

fs.cpSync('package.json', `${DIST_DIR}/package.json`);

const nativeBindings = await fg('node_modules/better-sqlite3/**/*.node');
for (const binding of nativeBindings) {
  console.log(`Copying ${binding} to out dir`);
  fs.cpSync(binding, `${DIST_DIR}/build/${basename(binding)}`);
}

console.log('Done bundling!');
process.exit(0);
