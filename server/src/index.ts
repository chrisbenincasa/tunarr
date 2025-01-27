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
    coerce: (db: string) =>
      fileURLToPath(new URL(`file://${db}`, import.meta.url)),
  })
  .option('force_migration', {
    type: 'boolean',
    desc: 'Forces a migration from a legacy dizquetv database. Useful for development and debugging. NOTE: This WILL override any settings you have!',
    default: false,
  })
  .middleware([(opts) => setGlobalOptions(opts), () => bootstrapTunarr()])
  .version(getTunarrVersion())
  .command(commands)
  .help()
  .parseAsync();
