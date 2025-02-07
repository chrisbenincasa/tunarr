import { container } from '@/container.js';
import { TruthyQueryParam } from '@/types/schemas.js';
import { getDefaultServerPort } from '@/util/defaults.js';
import { isNonEmptyString, isProduction } from '@/util/index.js';
import type { ArgumentsCamelCase, CommandModule } from 'yargs';
import { setServerOptions } from '../globals.ts';
import { Server } from '../Server.ts';
import { StartupService } from '../services/StartupService.ts';
import type { GlobalArgsType } from './types.ts';

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
  handler: async (opts: ArgumentsCamelCase<ServerArgsType>) => {
    setServerOptions(opts);
    await container.get(StartupService).runStartupServices();
    await container.get(Server).initAndRun();
  },
};
