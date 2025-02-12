import type {
  MigrationState,
  Settings,
  SettingsFile,
} from '@/db/SettingsDB.js';
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
import type { DeepReadonly } from 'ts-essentials';
import type { TypedEventEmitter } from '../../types/eventEmitter.ts';

export interface ISettingsDB extends TypedEventEmitter<SettingsChangeEvents> {
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
  change(): void;
};
