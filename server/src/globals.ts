import { Options } from '@mikro-orm/better-sqlite';
import { findKey, forEach, merge } from 'lodash-es';
import isUndefined from 'lodash-es/isUndefined.js';
import once from 'lodash-es/once.js';
import path, { resolve } from 'node:path';

export type ServerOptions = GlobalOptions & {
  port: number;
  printRoutes: boolean;
  admin: boolean;
};

export type GlobalOptions = {
  databaseDirectory: string;
  force_migration: boolean;
  log_level: string;
  verbose?: number;
};

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
} as const;

let _globalOptions: GlobalOptions | undefined;
let _serverOptions: ServerOptions | undefined;

export const setGlobalOptions = once((runtimeOptions: GlobalOptions) => {
  let logLevel: string = runtimeOptions.log_level.toLowerCase();
  if (!isUndefined(runtimeOptions.verbose) && runtimeOptions.verbose > 0) {
    const level = Math.max(runtimeOptions.verbose, 4);
    const levelKey = findKey(logLevels, (value) => value === level);
    if (!isUndefined(levelKey)) {
      logLevel = levelKey;
    }
  }

  _globalOptions = {
    ...runtimeOptions,
    databaseDirectory: resolve(process.cwd(), runtimeOptions.databaseDirectory),
    log_level: logLevel,
  };
});

export const globalOptions = () => {
  if (isUndefined(_globalOptions)) {
    throw new Error('Accessing Global options before they were set!');
  }

  return _globalOptions;
};

export const setServerOptions = once((runtimeOptions: ServerOptions) => {
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

export const dbOptions = (): Options => {
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
