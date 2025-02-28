import { container } from '@/container.js';
import { isProduction } from '@/util/index.js';
import { type MarkOptional } from 'ts-essentials';
import type { ArgumentsCamelCase, CommandModule } from 'yargs';
import { DBContext } from '../db/DBAccess.ts';
import { type ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { setServerOptions } from '../globals.ts';
import { Server } from '../Server.ts';
import { StartupService } from '../services/StartupService.ts';
import { KEYS } from '../types/inject.ts';
import { getDefaultDatabaseName } from '../util/defaults.ts';
import {
  getBooleanEnvVar,
  getNumericEnvVar,
  TUNARR_ENV_VARS,
} from '../util/env.ts';
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
      desc: 'Override the Tunarr server listen port',
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
  handler: async (
    opts: ArgumentsCamelCase<MarkOptional<ServerArgsType, 'port'>>,
  ) => {
    const portSetting = container
      .get<ISettingsDB>(KEYS.SettingsDB)
      .systemSettings().server.port;
    const portToUse =
      getNumericEnvVar(TUNARR_ENV_VARS.SERVER_PORT_ENV_VAR) ??
      opts.port ??
      portSetting;
    // port precedence - env var -> argument -> settings
    setServerOptions({ ...opts, port: portToUse });

    await DBContext.createForName(getDefaultDatabaseName(), async () => {
      await container.get(StartupService).runStartupServices();
      await container.get(Server).initAndRun();
    });
  },
};
