import type { SettingsDB } from '@/db/SettingsDB.js';
import type { Maybe, TupleToUnion } from '@/types/util.js';
import { getDefaultLogLevel } from '@/util/defaults.js';
import { isNonEmptyString, isProduction, isTest } from '@/util/index.js';
import {
  forEach,
  isEmpty,
  isString,
  isUndefined,
  nth,
  toLower,
  trim,
} from 'lodash-es';
import path, { join } from 'node:path';
import type { Bindings, MultiStreamRes, StreamEntry } from 'pino';
import pino, {
  levels,
  multistream,
  symbols,
  type LevelWithSilent,
  type Logger as PinoLogger,
} from 'pino';
import type { PrettyOptions } from 'pino-pretty';
import pretty from 'pino-pretty';
import type ThreadStream from 'thread-stream';

export const LogConfigEnvVars = {
  level: 'LOG_LEVEL',
  directory: 'LOG_DIRECTORY',
} as const;

export function getEnvironmentLogLevel(): Maybe<LogLevels> {
  const envLevel = trim(toLower(process.env[LogConfigEnvVars.level]));
  if (isNonEmptyString(envLevel)) {
    if (ValidLogLevels.includes(envLevel)) {
      return envLevel as LogLevels;
    } else {
      console.warn(
        `Invalid log level provided in env var: %s. Ignoring`,
        envLevel,
      );
    }
  }
  return;
}

const ExtraLogLevels = ['http', 'http_out'] as const;

export const ValidLogLevels = [
  ...Object.keys(levels.values),
  ...ExtraLogLevels,
];

export type ExtraLogLevels = TupleToUnion<typeof ExtraLogLevels>;

export type Logger = PinoLogger<ExtraLogLevels>;

export type LogLevels = LevelWithSilent | ExtraLogLevels;

export type GetChildLoggerArgs = {
  caller?: ImportMeta | string;
  className: string;
} & Bindings;

export function getPrettyStreamOpts(): PrettyOptions {
  return {
    // minimumLevel: logLevel === 'silent' ? undefined : logLevel,
    translateTime: "SYS:yyyy-mm-dd'T'HH:MM:ss.l'Z'",
    singleLine: true,
    ignore: 'pid,hostname',
    customLevels: {
      http: 25,
    },
    customColors: {
      http: 'blue',
    },
    useOnlyCustomProps: false,
    messageFormat: (log, messageKey, _, { colors }) => {
      return `${colors.white(log[messageKey] as string)}`;
    },
    customPrettifiers: {
      time: (t) => {
        return t as string;
      },
      level: (_level, _key, _log, { labelColorized }) => {
        return `[${labelColorized.toLowerCase()}]`;
      },
      caller: (caller, _key, _log, { colors }) => {
        return colors.green(caller as string);
      },
    },
    colorize: true,
  };
}

class LoggerFactoryImpl {
  private settingsDB: SettingsDB;
  private rootLogger: PinoLogger<ExtraLogLevels>;
  private initialized = false;
  private children: Record<string, Logger> = {};
  private currentStreams: MultiStreamRes<LogLevels>;

  constructor() {
    // This ensures we always have a logger with the default configuration.
    // Once settings are initialized we update this root and all children
    // loggers.
    this.rootLogger = this.createRootLogger();
  }

  initialize(settingsDB: SettingsDB) {
    if (!this.initialized) {
      this.settingsDB = settingsDB;
      // We're not going to mess with multi-threaded transports right now
      // but it does seem to work with relative paths + the shim... so I'm
      // going to keep them around for now.
      this.rootLogger = this.createRootLogger();
      this.settingsDB.on('change', () => {
        if (!this.initialized) {
          return;
        }

        const { level: newLevel } = this.logLevel;

        if (this.rootLogger[symbols.getLevelSym] !== newLevel) {
          this.updateLevel(newLevel);
        }
      });

      if (!isEmpty(this.children)) {
        forEach(this.children, (child) => {
          if (child[symbols.streamSym] !== this.currentStreams) {
            Object.assign(child[symbols.streamSym], this.currentStreams);
          }
        });
      }

      this.initialized = true;
    }
  }

  get root() {
    return this.rootLogger;
  }

  get isInitialized() {
    return this.initialized;
  }

  // HACK - but this is how we change transports without a restart:
  // 1. Flush and close the existing transport
  // 2. Update the transports to the new set
  // 3. Manually attach them to the pino instance
  reinitStream() {
    if (!this.initialized) {
      return;
    }

    const currentStream = this.rootLogger[symbols.streamSym] as ThreadStream;
    currentStream.flushSync();
    currentStream.end();
    Object.assign(
      this.rootLogger[symbols.streamSym],
      this.currentStreams.clone(this.logLevel.level),
    );
  }

  child(opts: GetChildLoggerArgs): Logger {
    const { caller, className, ...rest } = opts;

    if (this.children[className]) {
      return this.children[className];
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
    const newChild = this.rootLogger.child(childOpts);
    this.children[className] = newChild;
    return newChild;
  }

  private createLogStreams(level?: LogLevels) {
    const { level: settingsLevel } = this.logLevel;
    this.currentStreams = multistream(
      this.createStreams(level ?? settingsLevel),
    );
    return this.currentStreams;
  }

  private createRootLogger() {
    const { level } = this.logLevel;
    return pino(
      {
        level,
        customLevels: {
          http: 25, // Finer than info but not as fine as debug
          http_out: 15, // Finder than debug but not as fine as trace
        },
      },
      this.createLogStreams(),
    );
  }

  private get logLevel(): {
    level: LogLevels;
    source: 'env' | 'settings';
  } {
    if (this.settingsDB?.systemSettings().logging.useEnvVarLevel) {
      const envLevel = getEnvironmentLogLevel();
      if (!isUndefined(envLevel)) {
        return { source: 'env', level: envLevel };
      }
    }

    return { level: this.systemSettingsLogLevel, source: 'settings' };
  }

  private get systemSettingsLogLevel() {
    if (!isUndefined(this.settingsDB)) {
      return this.settingsDB.systemSettings().logging
        .logLevel as LevelWithSilent;
    } else {
      return getDefaultLogLevel();
    }
  }

  private updateLevel(newLevel: LogLevels) {
    // Reset the level of the root logger and all children
    // We do this by setting the level on the instance directly
    // but then for multistream to work, we have to manually reset the streams
    // by cloning them with new levels.
    this.rootLogger.level = newLevel;
    Object.assign(
      this.rootLogger[symbols.streamSym],
      this.createLogStreams(newLevel),
    );
    forEach(this.children, (childLogger) => {
      childLogger.level = newLevel;
      Object.assign(childLogger[symbols.streamSym], this.currentStreams);
    });
  }

  private createStreams(logLevel: LogLevels): StreamEntry<LogLevels>[] {
    const streams: StreamEntry<LogLevels>[] = [
      {
        stream: pretty(getPrettyStreamOpts()),
        level: logLevel,
      },
    ];

    // We can only add these streams post-initialization because they
    // require configuration.
    if (!isUndefined(this.settingsDB) && !isTest) {
      streams.push({
        stream: pino.destination({
          dest: join(
            this.settingsDB.systemSettings().logging.logsDirectory,
            'tunarr.log',
          ),
          mkdir: true,
          append: true,
        }),
        level: logLevel,
      });
    }

    return streams;
  }
}

const getCaller = (callingModule: ImportMeta) => {
  const parts = callingModule.url.split(path.sep);
  const submodule = nth(parts, parts.length - 2) ?? '';
  const last = parts.pop();
  return join(submodule === 'src' ? '' : submodule, last ?? '');
};

export const LoggerFactory = new LoggerFactoryImpl();

export const RootLogger = LoggerFactory.root;
