import dotenv from '@dotenvx/dotenvx';
dotenv.config({ debug: false, quiet: true, ignore: ['MISSING_ENV_FILE'] });

import { bootstrapTunarr } from '@/bootstrap.js';
import { setGlobalOptions } from '@/globals.js';
import {
  getDefaultDatabaseDirectory,
  getDefaultLogLevel,
} from '@/util/defaults.js';
import type { LogLevels } from '@/util/logging/LoggerFactory.js';
import { ValidLogLevels } from '@/util/logging/LoggerFactory.js';
import { getTunarrVersion } from '@/util/version.js';
import { dayjsMod } from '@tunarr/shared/util';
import chalk from 'chalk';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import { fileURLToPath } from 'node:url';
import 'reflect-metadata';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import { commands } from './cli/commands.ts';

// Extend this here once so we don't have to worry about
// it elsewhere in the app.
dayjs.extend(duration);
dayjs.extend(dayjsMod);

function printBanner() {
  console.log(
    `
${chalk.blue(' _____')} ${chalk.green('_   _')}${chalk.yellow(
      ' _  _ ',
    )}${chalk.magentaBright('  _   ')}${chalk.red('___ ')}${chalk.cyan('___ ')}
${chalk.blue('|_   _|')}${chalk.green(' | | | ')}${chalk.yellow(
      '\\| |',
    )}${chalk.magentaBright(' /_\\ ')}${chalk.red('| _ \\')}${chalk.cyan(
      ' _ \\',
    )}
${chalk.blue('  | | ')}${chalk.green('| |_| |')}${chalk.yellow(
      ' .` |',
    )}${chalk.magentaBright('/ _ \\')}${chalk.red('|   /')}${chalk.cyan('   /')}
${chalk.blue('  |_| ')}${chalk.green(' \\___/')}${chalk.yellow(
      '|_|\\_/',
    )}${chalk.magentaBright('_/ \\_\\')}${chalk.red('_|_\\')}${chalk.cyan(
      '_|_\\',
    )}
\n\t  ${getTunarrVersion()}
`,
  );
}

yargs(hideBin(process.argv))
  .scriptName('tunarr')
  .option('log_level', {
    type: 'string',
    choices: ValidLogLevels,
    default: getDefaultLogLevel(),
    coerce(arg) {
      return arg as LogLevels;
    },
  })
  .option('verbose', {
    alias: 'v',
    count: true,
  })
  .option('database', {
    alias: 'd',
    type: 'string',
    desc: 'Path to the database directory',
    default: getDefaultDatabaseDirectory(),
    normalize: true,
    coerce: (db: string) => fileURLToPath(new URL(`file://${db}`)),
  })
  .option('hide_banner', {
    type: 'boolean',
    default: false,
  })
  .middleware([
    ({ hide_banner }) => (hide_banner ? void 0 : printBanner()),
    (opts) => setGlobalOptions(opts),
    () => bootstrapTunarr(),
  ])
  .version(getTunarrVersion())
  .command(commands)
  .help()
  .parseAsync()
  .catch(console.error);
