import fs from 'node:fs/promises';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import serverPackage from '../package.json' with { type: 'json' };

const ALL_TARGETS = [
  'linux-x64',
  'linux-arm64',
  'windows-x64',
  'macos-x64',
  'macos-arm64',
];

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
  .parseAsync();

for (const arch of args.target) {
  let name = 'tunarr';
  if (args.includeVersion) {
    name += `-${serverPackage.version}`
  }
  name += `-${arch}`;
  if (arch.startsWith('windows')) {
    name += '.exe'
  }
  const process = Bun.spawnSync([
    'bun',
    'build',
    '--compile',
    '--asset-naming',
    '[name].[ext]',
    ...(args.sourcemap ? ['--sourcemap'] : []),
    'src/index.ts',
    '--outfile',
    `dist/bin/${name}`
  ]);

  if (process.success) {
    console.info(`Successfully built ${name}`)
  }
}
