import { container } from '@/container.js';
import { getDefaultServerPort } from '@/util/defaults.js';
import { isProduction } from '@/util/index.js';
import type { ArgumentsCamelCase, CommandModule } from 'yargs';
import { setServerOptions } from '../globals.ts';
import { Server } from '../Server.ts';
import { StartupService } from '../services/StartupService.ts';
import { getBooleanEnvVar, TUNARR_ENV_VARS } from '../util/env.ts';
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
        getBooleanEnvVar(TUNARR_ENV_VARS.PRINT_ROUTES_ENV_VAR, false),
    },
    admin: {
      type: 'boolean',
      default: () =>
        getBooleanEnvVar(TUNARR_ENV_VARS.ADMIN_MODE_ENV_VAR, !isProduction),
    },
  },
  handler: async (opts: ArgumentsCamelCase<ServerArgsType>) => {
    setServerOptions(opts);
    await container.get(StartupService).runStartupServices();
    await container.get(Server).initAndRun();
  },
};
