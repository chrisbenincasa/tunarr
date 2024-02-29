import esbuild from 'esbuild';

await esbuild.build({
  // entryPoints: ['build/index.js'],
  entryPoints: ['index.ts'],
  bundle: true,
  outfile: 'build/bundle.js',
  format: 'iife',
  platform: 'node',
  target: 'node18',
  packages: 'external',
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
  mainFields: ['module', 'main'],
});
