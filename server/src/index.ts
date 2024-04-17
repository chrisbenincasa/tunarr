/* eslint-disable @typescript-eslint/no-floating-promises */
import constants from '@tunarr/shared/constants';
import chalk from 'chalk';
import { isArray, isString } from 'lodash-es';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'path';
import { ArgumentsCamelCase } from 'yargs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import {
  MigratableEntities,
  migrateFromLegacyDb,
} from './dao/legacyDbMigration.js';
import { getSettingsRawDb } from './dao/settings.js';
import { setGlobalOptions, setServerOptions } from './globals.js';
import { initServer } from './server.js';
import { ServerOptions } from './types.js';
import { isProduction } from './util/index.js';

const maybeEnvPort = () => {
  const port = process.env['TUNARR_SERVER_PORT'];
  if (!port) {
    return;
  }

  const parsed = parseInt(port);
  return isNaN(parsed) ? undefined : parsed;
};

yargs(hideBin(process.argv))
  .scriptName('tunarr')
  .option('log_level', {
    type: 'string',
    default: isProduction ? 'info' : 'debug',
  })
  .option('verbose', {
    alias: 'v',
    count: true,
  })
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
  .middleware((opts) =>
    setGlobalOptions({ ...opts, databaseDirectory: opts.database }),
  )
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
          default: maybeEnvPort() ?? 8000,
        })
        .option('printRoutes', {
          type: 'boolean',
          default: false,
        })
        .middleware((opts) =>
          setServerOptions({ ...opts, databaseDirectory: opts.database }),
        );
    },
    async (args: ArgumentsCamelCase<ServerOptions>) => {
      /* eslint-disable max-len */
      console.log(
        `
${chalk.blue(' _____')} ${chalk.green('_   _')}${chalk.yellow(
          ' _  _ ',
        )}${chalk.magentaBright('  _   ')}${chalk.red('___ ')}${chalk.cyan(
          '___ ',
        )}
${chalk.blue('|_   _|')}${chalk.green(' | | | ')}${chalk.yellow(
          '\\| |',
        )}${chalk.magentaBright(' /_\\ ')}${chalk.red('| _ \\')}${chalk.cyan(
          ' _ \\',
        )}
${chalk.blue('  | | ')}${chalk.green('| |_| |')}${chalk.yellow(
          ' .` |',
        )}${chalk.magentaBright('/ _ \\')}${chalk.red('|   /')}${chalk.cyan(
          '   /',
        )}
${chalk.blue('  |_| ')}${chalk.green(' \\___/')}${chalk.yellow(
          '|_|\\_/',
        )}${chalk.magentaBright('_/ \\_\\')}${chalk.red('_|_\\')}${chalk.cyan(
          '_|_\\',
        )}
\n\t\t${constants.VERSION_NAME}
`,
        /* eslint-enable max-len */
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
          default: maybeEnvPort() ?? 8000,
        })
        .option('printRoutes', {
          type: 'boolean',
          default: false,
        })
        .middleware((opts) =>
          setServerOptions({ ...opts, databaseDirectory: opts.database }),
        );
    },
    async (args: ArgumentsCamelCase<ServerOptions>) => {
      const { app: f } = await initServer(args);
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
      console.log('Migrating DB from legacy schema...');
      return await getSettingsRawDb().then((db) =>
        migrateFromLegacyDb(db, argv.entities),
      );
    },
  )
  .help()
  .parseAsync();
