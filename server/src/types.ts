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

// type BaseLineupItem = {
//   err?: Error;
//   originalT0?: number;
//   streamDuration?: number;
//   beginningOffset?: number;
//   title?: string;
// };

// export type LineupItem =
//   | OfflineLineupItem
//   | ProgramLineupItem
//   | CommercialLineupItem
//   | LoadingLineupItem;

// export function isOfflineLineupItem(
//   item: LineupItem,
// ): item is OfflineLineupItem {
//   return item.type === 'offline';
// }

// export function isCommercialLineupItem(
//   item: LineupItem,
// ): item is CommercialLineupItem {
//   return item.type === 'commercial';
// }

// export function isProgramLineupItem(
//   item: LineupItem,
// ): item is ProgramLineupItem {
//   return item.type === 'program';
// }

// export function isPlexBackedLineupItem(
//   item: LineupItem,
// ): item is ContentBackedLineupItem {
//   return isCommercialLineupItem(item) || isProgramLineupItem(item);
// }

// export type ContentBackedLineupItem = CommercialLineupItem | ProgramLineupItem;

// type OfflineLineupItem = BaseLineupItem & {
//   type: 'offline';
//   duration: number;
//   start: number;
// };

// type LoadingLineupItem = BaseLineupItem & {
//   type: 'loading';
//   streamDuration: number;
//   duration: number;
//   start: number;
// };

// export type CommercialLineupItem = BaseLineupItem & {
//   type: 'commercial';
//   key: string;
//   plexFile: string;
//   file: string;
//   ratingKey: string;
//   start: number;
//   streamDuration: number;
//   beginningOffset: number;
//   duration: number;
//   serverKey: string;
//   fillerId: string;
// };

// type ProgramLineupItem = BaseLineupItem & {
//   type: 'program';
//   key: string;
//   plexFile: string;
//   file: string;
//   ratingKey: string;
//   start: number;
//   streamDuration: number;
//   beginningOffset: number;
//   duration: number;
//   serverKey: string;
//   title: string;
// };

// export const programToCommercial = (
//   program: Program,
// ): Intersection<CommercialLineupItem, Program> => {
//   return {
//     type: 'commercial',
//     key: program.key!,
//     plexFile: program.plexFile!,
//     file: program.file!,
//     ratingKey: program.ratingKey!,
//     // start: program.st
//     // streamDuration: program.
//     // beginningOffset
//     duration: program.duration,
//     serverKey: program.serverKey!,
//     title: program.title,
//     // fillerId:
//   };
// };

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
] as const;

export type ContextChannel = Pick<
  Channel & { offlinePicture?: string; offlineSoundtrack?: string },
  TupleToUnion<typeof CHANNEL_CONTEXT_KEYS>
>;

export type Intersection<X, Y> = {
  [PropX in keyof X & keyof Y]: X[PropX];
};
