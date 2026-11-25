import type { SettingsDB } from '@/db/SettingsDB.js';
import { globalOptions } from '@/globals.js';
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
import { isMainThread } from 'node:worker_threads';
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

export function getEnvironmentLogLevel(
  envVar?: string,
  env: NodeJS.ProcessEnv = process.env,
): Maybe<LogLevels> {
  const envLevel = trim(
    toLower(env[envVar ?? TUNARR_ENV_VARS.LOG_LEVEL_ENV_VAR]),
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

const CustomLogLevels: Record<ExtraLogLevels, number> = {
  http: 25, // Finer than info but not as fine as debug
  http_out: 15, // Finer than debug but not as fine as trace
};

export const ValidLogLevels = [
  ...Object.keys(levels.values),
  ...ExtraLogLevels,
];

const ClassLogLevelEnvPrefix = `${TUNARR_ENV_VARS.LOG_LEVEL_ENV_VAR}_`;

function logLevelValue(level: LogLevels): number {
  return (
    levels.values[level] ??
    CustomLogLevels[level as ExtraLogLevels] ??
    Number.POSITIVE_INFINITY
  );
}

/**
 * Returns the finest level set by any `TUNARR_LOG_LEVEL_<CLASSNAME>` env var.
 */
export function lowestClassLogLevelOverride(
  env: NodeJS.ProcessEnv = process.env,
): Maybe<LogLevels> {
  let lowest: Maybe<LogLevels>;
  for (const envVar of Object.keys(env)) {
    if (!envVar.startsWith(ClassLogLevelEnvPrefix)) {
      continue;
    }
    const level = getEnvironmentLogLevel(envVar, env);
    if (level && (!lowest || logLevelValue(level) < logLevelValue(lowest))) {
      lowest = level;
    }
  }
  return lowest;
}

export type ExtraLogLevels = TupleToUnion<typeof ExtraLogLevels>;

export type Logger = PinoLogger<ExtraLogLevels>;

export type LogLevels = LevelWithSilent | ExtraLogLevels;

export type GetChildLoggerArgs = {
  caller?: ImportMeta | string;
  category?: LogCategory;
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

  closeRollingDestination() {
    this.roller?.deinitialize();
    this.roller = undefined;
  }

  child(
    args: GetChildLoggerArgs,
    opts?: ChildLoggerOptions<LogLevels>,
  ): Logger {
    return this.rootLogger.child(args, opts ?? {}).logger;
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
        customLevels: CustomLogLevels,
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
    source: 'cli' | 'env' | 'settings';
  } {
    // The CLI flags are honored via globalOptions().log_level, which is
    // undefined unless --log_level/-v was passed (see setGlobalOptionsUnchecked)
    // so a yargs default never clobbers a saved settings.json level (#1992).
    let cliLogLevel: LogLevels | undefined;
    try {
      cliLogLevel = globalOptions().log_level;
    } catch {
      // globalOptions() throws before setGlobalOptions() runs (logger is
      // constructed at import); fall through to settings/env in that window.
      cliLogLevel = undefined;
    }

    return resolveBaseLogLevel({
      cliLogLevel,
      envLogLevel: getEnvironmentLogLevel(),
      useEnvVarLevel: this.settingsDB?.systemSettings().logging.useEnvVarLevel,
      settingsLogLevel: this.systemSettingsLogLevel,
    });
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

    // Reset the level of the root logger and all children.
    // We set the level on every logger instance directly because pino children
    // snapshot the parent's level at creation time and don't follow changes.
    // For multistream to work, we also have to manually reset the streams.
    this.rootLogger.updateLevel(newLevel, this.createLogStreams(newLevel));
  }

  private createStreams(baseLevel: LogLevels): StreamEntry<LogLevels>[] {
    // Every logger shares these streams. They must pass the finest level any
    // class override asks for. Each logger's own level filters the rest.
    const classOverride = lowestClassLogLevelOverride();
    const logLevel =
      classOverride && logLevelValue(classOverride) < logLevelValue(baseLevel)
        ? classOverride
        : baseLevel;

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

      const fileMode = resolveLogFileMode({
        rollEnabled: logConfig.logRollConfig.enabled,
        isMainThread,
      });

      if (fileMode === 'rolling') {
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
            sync: isTest,
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
            sync: isTest,
          }),
          level: logLevel,
        });
      }
    }

    return streams;
  }
}

export const LoggerFactory = new LoggerFactoryImpl();

/**
 * Only the main thread rolls tunarr.log. Workers share the file, and a roller
 * per thread means every thread rolls the same files at once. Workers append
 * instead. A roll copies the file and truncates it in place, so their
 * append-mode handles keep writing to the live log afterward.
 */
export function resolveLogFileMode(p: {
  rollEnabled: boolean;
  isMainThread: boolean;
}): 'rolling' | 'append' {
  return p.rollEnabled && p.isMainThread ? 'rolling' : 'append';
}

/**
 * Pure resolution of the base log level, in priority order. The CLI flags
 * (`--log_level` / `-v`) are the most explicit override; `cliLogLevel` is the
 * value in `globalOptions().log_level`, which is `undefined` when neither flag
 * was passed (so a yargs default never clobbers settings). Env applies only
 * when the `useEnvVarLevel` setting is on; otherwise settings win.
 */
export function resolveBaseLogLevel(p: {
  cliLogLevel: LogLevels | undefined;
  envLogLevel: Maybe<LogLevels>;
  useEnvVarLevel: boolean | undefined;
  settingsLogLevel: LogLevels;
}): { level: LogLevels; source: 'cli' | 'env' | 'settings' } {
  if (!isUndefined(p.cliLogLevel)) {
    return { source: 'cli', level: p.cliLogLevel };
  }
  if (p.useEnvVarLevel) {
    const envLevel = p.envLogLevel;
    if (!isUndefined(envLevel)) {
      return { source: 'env', level: envLevel };
    }
  }
  return { source: 'settings', level: p.settingsLogLevel };
}

export const RootLogger = LoggerFactory.root;
