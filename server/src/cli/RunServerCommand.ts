import chalk from 'chalk';
import { ArgumentsCamelCase, CommandModule } from 'yargs';
import { setServerOptions } from '../globals.ts';
import { initServer } from '../server.ts';
import { TruthyQueryParam } from '../types/schemas.ts';
import { getDefaultServerPort } from '../util/defaults.ts';
import { isNonEmptyString, isProduction } from '../util/index.ts';
import { getTunarrVersion } from '../util/version.ts';
import { GlobalArgsType } from './types.ts';

export type ServerArgsType = GlobalArgsType & {
  port: number;
  printRoutes: boolean;
  admin: boolean;
};

export const RunServerCommand: CommandModule<GlobalArgsType, ServerArgsType> = {
  command: ['server', '$0'],
  describe: 'Run the Tunarr server',
  builder: {
    port: {
      alias: 'p',
      type: 'number',
      desc: 'The port to run the Tunarr server on',
      default: getDefaultServerPort,
    },
    printRoutes: {
      type: 'boolean',
      default: () =>
        TruthyQueryParam.catch(false).parse(
          process.env['TUNARR_SERVER_PRINT_ROUTES'],
        ),
    },
    admin: {
      type: 'boolean',
      default: () => {
        if (isNonEmptyString(process.env['TUNARR_SERVER_ADMIN_MODE'])) {
          return TruthyQueryParam.catch(false).parse(
            process.env['TUNARR_SERVER_ADMIN_MODE'],
          );
        }
        return !isProduction;
      },
    },
  },
  handler: async (args: ArgumentsCamelCase<ServerArgsType>) => {
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
\n\t  ${getTunarrVersion()}
`,
      serverOpts.admin ? chalk.yellow('\n  ****** ADMIN MODE *******\n') : '\n',
      /* eslint-enable max-len */
    );
    await initServer(serverOpts);
  },
};
