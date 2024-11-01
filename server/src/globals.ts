import { findKey, forEach, merge } from 'lodash-es';
import isUndefined from 'lodash-es/isUndefined.js';
import once from 'lodash-es/once.js';
import path, { resolve } from 'node:path';
import { ServerArgsType } from './cli/RunServerCommand.ts';
import { GlobalArgsType } from './cli/types.ts';
import { LogLevels } from './util/logging/LoggerFactory.ts';

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
  debug: 3,
  http: 4,
  trace: 5,
} as const;

let _globalOptions: GlobalOptions | undefined;
let _serverOptions: ServerOptions | undefined;

export const setGlobalOptions = once((runtimeOptions: GlobalArgsType) => {
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

  _globalOptions = {
    ...runtimeOptions,
    databaseDirectory: resolve(process.cwd(), runtimeOptions.database),
    log_level: logLevel,
  };
});

export const globalOptions = () => {
  if (isUndefined(_globalOptions)) {
    throw new Error('Accessing Global options before they were set!');
  }

  return _globalOptions;
};

export const setServerOptions = once((runtimeOptions: ServerArgsType) => {
  setGlobalOptions(runtimeOptions);
  _serverOptions = {
    ...globalOptions(),
    ...runtimeOptions,
  };
  return _serverOptions;
});

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

type Initializer = () => unknown;
let initalized = false;
const initializers: Initializer[] = [];

export const registerSingletonInitializer = <T>(f: () => T) => {
  if (initalized) {
    throw new Error(
      'Attempted to register singleton after intialization. This singleton will never be initialized!!',
    );
  }

  initializers.push(f);
};

export const initializeSingletons = once(() => {
  forEach(initializers, (f) => f());
  initalized = true;
});
