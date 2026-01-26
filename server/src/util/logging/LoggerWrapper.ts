import { isNonEmptyString } from '@tunarr/shared/util';
import { isString, nth } from 'lodash-es';
import path, { join } from 'path';
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

interface ILoggerWrapper {
  child(
    args: GetChildLoggerArgs,
    opts?: ChildLoggerOptions<LogLevels>,
  ): ILoggerWrapper;
  updateStreams(streams: MultiStreamRes<LogLevels>): void;
  logger: Logger;
}

abstract class BaseLoggerWrapper implements ILoggerWrapper {
  protected children: Record<string, WeakRef<ILoggerWrapper>> = {};

  constructor(protected wrappedLogger: Logger) {}

  abstract child(
    args: GetChildLoggerArgs,
    opts?: ChildLoggerOptions<LogLevels>,
  ): ILoggerWrapper;

  updateStreams(streams: MultiStreamRes<LogLevels>) {
    Object.assign(this.wrappedLogger[symbols.streamSym], streams);

    for (const childRef of Object.values(this.children)) {
      const child = childRef.deref();
      if (child) {
        child.updateStreams(streams);
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
}

export class RootLoggerWrapper extends BaseLoggerWrapper {
  private loggerByCategory = new Map<LogCategory, ILoggerWrapper>();

  constructor(wrappedLogger: Logger) {
    super(wrappedLogger);
    for (const category of LogCategories) {
      const categoryLogger = this.wrappedLogger.child({ category });
      const wrapped = new LoggerWrapper(categoryLogger);
      this.children[`category:${category}`] = new WeakRef(wrapped);
      this.loggerByCategory.set(category, wrapped);
    }
  }

  child(
    args: GetChildLoggerArgs,
    opts?: ChildLoggerOptions<LogLevels>,
  ): ILoggerWrapper {
    const { caller, className, category, ...rest } = args;

    const ref = this.children[className]?.deref();
    if (ref) {
      return ref;
    }

    const childOpts = {
      ...rest,
      file: isProduction
        ? undefined
        : caller
          ? isString(caller)
            ? caller
            : getCaller(caller)
          : undefined,
      caller: isProduction ? undefined : className, // Don't include this twice in production
    };
    // console.log(this.loggerByCategory.get(category));
    if (category && this.loggerByCategory.has(category)) {
      const categoryLogger = this.loggerByCategory.get(category)!;
      delete args.category;
      const wrapped = categoryLogger.child(args, opts);
      return wrapped;
    } else {
      const newLogger = this.wrappedLogger.child(childOpts, opts);
      const wrapped = new LoggerWrapper(newLogger);
      this.children[className] = new WeakRef(wrapped);
      return wrapped;
    }
  }

  set level(newLevel: LogLevels) {
    this.wrappedLogger.level = newLevel;
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

    rootCategoryLogger.logger.level = newLevel;
    rootCategoryLogger.updateStreams(newStreamFn());
  }
}

export class LoggerWrapper extends BaseLoggerWrapper {
  constructor(wrappedLogger: Logger) {
    super(wrappedLogger);
    const className = this.className;
    if (isNonEmptyString(className)) {
      const l = getEnvironmentLogLevel(
        `TUNARR_LOG_LEVEL_${className.toUpperCase()}`,
      );
      if (l) {
        console.log('CUSTOM LOG LEVEL: ', l, className);
        this.wrappedLogger.level = l;
      }
    }
  }

  child(
    args: GetChildLoggerArgs,
    opts?: ChildLoggerOptions<LogLevels>,
  ): ILoggerWrapper {
    const { caller, className, ...rest } = args;

    const ref = this.children[className]?.deref();
    if (ref) {
      return ref;
    }

    const childOpts = {
      ...rest,
      file: isProduction
        ? undefined
        : caller
          ? isString(caller)
            ? caller
            : getCaller(caller)
          : undefined,
      caller: isProduction ? undefined : className, // Don't include this twice in production
    };
    const newChild = new LoggerWrapper(
      this.wrappedLogger.child(childOpts, opts),
    );
    this.children[className] = new WeakRef(newChild);
    return newChild;
  }
}

const getCaller = (callingModule: ImportMeta) => {
  const parts = callingModule.url.split(path.sep);
  const submodule = nth(parts, parts.length - 2) ?? '';
  const last = parts.pop();
  return join(submodule === 'src' ? '' : submodule, last ?? '');
};
