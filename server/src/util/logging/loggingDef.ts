import type { LogCategory } from './LoggerFactory.ts';

export type LoggingDefinition = {
  category?: LogCategory;
};

export function loggingDef(def: LoggingDefinition = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function <T extends { new (...args: any[]): any }>(constructor: T) {
    Reflect.set(constructor, 'tunarr:log_def', def);
  };
}
