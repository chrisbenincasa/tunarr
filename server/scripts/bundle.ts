import esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy';
import fg from 'fast-glob';
import fs from 'node:fs';
import { basename } from 'node:path';
import { rimraf } from 'rimraf';
import { mikroOrmProdPlugin } from '../esbuild/mikro-orm-prod-plugin.js';
import { nativeNodeModulesPlugin } from '../esbuild/native-node-module.js';
import { nodeProtocolPlugin } from '../esbuild/node-protocol.js';

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
const result = await esbuild.build({
  entryPoints: {
    bundle: 'src/index.ts',
  },
  bundle: true,
  minify: false,
  outdir: 'build',
  logLevel: 'info',
  // We can't make this mjs yet because mikro-orm breaks
  // when using cached metadata w/ not js/ts suffixes:
  // https://github.com/mikro-orm/mikro-orm/blob/e005cc22ef4e247f9741bdcaf1af012337977b7e/packages/core/src/cache/GeneratedCacheAdapter.ts#L16
  format: 'esm',
  platform: 'node',
  target: 'node18',
  inject: ['cjs-shim.ts'],
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
    mikroOrmProdPlugin(),
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: ['node_modules/@fastify/swagger-ui/static/*'],
        to: ['build/static'],
      },
    }),
  ],
  keepNames: true, // This is to ensure that Entity class names remain the same
  metafile: true,
  define: {
    // Hack to ensure this is set in the resultant bundle
    // For some reason mikro-orm cannot resolve its own package.json
    // in the bundle, even though it's definitely in there...
    // We know we have matching versions, so just override this for "prod"
    'process.env.MIKRO_ORM_ALLOW_VERSION_MISMATCH': 'true',
    'process.env.NODE_ENV': '"production"',
  },
});

fs.writeFileSync('build/meta.json', JSON.stringify(result.metafile));

fs.cpSync('package.json', 'build/package.json');

const nativeBindings = await fg('node_modules/better-sqlite3/**/*.node');
for (const binding of nativeBindings) {
  console.log(`Copying ${binding} to build dir`);
  fs.cpSync(binding, 'build/build/' + basename(binding));
}

console.log('Bundling DB migrations...');
await esbuild.build({
  entryPoints: await fg('src/migrations/*'),
  outdir: 'build/migrations',
  logLevel: 'debug',
  bundle: false,
  packages: 'external',
  tsconfig: './tsconfig.build.json',
});

console.log('Copying DB snapshot JSON');
fs.cpSync(
  'src/migrations/.snapshot-db.db.json',
  'build/migrations/.snapshot-db.db.json',
);

console.log('Done bundling!');
process.exit(0);
