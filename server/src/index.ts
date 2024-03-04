/* eslint-disable @typescript-eslint/no-floating-promises */
import { isArray, isString } from 'lodash-es';
import { fileURLToPath } from 'node:url';
import path from 'path';
import { ArgumentsCamelCase } from 'yargs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import constants from './constants.js';
import {
  MigratableEntities,
  migrateFromLegacyDb,
} from './dao/legacyDbMigration.js';
import { getSettingsRawDb } from './dao/settings.js';
import { setGlobalOptions, setServerOptions } from './globals.js';
import createLogger from './logger.js';
import { ServerOptions } from './types.js';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { initServer } from './server.js';

const logger = createLogger(import.meta);

yargs(hideBin(process.argv))
  .scriptName('tunarr')
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
    desc: 'Forces a migration from a legacy dizquetv database. Useful for development and debugging. NOTE: This WILL override any settings you have!',
    default: false,
  })
  .middleware(setGlobalOptions)
  .command('version', 'Print the current version', () => {
    console.log(constants.VERSION_NAME);
  })
  .command(
    ['server', '$0'],
    'Run the Tunarr server',
    (yargs) => {
      return yargs
        .option('port', {
          alias: 'p',
          type: 'number',
          desc: 'The port to run the Tunarr server on',
          default: 8000,
        })
        .option('printRoutes', {
          type: 'boolean',
          default: false,
        })
        .middleware(setServerOptions);
    },
    async (args: ArgumentsCamelCase<ServerOptions>) => {
      console.log(
        `         \\
         Tunarr ${constants.VERSION_NAME}
      .------------.
      |:::///### o |
      |:::///###   |
      ':::///### o |
      '------------'
      `,
      );
      await initServer(args);
    },
  )
  .command(
    'generate-openapi',
    'Generate OpenAPI schema which in turn is used to generate a well-typed API client',
    (yargs) => {
      return yargs
        .option('port', {
          alias: 'p',
          type: 'number',
          desc: 'The port to run the Tunarr server on',
          default: 8000,
        })
        .middleware(setServerOptions);
    },
    async (args: ArgumentsCamelCase<ServerOptions>) => {
      const f = await initServer(args);
      const x = await f
        .inject({ method: 'get', url: '/docs/json' })
        .then((r) => r.body);
      await f.close();
      if (!existsSync('out')) {
        await mkdir('out');
      }

      await writeFile('out/openapi_schema.yaml', Buffer.from(x));
      process.exit(0);
    },
  )
  .command(
    'legacy-migrate',
    'Migrate from the legacy .dizquetv/ database',
    (yargs) => {
      return yargs.option('entities', {
        type: 'array',
        choices: MigratableEntities,
        coerce(arg) {
          if (isArray(arg)) {
            return arg as string[];
          } else if (isString(arg)) {
            return arg.split(',');
          } else {
            throw new Error('Bad arg');
          }
        },
      });
    },
    async (argv) => {
      logger.info('Migrating DB from legacy schema...');
      return await getSettingsRawDb().then((db) =>
        migrateFromLegacyDb(db, argv.entities),
      );
    },
  )
  .help()
  .parse();
