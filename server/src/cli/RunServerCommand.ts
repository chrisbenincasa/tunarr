import { container } from '@/container.js';
import assert from 'node:assert';
import { type MarkOptional } from 'ts-essentials';
import type { ArgumentsCamelCase, CommandModule } from 'yargs';
import { App } from '../App.ts';
import { DBAccess } from '../db/DBAccess.ts';
import { type ISettingsDB } from '../db/interfaces/ISettingsDB.ts';
import { setServerOptions } from '../globals.ts';
import { KEYS } from '../types/inject.ts';
import {
  getBooleanEnvVar,
  getNumericEnvVar,
  TUNARR_ENV_VARS,
} from '../util/env.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import type { GlobalArgsType } from './types.ts';

export type ServerArgsType = GlobalArgsType & {
  port: number;
  printRoutes: boolean;
  trustProxy: boolean;
  searchPort?: number;
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
    trustProxy: {
      type: 'boolean',
      default: () =>
        getBooleanEnvVar(TUNARR_ENV_VARS.TRUST_PROXY_ENV_VAR, false),
    },
    searchPort: {
      type: 'number',
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

    process.on('uncaughtException', (err) => {
      console.error(err, 'Uncaught exception');
      LoggerFactory.root.flush();
    });

    process.on('unhandledRejection', (err) => {
      console.error(err, 'Uncaught exception');
      LoggerFactory.root.flush();
    });

    // Hard fail without database connection.
    assert(!!container.get<DBAccess>(DBAccess).db);
    await container.get(App).start();
  },
};
