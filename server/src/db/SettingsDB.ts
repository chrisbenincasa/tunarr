import {
  ISettingsDB,
  ReadableFfmpegSettings,
  SettingsChangeEvents,
} from '@/db/interfaces/ISettingsDB.js';
import { deepCopy, isProduction } from '@/util/index.js';
import { type Logger, LoggerFactory } from '@/util/logging/LoggerFactory.js';
import {
  DefaultServerSettings,
  FfmpegSettings,
  HdhrSettings,
  LoggingSettingsSchema,
  PlexStreamSettings,
  SystemSettings,
  SystemSettingsSchema,
  XmlTvSettings,
  defaultFfmpegSettings,
  defaultGlobalMediaSourceSettings,
  defaultHdhrSettings,
  defaultPlexStreamSettings,
  defaultXmlTvSettings as defaultXmlTvSettingsSchema,
} from '@tunarr/types';
import {
  BackupSettings,
  FfmpegSettingsSchema,
  GlobalMediaSourceSettings,
  GlobalMediaSourceSettingsSchema,
  HdhrSettingsSchema,
  PlexStreamSettingsSchema,
  XmlTvSettingsSchema,
} from '@tunarr/types/schemas';
import { injectable } from 'inversify';
import { merge } from 'lodash-es';
import { Low } from 'lowdb';
import events from 'node:events';
import path from 'node:path';
import { setImmediate } from 'node:timers';
import { DeepPartial, DeepReadonly } from 'ts-essentials';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod/v4';
import { Maybe } from '../types/util.ts';
import {
  getDefaultLogDirectory,
  getDefaultLogLevel,
} from '../util/defaults.ts';

// Version 1 -> 2: slot show ids changed to be the program_grouping ID
//   rather than the show name.
export const CURRENT_VERSION = 1;

export const defaultXmlTvSettings = (dbBasePath: string): XmlTvSettings => ({
  ...defaultXmlTvSettingsSchema,
  outputPath: path.resolve(dbBasePath, 'xmltv.xml'),
});

export const SettingsSchema = z.object({
  clientId: z.string(),
  hdhr: HdhrSettingsSchema,
  xmltv: XmlTvSettingsSchema,
  plexStream: PlexStreamSettingsSchema,
  ffmpeg: FfmpegSettingsSchema,
  mediaSource: GlobalMediaSourceSettingsSchema,
});

export type Settings = z.infer<typeof SettingsSchema>;

export const MigrationStateSchema = z.object({
  legacyMigration: z
    .boolean()
    .default(false)
    .describe('Whether a legacy migration was performed'),
  isFreshSettings: z.boolean().default(true).optional(),
  hasMigratedTo1_0: z.boolean().optional().default(false),
});

export type MigrationState = z.infer<typeof MigrationStateSchema>;

export const SettingsFileSchema = z.object({
  version: z.number(),
  migration: MigrationStateSchema,
  settings: SettingsSchema,
  system: SystemSettingsSchema.extend({
    logging: LoggingSettingsSchema.extend({
      logLevel: SystemSettingsSchema.shape.logging.shape.logLevel.default(() =>
        isProduction ? 'info' : 'debug',
      ),
    }),
  }),
});

export type SettingsFile = z.infer<typeof SettingsFileSchema>;

export const defaultSettings = (dbBasePath: string): SettingsFile => ({
  version: 1,
  migration: {
    legacyMigration: false,
    hasMigratedTo1_0: false,
  },
  settings: {
    clientId: uuidv4(),
    hdhr: defaultHdhrSettings,
    xmltv: defaultXmlTvSettings(dbBasePath),
    plexStream: defaultPlexStreamSettings,
    ffmpeg: defaultFfmpegSettings,
    mediaSource: defaultGlobalMediaSourceSettings,
  },
  system: {
    backup: {
      configurations: [],
    },
    logging: {
      logLevel: getDefaultLogLevel(),
      logsDirectory: getDefaultLogDirectory(),
      useEnvVarLevel: true,
      logRollConfig: {
        enabled: false,
        rolledFileLimit: 3,
        maxFileSizeBytes: Math.pow(2, 20),
      },
    },
    cache: {
      enablePlexRequestCache: false,
    },
    server: DefaultServerSettings,
  },
});

@injectable()
export class SettingsDB
  extends events.EventEmitter<SettingsChangeEvents>
  implements ISettingsDB
{
  private logger?: Logger;
  private db: Low<SettingsFile>;

  constructor(db: Low<SettingsFile>) {
    super();
    this.db = db;
    setImmediate(() => {
      this.logger = LoggerFactory.child({
        caller: import.meta,
        className: SettingsDB.name,
      });
    });
  }

  needsLegacyMigration() {
    return !this.db.data.migration.legacyMigration;
  }

  get migrationState(): DeepReadonly<MigrationState> {
    return this.db.data.migration;
  }

  get backup(): DeepReadonly<BackupSettings> {
    return this.db.data.system.backup;
  }

  getAll(): DeepReadonly<SettingsFile> {
    return this.db.data;
  }

  clientId(): string {
    return this.db.data.settings.clientId;
  }

  xmlTvSettings(): DeepReadonly<XmlTvSettings> {
    return this.db.data.settings.xmltv;
  }

  hdhrSettings(): DeepReadonly<HdhrSettings> {
    return this.db.data.settings.hdhr;
  }

  plexSettings(): DeepReadonly<PlexStreamSettings> {
    return this.db.data.settings.plexStream;
  }

  ffmpegSettings(): ReadableFfmpegSettings {
    return this.db.data.settings.ffmpeg;
  }

  get ffprobePath(): string {
    return this.ffmpegSettings().ffprobeExecutablePath;
  }

  systemSettings(): DeepReadonly<SystemSettings> {
    return this.db.data.system;
  }

  globalMediaSourceSettings(): DeepReadonly<GlobalMediaSourceSettings> {
    return this.db.data.settings.mediaSource;
  }

  updateFfmpegSettings(ffmpegSettings: FfmpegSettings) {
    return this.updateSettings('ffmpeg', { ...ffmpegSettings });
  }

  async directUpdate(fn: (settings: SettingsFile) => SettingsFile | void) {
    let prevSettings: Maybe<SettingsFile>;
    return await this.db
      .update((prev) => {
        prevSettings = deepCopy(prev);
        fn(prev);
      })
      .then(() => {
        this.logger?.debug(
          'Detected change to settings DB file on disk. Reloading.',
        );
        this.emit('change', prevSettings);
      });
  }

  async updateSettings<K extends keyof Settings>(
    key: K,
    settings: Settings[K],
  ) {
    return await this.directUpdate((oldSettings) => {
      oldSettings.settings[key] = settings;
    });
  }

  // Be careful!!!
  async updateBaseSettings<K extends keyof Omit<SettingsFile, 'settings'>>(
    key: K,
    settings: Partial<SettingsFile[K]>,
  ) {
    return await this.db.update((oldSettings) => {
      oldSettings[key] = merge(oldSettings[key], settings);
    });
  }

  async flush() {
    return this.db.write();
  }

  // private handleFileChanges(path: string) {
  //   const watcher = chokidar.watch(path, {
  //     persistent: false,
  //     awaitWriteFinish: true,
  //   });

  //   watcher.on('change', () => {
  // this.logger.debug(
  //   'Detected change to settings DB file %s on disk. Reloading.',
  //   path,
  // );
  //     this.db
  //       .read()
  //       .then(() => this.emit('change'))
  //       .catch(console.error);
  //   });
  // }
}

export type SettingsDBFactoryType = (
  dbPath?: string,
  initialSettings?: DeepPartial<SettingsFile>,
) => ISettingsDB;
