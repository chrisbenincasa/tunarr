import { DbAccess, FfmpegSettings } from './dao/db.js';

export type GlobalOptions = {
  database: string;
  force_migration: boolean;
};

export type ServerOptions = GlobalOptions & {
  port: number;
};

export type Maybe<T> = T | undefined;

export type PlayerContext = {
  lineupItem: any;
  ffmpegSettings: FfmpegSettings;
  channel: any;
  m3u8: boolean;
  audioOnly: boolean;
  isLoading?: boolean;
  watermark?: boolean;
  dbAccess: DbAccess;
};

type BaseLineupItem = {
  err?: Error;
  originalT0?: number;
  streamDuration?: number;
  beginningOffset?: number;
  title?: string;
};

export type LineupItem =
  | OfflineLineupItem
  | ProgramLineupItem
  | CommercialLineupItem
  | LoadingLineupItem;

type OfflineLineupItem = BaseLineupItem & {
  type: 'offline';
  duration: number;
  start: number;
};

type LoadingLineupItem = BaseLineupItem & {
  type: 'loading';
  streamDuration: number;
  duration: number;
  start: number;
};

type CommercialLineupItem = BaseLineupItem & {
  type: 'commercial';
  key: string;
  plexFile: string;
  file: string;
  ratingKey: string;
  start: number;
  streamDuration: number;
  beginningOffset: number;
  duration: number;
  serverKey: string;
  fillerId: string;
};

type ProgramLineupItem = BaseLineupItem & {
  type: 'program';
  key: string;
  plexFile: string;
  file: string;
  ratingKey: string;
  start: number;
  streamDuration: number;
  beginningOffset: number;
  duration: number;
  serverKey: string;
};
