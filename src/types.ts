import { FfmpegSettings } from './dao/db.js';

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
  db: any;
  m3u8: boolean;
  audioOnly: boolean;
  isLoading?: boolean;
};
