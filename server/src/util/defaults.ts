import { isUndefined } from 'lodash-es';
import path from 'node:path';
import { globalOptions } from '../globals.ts';
import { isRunningInContainer } from './containerUtil.ts';
import { DATABASE_LOCATION_ENV_VAR, SERVER_PORT_ENV_VAR } from './env.ts';
import { isNonEmptyString, isProduction } from './index.js';
import type { LogLevels } from './logging/LoggerFactory.ts';
import { getEnvironmentLogLevel } from './logging/LoggerFactory.ts';

function getRuntimeSpecificPrefix(): string {
  let prefix: string;
  if (isRunningInContainer()) {
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
  return path.join(getDefaultDatabaseDirectory(), 'logs');
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

  return path.join(prefix, 'tunarr');
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
