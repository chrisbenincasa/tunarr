import type { SettingsDB } from '@/db/SettingsDB.js';
import type { Maybe, TupleToUnion } from '@/types/util.js';
import { getDefaultLogLevel } from '@/util/defaults.js';
import { inConstArr, isNonEmptyString, isTest } from '@/util/index.js';
import {
  forEach,
  isEmpty,
  isEqual,
  isUndefined,
  toLower,
  trim,
} from 'lodash-es';
import { join } from 'node:path';
import type {
  Bindings,
  ChildLoggerOptions,
  MultiStreamRes,
  StreamEntry,
} from 'pino';
import pino, {
  levels,
  multistream,
  symbols,
  type LevelWithSilent,
  type Logger as PinoLogger,
} from 'pino';
import type { PrettyOptions } from 'pino-pretty';
import pretty from 'pino-pretty';
import { TUNARR_ENV_VARS } from '../env.ts';
import type { SerializedLogger } from './LoggerWrapper.ts';
import { RootLoggerWrapper } from './LoggerWrapper.ts';
import { RollingLogDestination } from './RollingDestination.ts';

export const LogConfigEnvVars = {
  level: 'LOG_LEVEL',
  directory: 'LOG_DIRECTORY',
} as const;

export function getEnvironmentLogLevel(envVar?: string): Maybe<LogLevels> {
  const envLevel = trim(
    toLower(process.env[envVar ?? TUNARR_ENV_VARS.LOG_LEVEL_ENV_VAR]),
  );
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

export type LogLevels = LevelWithSilent | ExtraLogLevels;

export type Logger = PinoLogger<LogLevels>;

export type GetChildLoggerArgs = {
  caller?: ImportMeta | string;
  category?: LogCategory;
  className: string;
} & Bindings;

export function getPrettyStreamOpts(): PrettyOptions {
  return {
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

export const LogCategories = ['streaming', 'scheduling'] as const;

export type LogCategory = TupleToUnion<typeof LogCategories>;

class LoggerFactoryImpl {
  private settingsDB?: SettingsDB;
  // private rootLogger: PinoLogger<ExtraLogLevels>;
  private rootLogger!: RootLoggerWrapper;
  private initialized = false;
  private children: Record<string, WeakRef<Logger>> = {};
  private currentStreams?: MultiStreamRes<LogLevels>;
  private roller?: RollingLogDestination;

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
      this.settingsDB.on('change', (prevSettings) => {
        if (!this.initialized) {
          return;
        }

        const currentSettings =
          this.settingsDB?.systemSettings().logging.logRollConfig;

        const { level: newLevel } = this.logLevel;
        const perCategoryLogLevel = this.perCategoryLogLevel;

        if (
          this.rootLogger.logger[symbols.getLevelSym] !== newLevel ||
          !prevSettings ||
          !isEqual(prevSettings.system.logging.logRollConfig, currentSettings)
        ) {
          this.updateLevel(newLevel);
          setTimeout(() => {
            this.rollLogsNow();
          });
        }

        for (const [category, level] of Object.entries(perCategoryLogLevel)) {
          if (!inConstArr(LogCategories, category)) {
            continue;
          }
          this.rootLogger.updateCategoryLevel(level, category, () =>
            this.createLogStreams(level),
          );
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
    return this.rootLogger.logger;
  }

  get isInitialized() {
    return this.initialized;
  }

  traverseHierarchy(): Generator<readonly [string, SerializedLogger]> {
    return this.rootLogger.traverseHierarchy();
  }

  rollLogsNow() {
    this.roller?.roll();
  }

  child(
    args: GetChildLoggerArgs,
    opts?: ChildLoggerOptions<LogLevels>,
  ): Logger {
    const { className } = args;
    opts ??= {};
    const levelOverride = getEnvironmentLogLevel(
      `TUNARR_LOG_LEVEL_${className.toUpperCase()}`,
    );
    const child = this.rootLogger.child(args, opts);
    if (levelOverride) {
      child.updateStreams(multistream(this.createStreams(levelOverride)));
    }
    return child.logger;
  }

  private createLogStreams(level?: LogLevels) {
    const { level: settingsLevel } = this.logLevel;
    this.currentStreams = multistream(
      this.createStreams(level ?? settingsLevel),
    );
    return this.currentStreams;
  }

  private createRootLogger(): RootLoggerWrapper {
    const { level } = this.logLevel;
    const root = pino(
      {
        level,
        customLevels: {
          silent: Number.MAX_SAFE_INTEGER,
          trace: 10,
          debug: 20,
          info: 30,
          warn: 40,
          error: 50,
          fatal: 60,
          http: 25, // Finer than info but not as fine as debug
          http_out: 15, // Finder than debug but not as fine as trace
        },
      },
      this.createLogStreams(),
    );

    return new RootLoggerWrapper(
      root,
      this.settingsDB?.systemSettings().logging,
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

  private get perCategoryLogLevel(): Record<string, LogLevels> {
    if (!this.settingsDB) {
      return {};
    }

    return this.settingsDB.systemSettings().logging.categoryLogLevel ?? {};
  }

  private get systemSettingsLogLevel() {
    if (!isUndefined(this.settingsDB)) {
      return this.settingsDB.systemSettings().logging
        .logLevel as LevelWithSilent;
    } else {
      return getDefaultLogLevel();
    }
  }

  private updateLevel(newLevel: LogLevels, category?: string) {
    if (category && inConstArr(LogCategories, category)) {
      this.rootLogger.updateCategoryLevel(newLevel, category, () =>
        this.createLogStreams(newLevel),
      );
      return;
    }

    // Reset the level of the root logger and all children
    // We do this by setting the level on the instance directly
    // but then for multistream to work, we have to manually reset the streams
    // by cloning them with new levels.
    this.rootLogger.level = newLevel;
    this.rootLogger.updateStreams(this.createLogStreams(newLevel));
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
      // TODO Expose this in the UI with configuration
      const logConfig = this.settingsDB.systemSettings().logging;
      const logFilePath = join(logConfig.logsDirectory, 'tunarr.log');

      this.roller?.deinitialize();
      this.roller = undefined;

      if (logConfig.logRollConfig.enabled) {
        this.roller = new RollingLogDestination({
          fileName: logFilePath,
          maxSizeBytes: logConfig.logRollConfig.maxFileSizeBytes,
          rotateSchedule: logConfig.logRollConfig.schedule,
          fileLimit: {
            count: logConfig.logRollConfig.rolledFileLimit,
          },
          destinationOpts: {
            mkdir: true,
            append: true,
          },
        });
        streams.push({
          stream: this.roller.initDestination(),
          level: logLevel,
        });
      } else {
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
    }

    return streams;
  }
}

export const LoggerFactory = new LoggerFactoryImpl();

export const RootLogger = LoggerFactory.root;
