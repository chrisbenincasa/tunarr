import { fileURLToPath } from 'node:url';
import path from 'path';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import constants from './constants.js';
import { getDB, getDBRaw } from './dao/db.js';
import createLogger from './logger.js';
import { inspect } from 'util';
import { ArgumentsCamelCase } from 'yargs';
import { ServerOptions } from './types.js';
import { setGlobalOptions, setServerOptions } from './globals.js';

const logger = createLogger(import.meta);

export const argv = await yargs(hideBin(process.argv))
  .scriptName('dizquetv')
  .option('database', {
    alias: 'd',
    type: 'string',
    desc: 'Path to the database directory',
    default: path.join('.', constants.DEFAULT_DATA_DIR),
    normalize: true,
    coerce: (db) => fileURLToPath(new URL(db, import.meta.url)),
  })
  .option('force_migration', {
    type: 'boolean',
    desc: 'Forces a migration from a legacy dizque database. Useful for development and debugging. NOTE: This WILL override any settings you have!',
    default: false,
  })
  .middleware(setGlobalOptions)
  .command(
    ['server', '$0'],
    'Run the dizqueTV server',
    (yargs) => {
      return yargs
        .option('port', {
          alias: 'p',
          type: 'number',
          desc: 'The port to run the dizque server on',
          default: 8000,
        })
        .middleware(setServerOptions);
    },
    async (args: ArgumentsCamelCase<ServerOptions>) => {
      return (await import('./server.js')).initServer(args);
    },
  )
  .command(
    'db [command]',
    'Perform operations on the DB',
    (yargs) => {
      return yargs.positional('command', {
        choices: ['print', 'migrate'] as const,
        demandOption: true,
      });
    },
    async (argv) => {
      switch (argv.command) {
        case 'print':
          logger.info('Printing DB contents.');
          const db = await getDBRaw();
          console.log(inspect(db.data, undefined, null));
          return;
        case 'migrate':
          logger.info('Migrating DB from legacy schema...');
          return await getDB().then((db) => db.migrateFromLegacyDb());
      }
    },
  )
  .help()
  .parse();
