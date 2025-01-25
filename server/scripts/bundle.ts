import 'dotenv/config';
import esbuild from 'esbuild';
import esbuildPluginPino from 'esbuild-plugin-pino';
import fg from 'fast-glob';
import fs from 'node:fs';
import { basename } from 'node:path';
import { rimraf } from 'rimraf';
import { nativeNodeModulesPlugin } from '../esbuild/native-node-module.js';
import { nodeProtocolPlugin } from '../esbuild/node-protocol.js';

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

console.log('Bundling app...');
const result = await esbuild.build({
  entryPoints: {
    bundle: 'src/index.ts',
  },
  bundle: true,
  minify: true,
  outdir: DIST_DIR,
  logLevel: 'info',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  inject: ['cjs-shim.ts', './esbuild/bundlerPathsOverrideShim.ts'],
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
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.TUNARR_BUILD': `"${process.env.TUNARR_BUILD}"`,
    'process.env.TUNARR_EDGE_BUILD': `"${isEdgeBuild}"`,
  },
});

fs.writeFileSync(`${DIST_DIR}/meta.json`, JSON.stringify(result.metafile));

fs.cpSync('package.json', `${DIST_DIR}/package.json`);

const nativeBindings = await fg('node_modules/better-sqlite3/**/*.node');
for (const binding of nativeBindings) {
  console.log(`Copying ${binding} to out dir`);
  fs.cpSync(binding, `${DIST_DIR}/build/${basename(binding)}`);
}

// console.log('Bundling DB migrations...');
// await esbuild.build({
//   entryPoints: await fg('src/migrations/*'),
//   outdir: 'build/migrations',
//   logLevel: 'debug',
//   bundle: false,
//   packages: 'external',
//   tsconfig: './tsconfig.build.json',
// });

// console.log('Copying DB snapshot JSON');
// fs.cpSync(
//   'src/migrations/.snapshot-db.db.json',
//   'build/migrations/.snapshot-db.db.json',
// );

console.log('Done bundling!');
process.exit(0);
