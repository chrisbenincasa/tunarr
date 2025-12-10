import { findKey, merge } from 'lodash-es';
import isUndefined from 'lodash-es/isUndefined.js';
import once from 'lodash-es/once.js';
import path, { resolve } from 'node:path';
import type { ServerArgsType } from './cli/RunServerCommand.ts';
import type { GlobalArgsType } from './cli/types.ts';
import type { LogLevels } from './util/logging/LoggerFactory.ts';

export type GlobalOptions = GlobalArgsType & {
  databaseDirectory: string;
};

export type ServerOptions = GlobalOptions & ServerArgsType;

const logLevels: Record<LogLevels, number> = {
  silent: -2,
  fatal: -1,
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  http_out: 5,
  trace: 6,
} as const;

let _globalOptions: GlobalOptions | undefined;
let _serverOptions: ServerOptions | undefined;

// Can overrwrite global options! Used only for tests!
export const setGlobalOptionsUnchecked = (runtimeOptions: GlobalArgsType) => {
  let logLevel: LogLevels = runtimeOptions.log_level;
  if (!isUndefined(runtimeOptions.verbose) && runtimeOptions.verbose > 0) {
    const level = Math.max(runtimeOptions.verbose, 4);
    const levelKey = findKey(
      logLevels,
      (value) => value === level,
    ) as LogLevels;
    if (!isUndefined(levelKey)) {
      logLevel = levelKey;
    }
  }

  return (_globalOptions = {
    ...runtimeOptions,
    databaseDirectory: resolve(process.cwd(), runtimeOptions.database),
    log_level: logLevel,
  });
};

export const setGlobalOptions = once(setGlobalOptionsUnchecked);

export const globalOptions = () => {
  if (isUndefined(_globalOptions)) {
    throw new Error('Accessing Global options before they were set!');
  }

  return _globalOptions;
};

export const setServerOptionsUnchecked = (runtimeOptions: ServerArgsType) => {
  setGlobalOptions(runtimeOptions);
  _serverOptions = {
    ...globalOptions(),
    ...runtimeOptions,
  };
  return _serverOptions;
};

export const setServerOptions = once(setServerOptionsUnchecked);

export const serverOptions = () => {
  if (isUndefined(_serverOptions)) {
    throw new Error('Accessing server options before they were set!');
  }

  return merge(globalOptions(), _serverOptions);
};

export const dbOptions = () => {
  if (isUndefined(_globalOptions)) {
    throw new Error('Accessing global options before they were set!');
  }

  return {
    dbName: path.join(_globalOptions.databaseDirectory, 'db.db'),
  };
};
