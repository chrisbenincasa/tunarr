import { FfmpegSettings, Watermark } from '@tunarr/types';
import { EntityManager } from './dao/dataSource.js';
import { StreamLineupItem } from './dao/derived_types/StreamLineup.js';
import { Channel } from './dao/entities/Channel.js';
import { Settings } from './dao/settings.js';

export type GlobalOptions = {
  database: string;
  force_migration: boolean;
  log_level: string;
  verbose?: number;
};

export type ServerOptions = GlobalOptions & {
  port: number;
  printRoutes: boolean;
};

export type Maybe<T> = T | undefined;
export type Nullable<T> = T | null;

export type PlayerContext = {
  lineupItem: StreamLineupItem;
  ffmpegSettings: FfmpegSettings;
  channel: ContextChannel;
  m3u8: boolean;
  audioOnly: boolean;
  isLoading?: boolean;
  watermark?: Watermark;
  entityManager: EntityManager;
  settings: Settings;
};

type TupleToUnion<T extends ReadonlyArray<unknown>> = T[number];

// Typescript is wild... define a static tuple and also
// derive a union type, so we can use the tuple for actually picking
// the keys to keep from Channel in a typesafe way!
// type InferArray

export const CHANNEL_CONTEXT_KEYS = [
  'disableFillerOverlay',
  'watermark',
  'icon',
  'offlinePicture',
  'offlineSoundtrack',
  'name',
  'transcoding',
  'number',
  'uuid',
] as const;

export type ContextChannel = Pick<
  Channel & { offlinePicture?: string; offlineSoundtrack?: string },
  TupleToUnion<typeof CHANNEL_CONTEXT_KEYS>
>;

export type Intersection<X, Y> = {
  [PropX in keyof X & keyof Y]: X[PropX];
};
