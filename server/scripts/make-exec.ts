import fs from 'node:fs/promises';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import serverPackage from '../package.json' with { type: 'json' };

const ALL_TARGETS = [
  'linux-x64',
  'linux-x64-baseline',
  'linux-arm64',
  'windows-x64',
  'windows-x64-baseline',
  'macos-x64',
  'macos-x64-baseline',
  'macos-arm64',
] as const;

const isEdgeBuild = process.env['TUNARR_EDGE_BUILD'] === 'true';

await fs.cp(path.resolve(process.cwd(), '../web/dist'), './dist/web', {
  recursive: true,
});

const args = await yargs(hideBin(process.argv))
  .scriptName('tunarr-make-exec')
  .option('target', {
    alias: 't',
    type: 'string',
    array: true,
    choices: ALL_TARGETS,
    default: ALL_TARGETS,
  })
  .demandOption('target')
  .option('sourcemap', {
    type: 'boolean',
    default: true,
  })
  .option('include-version', {
    type: 'boolean',
    default: true,
  })
  .option('strip-baseline-name', {
    type: 'boolean',
    default: false,
  })
  .parseAsync();

for (const arch of args.target) {
  let name = 'tunarr';
  if (args.includeVersion && !isEdgeBuild) {
    name += `-${serverPackage.version}`;
  }
  name += `-${arch}`;
  if (arch.startsWith('windows')) {
    name += '.exe';
  }

  if (args.stripBaselineName) {
    name = name.replaceAll('-baseline', '');
  }

  const process = Bun.spawnSync([
    'bun',
    'build',
    '--compile',
    '--minify-whitespace',
    '--minify-syntax',
    '--target',
    `bun-${arch}`,
    '--asset-naming',
    '[name].[ext]',
    '--env',
    `'TUNARR_*'`,
    ...(args.sourcemap ? ['--sourcemap'] : []),
    'src/index.ts',
    '--outfile',
    `dist/bin/${name}`,
  ]);

  if (process.success) {
    console.info(`Successfully built dist/bin/${name}`);
  } else {
    console.error(`Failed to build dist/bin/${name}`, process.exitCode);
    for (const line of process.stderr.toString('utf-8').split('\n')) {
      console.error(line);
    }
  }
}
