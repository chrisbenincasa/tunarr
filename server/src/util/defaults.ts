import type { Nullable } from '@/types/util.js';
import constants from '@tunarr/shared/constants';
import { isNull, isUndefined } from 'lodash-es';
import path from 'node:path';
import { globalOptions } from '../globals.ts';
import { DATABASE_LOCATION_ENV_VAR, SERVER_PORT_ENV_VAR } from './env.ts';
import { isNonEmptyString, isProduction } from './index.js';
import { isDocker } from './isDocker.js';
import type { LogLevels } from './logging/LoggerFactory.ts';
import {
  LogConfigEnvVars,
  getEnvironmentLogLevel,
} from './logging/LoggerFactory.ts';

function getRuntimeSpecificPrefix() {
  let prefix: Nullable<string> = null;
  if (isDocker()) {
    // Making a lot of assumptions here...
    prefix = '/config';
  } else if (process.env.APPDATA) {
    prefix = `${process.env.APPDATA}`;
  } else if (process.platform === 'darwin') {
    prefix = `${process.env.HOME}/Library/Preferences`;
  } else {
    prefix = `${process.env.HOME}/.local/share`;
  }
  return prefix;
}

export function getDefaultLogDirectory(): string {
  const env = process.env[LogConfigEnvVars.directory];
  if (isNonEmptyString(env)) {
    return env;
  }

  return path.join(getRuntimeSpecificPrefix() ?? '', 'tunarr', 'logs');
}

export function getDefaultLogLevel(useEnvVar: boolean = true): LogLevels {
  if (useEnvVar) {
    const level = getEnvironmentLogLevel();
    if (!isUndefined(level)) {
      return level;
    }
  }

  return isProduction ? 'info' : 'debug';
}

export function getDefaultDatabaseDirectory(): string {
  const env = process.env[DATABASE_LOCATION_ENV_VAR];
  if (isNonEmptyString(env)) {
    return env;
  }

  const prefix = getRuntimeSpecificPrefix();

  if (!isNull(prefix)) {
    return path.join(prefix, 'tunarr');
  }

  return path.join(process.cwd(), constants.DEFAULT_DATA_DIR);
}

export function getDefaultDatabaseName() {
  return path.join(
    globalOptions().databaseDirectory,
    process.env['TUNARR_DATABASE_NAME'] ?? 'db.db',
  );
}

export function getDefaultServerPort() {
  const port = process.env[SERVER_PORT_ENV_VAR];
  if (isNonEmptyString(port)) {
    const parsed = parseInt(port);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return 8000;
}
