import { compile } from 'nexe';
import fs from 'node:fs/promises';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const NODE_VERSION = '20.11.1';
const OSX_TARGET = `macos-x64-${NODE_VERSION}`;
const LINUX_TARGET = `linux-x64-${NODE_VERSION}`;
const WINDOWS_TARGET = `windows-x64-${NODE_VERSION}`;
const ALL_TARGETS = [OSX_TARGET, LINUX_TARGET, WINDOWS_TARGET] as const;

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
  .option('build', {
    type: 'boolean',
    default: true,
  })
  .option('python', {
    type: 'string',
    default: 'python3',
  })
  .option('tempdir', {
    type: 'string',
  })
  .parseAsync();

// Copy over the bundled webapp for packaging. We could
// probably symlink this but the compiled webapp is so
// lightweight that this isn't a huge deal.
await fs.cp(path.resolve(process.cwd(), '../web/dist'), './build/web', {
  recursive: true,
});

for (const target of args.target) {
  let binaryName: string;
  switch (target) {
    case 'macos-x64-20.11.1':
      binaryName = 'tunarr-macos-x64';
      break;
    case 'linux-x64-20.11.1':
      binaryName = 'tunarr-linux-x64';
      break;
    case 'windows-x64-20.11.1':
      binaryName = 'tunarr-windows-x64.exe';
      break;
  }

  const sanitizedTargetName =
    target === 'macos-x64-20.11.1' ? target.replace('macos', 'mac') : target;

  await compile({
    input: 'bundle.js',
    name: binaryName,
    cwd: './build',
    targets: [sanitizedTargetName],
    build: false,
    loglevel: 'verbose',
    bundle: false,
    resources: [
      'package.json',
      './migrations/**/*',
      // NOTE: When building the executable, we need to make sure that
      // we are on the same arch type as the target so we copy in the
      // correct native bindings.
      './build/better_sqlite3.node',
      './resources/**/*',
      './static/**/*', // Swagger -- TODO: Change this path
      './web/**',
    ],
    python: args.python,
    temp: args.tempdir,
    verbose: true, //target === 'windows-x64-20.11.1',
    remote:
      'https://github.com/chrisbenincasa/tunarr/releases/download/nexe-prebuild/',
  });
}
