import once from 'lodash-es/once.js';
import { GlobalOptions, ServerOptions } from './types.js';
import isUndefined from 'lodash-es/isUndefined.js';
import { merge } from 'lodash-es';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _globalOptions: GlobalOptions | undefined;
let _serverOptions: ServerOptions | undefined;

export const setGlobalOptions = once((runtimeOptions: GlobalOptions) => {
  _globalOptions = {
    ...runtimeOptions,
    database: resolve(__dirname, runtimeOptions.database),
  };
});

export const globalOptions = () => {
  if (isUndefined(_globalOptions)) {
    throw new Error('Accessing Global options before they were set!');
  }

  return _globalOptions;
};

export const setServerOptions = once((runtimeOptions: ServerOptions) => {
  _serverOptions = {
    ...runtimeOptions,
    database: resolve(__dirname, runtimeOptions.database),
  };
});

export const serverOptions = () => {
  if (isUndefined(_serverOptions)) {
    throw new Error('Accessing server options before they were set!');
  }

  return merge(globalOptions(), _serverOptions);
};
