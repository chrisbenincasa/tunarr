import Bun from 'bun';
import { bunPluginPino } from 'bun-plugin-pino';
import fs from 'node:fs';
import { rimraf } from 'rimraf';

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

process.env.NODE_ENV = 'production';

await Bun.build({
  entrypoints: ['src/index.ts'],
  outdir: DIST_DIR,
  target: 'bun',
  naming: '[dir]/bundle.[ext]',
  minify: {
    whitespace: true,
    identifiers: false,
    syntax: true,
  },
  sourcemap: 'linked',
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
  plugins: [
    bunPluginPino({
      transports: ['pino-pretty', 'pino-roll'],
      logging: 'quiet',
    }),
  ],
});

fs.cpSync('package.json', `${DIST_DIR}/package.json`);
console.log('Done bundling!');
process.exit(0);
