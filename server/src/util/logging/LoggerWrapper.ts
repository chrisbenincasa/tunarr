import { isNonEmptyString } from '@tunarr/shared/util';
import type { LoggingSettings } from '@tunarr/types';
import { isEmpty, isString, isUndefined, nth, omitBy } from 'lodash-es';
import path, { join } from 'path';
import type pino from 'pino';
import type { ChildLoggerOptions, MultiStreamRes } from 'pino';
import { symbols } from 'pino';
import { isProduction } from '../index.ts';
import type {
  GetChildLoggerArgs,
  LogCategory,
  Logger,
  LogLevels,
} from './LoggerFactory.ts';
import { getEnvironmentLogLevel, LogCategories } from './LoggerFactory.ts';

export type SerializedLogger = {
  name: string;
  bindings: pino.Bindings;
  level: LogLevels;
};

interface ILoggerWrapper {
  child(
    args: GetChildLoggerArgs,
    opts?: ChildLoggerOptions<LogLevels>,
  ): ILoggerWrapper;
  withBindings(
    bindings: pino.Bindings,
    opts?: ChildLoggerOptions<LogLevels>,
  ): ILoggerWrapper;
  updateLevel(level: LogLevels, streams: MultiStreamRes<LogLevels>): void;
  updateStreams(streams: MultiStreamRes<LogLevels>): void;
  logger: Logger;
  traverseHierarchy(): Generator<readonly [string, SerializedLogger]>;
  serialize(): SerializedLogger;
}

abstract class BaseLoggerWrapper implements ILoggerWrapper {
  protected children: Record<string, ILoggerWrapper> = {};

  // Per-instance loggers carry their own bindings, so they can't be cached by
  // class name. They're held weakly so they die with their owner, but are
  // still tracked because a pino child copies its parent's level only once.
  #instances = new Set<WeakRef<Logger>>();

  constructor(protected wrappedLogger: Logger) {}

  abstract child(
    args: GetChildLoggerArgs,
    opts?: ChildLoggerOptions<LogLevels>,
  ): ILoggerWrapper;

  updateLevel(level: LogLevels, streams: MultiStreamRes<LogLevels>) {
    this.wrappedLogger.level = level;
    Object.assign(this.wrappedLogger[symbols.streamSym], streams);

    for (const instance of this.liveInstances()) {
      instance.level = level;
      Object.assign(instance[symbols.streamSym], streams);
    }

    for (const child of Object.values(this.children)) {
      child.updateLevel(level, streams);
    }
  }

  updateStreams(streams: MultiStreamRes<LogLevels>) {
    Object.assign(this.wrappedLogger[symbols.streamSym], streams);

    for (const instance of this.liveInstances()) {
      Object.assign(instance[symbols.streamSym], streams);
    }

    for (const child of Object.values(this.children)) {
      child.updateStreams(streams);
    }
  }

  withBindings(
    bindings: pino.Bindings,
    opts?: ChildLoggerOptions<LogLevels>,
  ): ILoggerWrapper {
    const instance = this.wrappedLogger.child(bindings, opts) as Logger;
    this.#instances.add(new WeakRef(instance));
    return new LoggerWrapper(instance);
  }

  private *liveInstances() {
    for (const ref of this.#instances) {
      const instance = ref.deref();
      if (instance) {
        yield instance;
      } else {
        this.#instances.delete(ref);
      }
    }
  }

  get logger(): Logger {
    return this.wrappedLogger;
  }

  protected get className() {
    const maybeClassName: unknown =
      this.wrappedLogger.bindings()['caller'] ??
      this.wrappedLogger.bindings()['className'];
    if (isNonEmptyString(maybeClassName)) {
      return maybeClassName;
    }
    return;
  }

  *traverseHierarchy() {
    for (const [loggerName, child] of Object.entries(this.children)) {
      // const child = ref.deref();
      if (!child) {
        continue;
      }
      if (!loggerName.startsWith('category')) {
        yield [loggerName, child.serialize()] as const;
      }
      yield* child.traverseHierarchy();
    }
  }

  serialize(): SerializedLogger {
    const lvlVal = this.wrappedLogger.levelVal;
    let level = this.wrappedLogger.level as LogLevels;
    for (const [key, value] of Object.entries({
      ...this.wrappedLogger.levels,
      ...this.wrappedLogger.customLevels,
    })) {
      if (value === lvlVal) {
        level = key as LogLevels;
      }
    }

    return {
      name: this.className ?? 'unknown',
      bindings: this.wrappedLogger.bindings(),
      level,
    };
  }
}

export class RootLoggerWrapper extends BaseLoggerWrapper {
  private loggerByCategory = new Map<LogCategory, ILoggerWrapper>();

  constructor(wrappedLogger: Logger, initialLogSettings?: LoggingSettings) {
    super(wrappedLogger);
    for (const category of LogCategories) {
      const categoryLogger = this.wrappedLogger.child(
        { category },
        { level: initialLogSettings?.categoryLogLevel?.[category] },
      );
      const wrapped = new LoggerWrapper(categoryLogger);
      this.children[`category:${category}`] = wrapped;
      this.loggerByCategory.set(category, wrapped);
    }
  }

  child(
    args: GetChildLoggerArgs,
    opts?: ChildLoggerOptions<LogLevels>,
  ): ILoggerWrapper {
    const { caller, className, category, ...rest } = args;

    const categoryLogger = category
      ? this.loggerByCategory.get(category)
      : undefined;
    if (categoryLogger) {
      return categoryLogger.child({ caller, className, ...rest }, opts);
    }

    let classLogger = this.children[className];
    if (!classLogger) {
      classLogger = new LoggerWrapper(
        this.wrappedLogger.child(
          classLoggerBindings(caller, className),
          opts,
        ) as Logger,
      );
      this.children[className] = classLogger;
    }

    return withInstanceBindings(classLogger, rest, opts);
  }

  updateCategoryLevel(
    newLevel: LogLevels,
    category: LogCategory,
    newStreamFn: () => MultiStreamRes<LogLevels>,
  ) {
    const rootCategoryLogger = this.loggerByCategory.get(category);
    if (!rootCategoryLogger) {
      return;
    }

    rootCategoryLogger.updateLevel(newLevel, newStreamFn());
  }
}

class LoggerWrapper extends BaseLoggerWrapper {
  constructor(wrappedLogger: Logger) {
    super(wrappedLogger);
    const className = this.className;
    if (isNonEmptyString(className)) {
      const customLogLevel = getEnvironmentLogLevel(
        `TUNARR_LOG_LEVEL_${className.toUpperCase()}`,
      );
      if (customLogLevel) {
        this.wrappedLogger.level = customLogLevel;
      }
    }
  }

  child(
    args: GetChildLoggerArgs,
    opts?: ChildLoggerOptions<LogLevels>,
  ): ILoggerWrapper {
    const { caller, className, ...rest } = args;

    let classLogger = this.children[className];
    if (!classLogger) {
      classLogger = new LoggerWrapper(
        this.wrappedLogger.child(
          classLoggerBindings(caller, className),
          opts,
        ) as Logger,
      );
      this.children[className] = classLogger;
    }

    return withInstanceBindings(classLogger, rest, opts);
  }
}

function classLoggerBindings(
  caller: GetChildLoggerArgs['caller'],
  className: string,
): pino.Bindings {
  return {
    file: isProduction
      ? undefined
      : caller
        ? isString(caller)
          ? caller
          : getCaller(caller)
        : undefined,
    caller: isProduction ? undefined : className, // Don't include this twice in production
  };
}

// Bindings beyond the class name (session ID, server name, ...) belong to one
// instance, so they go on a fresh child instead of the cached class logger.
function withInstanceBindings(
  classLogger: ILoggerWrapper,
  bindings: pino.Bindings,
  opts?: ChildLoggerOptions<LogLevels>,
): ILoggerWrapper {
  const instanceBindings = omitBy(bindings, isUndefined);
  return isEmpty(instanceBindings)
    ? classLogger
    : classLogger.withBindings(instanceBindings, opts);
}

const getCaller = (callingModule: ImportMeta) => {
  const parts = callingModule.url.split(path.sep);
  const submodule = nth(parts, parts.length - 2) ?? '';
  const last = parts.pop();
  return join(submodule === 'src' ? '' : submodule, last ?? '');
};
