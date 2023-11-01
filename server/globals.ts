import once from 'lodash-es/once.js';
import { GlobalOptions, ServerOptions } from './types.js';
import isUndefined from 'lodash-es/isUndefined.js';

let _globalOptions: GlobalOptions | undefined;
let _serverOptions: ServerOptions | undefined;

export const setGlobalOptions = once((runtimeOptions: GlobalOptions) => {
  _globalOptions = runtimeOptions;
});

export const globalOptions = () => {
  if (isUndefined(_globalOptions)) {
    throw new Error('Accessing Global options before they were set!');
  }

  return _globalOptions;
};

export const setServerOptions = once((runtimeOptions: ServerOptions) => {
  _serverOptions = runtimeOptions;
});

export const serverOptions = () => {
  if (isUndefined(_serverOptions)) {
    throw new Error('Accessing server options before they were set!');
  }

  return _serverOptions;
};
