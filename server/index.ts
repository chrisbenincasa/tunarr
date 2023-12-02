/* eslint-disable @typescript-eslint/no-floating-promises */
import { fileURLToPath } from 'node:url';
import path from 'path';
import { inspect } from 'util';
import { ArgumentsCamelCase } from 'yargs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import constants from './constants.js';
import { getDB, getDBRaw } from './dao/db.js';
import { migrateToLatest, resetDb } from './dao/migrator.js';
import { setGlobalOptions, setServerOptions } from './globals.js';
import createLogger from './logger.js';
import { ServerOptions } from './types.js';
import { time } from './util.js';

const logger = createLogger(import.meta);

time('parse', () =>
  yargs(hideBin(process.argv))
    .scriptName('dizquetv')
    .option('database', {
      alias: 'd',
      type: 'string',
      desc: 'Path to the database directory',
      default: path.join('.', constants.DEFAULT_DATA_DIR),
      normalize: true,
      coerce: (db: string) => fileURLToPath(new URL(db, import.meta.url)),
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
          choices: ['print', 'migrate', 'legacy-migrate', 'reset'] as const,
          demandOption: true,
        });
      },
      async (argv) => {
        switch (argv.command) {
          case 'print':
            logger.info('Printing DB contents.');
            console.log(inspect((await getDBRaw()).data, undefined, null));
            return;
          case 'legacy-migrate':
            logger.info('Migrating DB from legacy schema...');
            return await getDB().then((db) => db.migrateFromLegacyDb());
          case 'migrate':
            return migrateToLatest();
          case 'reset':
            return resetDb();
        }
      },
    )
    .help()
    .parse(),
);
