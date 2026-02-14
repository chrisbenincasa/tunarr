import type {
  MigrationState,
  Settings,
  SettingsFile,
} from '@/db/SettingsDB.js';
import type { Maybe } from '@/types/util.js';
import type {
  FfmpegSettings,
  HdhrSettings,
  PlexStreamSettings,
  SystemSettings,
  XmlTvSettings,
} from '@tunarr/types';
import type {
  BackupSettings,
  GlobalMediaSourceSettings,
} from '@tunarr/types/schemas';
import type { EventEmitter } from 'node:events';
import type { DeepReadonly } from 'ts-essentials';

export interface ISettingsDB extends EventEmitter<SettingsChangeEvents> {
  migrationState: DeepReadonly<MigrationState>;
  backup: DeepReadonly<BackupSettings>;

  needsLegacyMigration(): boolean;

  getAll(): DeepReadonly<SettingsFile>;

  clientId(): string;

  xmlTvSettings(): DeepReadonly<XmlTvSettings>;

  hdhrSettings(): DeepReadonly<HdhrSettings>;

  plexSettings(): DeepReadonly<PlexStreamSettings>;

  ffmpegSettings(): ReadableFfmpegSettings;

  globalMediaSourceSettings(): DeepReadonly<GlobalMediaSourceSettings>;

  ffprobePath: string;

  systemSettings(): DeepReadonly<SystemSettings>;

  directUpdate(
    fn: (settings: SettingsFile) => SettingsFile | void,
  ): Promise<void>;

  updateSettings<K extends keyof Settings>(
    key: K,
    settings: Settings[K],
  ): Promise<void>;

  updateBaseSettings<K extends keyof Omit<SettingsFile, 'settings'>>(
    key: K,
    settings: Partial<SettingsFile[K]>,
  ): Promise<void>;

  updateFfmpegSettings(ffmpegSettings: FfmpegSettings): Promise<void>;

  flush(): Promise<void>;
}

export type ReadableFfmpegSettings = DeepReadonly<FfmpegSettings>;
export type SettingsChangeEvents = {
  change: [Maybe<SettingsFile>];
};
