import { compile } from 'nexe';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const NODE_VERSION = '20.11.1';
const OSX_TARGET = `mac-x64-${NODE_VERSION}`;
const LINUX_TARGET = `linux-x64-${NODE_VERSION}`;
const ALL_TARGETS = [OSX_TARGET, LINUX_TARGET] as const;

const args = await yargs(hideBin(process.argv))
  .scriptName('tunarr-make-exec')
  .option('target', {
    alias: 't',
    type: 'string',
    choices: ALL_TARGETS,
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

let binaryName: string;
switch (args.target) {
  case 'mac-x64-20.11.1':
    binaryName = 'tunarr-macos-x64';
    break;
  case 'linux-x64-20.11.1':
    binaryName = 'tunarr-linux-x64';
    break;
}

await compile({
  input: 'bundle.js',
  name: binaryName,
  cwd: './build',
  targets: [args.target],
  build: true,
  bundle: false,
  resources: [
    './migrations/**/*',
    './build/better_sqlite3.node',
    './resources/**/*',
  ],
  python: args.python,
  temp: args.tempdir,
});
