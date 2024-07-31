import { LogConfigEnvVars } from './logging/LoggerFactory';
import { isUndefined } from 'lodash-es';
import { Nullable } from '../types/util.js';
import { DATABASE_LOCATION_ENV_VAR, SERVER_PORT_ENV_VAR } from './constants.js';
import { isNonEmptyString, isProduction } from './index.js';
import { isDocker } from './isDocker.js';
import { LogLevels, getEnvironmentLogLevel } from './logging/LoggerFactory';
import constants from '@tunarr/shared/constants';

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

  return `${getRuntimeSpecificPrefix() ?? ''}/tunarr/logs`;
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

  return `${getDefaultDatabaseDirectory() ?? process.cwd()}/${
    constants.DEFAULT_DATA_DIR
  }`;
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
