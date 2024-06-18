/* eslint-disable @typescript-eslint/no-floating-promises */
import constants from '@tunarr/shared/constants';
import chalk from 'chalk';
import { isArray, isString, keys } from 'lodash-es';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'path';
import { ArgumentsCamelCase } from 'yargs';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import {
  LegacyDbMigrator,
  MigratableEntities,
} from './dao/legacy_migration/legacyDbMigration.js';
import { getSettings } from './dao/settings.js';
import {
  ServerOptions,
  setGlobalOptions,
  setServerOptions,
} from './globals.js';
import { initDbDirectories, initServer } from './server.js';
import { getDefaultLogLevel } from './util/logging/LoggerFactory.js';
import {
  DATABASE_LOCATION_ENV_VAR,
  SERVER_PORT_ENV_VAR,
} from './util/constants.js';
import { initOrm, withDb } from './dao/dataSource.js';
import { FixersByName } from './tasks/fixers/index.js';
import { isNonEmptyString } from './util/index.js';

const maybeEnvPort = () => {
  const port = process.env[SERVER_PORT_ENV_VAR];
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
    default: getDefaultLogLevel(),
  })
  .option('verbose', {
    alias: 'v',
    count: true,
  })
  .option('database', {
    alias: 'd',
    type: 'string',
    desc: 'Path to the database directory',
    default:
      process.env[DATABASE_LOCATION_ENV_VAR] ??
      path.join('.', constants.DEFAULT_DATA_DIR),
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
          default: Boolean(process.env['TUNARR_SERVER_PRINT_ROUTES']),
        });
    },
    async (args: ArgumentsCamelCase<ServerOptions>) => {
      const serverOpts = setServerOptions(args);
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
      await initServer(serverOpts);
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
        });
    },
    async (args: ArgumentsCamelCase<ServerOptions>) => {
      const serverOpts = setServerOptions(args);
      const { app: f } = await initServer(serverOpts);
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
    'Migrate from the legacy .dizquetv database',
    (yargs) => {
      return yargs
        .option('legacy_path', {
          type: 'string',
          default: path.join(process.cwd(), '.dizquetv'),
          coerce(arg: string) {
            if (!existsSync(arg)) {
              throw new Error(`No directory found at ${arg}`);
            }
            return arg;
          },
        })
        .option('entities', {
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
      return await new LegacyDbMigrator(
        getSettings(),
        argv.legacy_path,
      ).migrateFromLegacyDb(argv.entities);
    },
  )
  .command(
    'db [sub]',
    'Run database commands',
    (yargs) => {
      return yargs
        .positional('sub', {
          type: 'string',
          choices: ['generate-migration', 'init'],
          demandOption: true,
        })
        .option('blank', {
          type: 'boolean',
          alias: 'b',
          default: false,
        });
    },
    async (
      args: ArgumentsCamelCase<
        ServerOptions & { sub: string; blank?: boolean }
      >,
    ) => {
      setServerOptions(args);
      switch (args.sub) {
        case 'init': {
          await initDbDirectories();
          break;
        }
        case 'generate-migration': {
          const orm = await initOrm();

          const result = await orm.migrator.createMigration(
            undefined,
            args.blank,
          );

          console.log(result.code);

          break;
        }
        default: {
          console.error('Invalid subcommand: %s', args.sub);
          process.exit(1);
        }
      }
      process.exit(0);
    },
  )
  .command(
    'fixer [sub]',
    'Run a specific fixer task',
    (yargs) =>
      yargs.positional('sub', {
        type: 'string',
        choices: keys(FixersByName),
        demandOption: true,
      }),
    async (args: ArgumentsCamelCase<ServerOptions & { sub: string }>) => {
      setServerOptions(args);
      if (isNonEmptyString(args.sub)) {
        try {
          await withDb(async () => {
            await FixersByName[args.sub].run();
          });
          process.exit(0);
        } catch (e) {
          console.error('Fixer failed', e);
          process.exit(1);
        }
      } else {
        console.error('Specify a fixer to run');
        process.exit(1);
      }
    },
  )
  .help()
  .parseAsync();
