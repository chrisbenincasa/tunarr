import esbuild from 'esbuild';
import { nativeNodeModulesPlugin } from '../esbuild/native-node-module.js';
import { nodeProtocolPlugin } from '../esbuild/node-protocol.js';
import fs from 'node:fs';
import fg from 'fast-glob';
import { rimraf } from 'rimraf';

if (fs.existsSync('build')) {
  console.log('Deleting old build...');
  await rimraf('build');
}

fs.mkdirSync('build');

console.log('Copying images...');
fs.cpSync('src/resources/images', 'build/resources/images', {
  recursive: true,
});

console.log('Bundling app...');
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  // minify: true,
  // We can't make this mjs yet because mikro-orm breaks
  // when using cached metadata w/ not js/ts suffixes:
  // https://github.com/mikro-orm/mikro-orm/blob/e005cc22ef4e247f9741bdcaf1af012337977b7e/packages/core/src/cache/GeneratedCacheAdapter.ts#L16
  outfile: 'build/bundle.js',
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  inject: ['cjs-shim.ts'],
  packages: 'external',
  tsconfig: './tsconfig.build.json',
  // external: [
  //   'mysql',
  //   'mysql2',
  //   'sqlite3',
  //   'pg',
  //   'tedious',
  //   'pg-query-stream',
  //   'oracledb',
  //   'assert',
  // ],
  mainFields: ['module', 'main'],
  plugins: [nativeNodeModulesPlugin(), nodeProtocolPlugin()],
});

console.log('Bundling DB migrations...');
await esbuild.build({
  entryPoints: await fg('src/migrations/*'),
  outdir: 'build/migrations',
  bundle: false,
  packages: 'external',
  tsconfig: './tsconfig.build.json',
});

fs.cpSync(
  'src/migrations/.snapshot-db.db.json',
  'build/migrations/.snapshot-db.db.json',
);
