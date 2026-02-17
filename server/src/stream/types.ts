import type { MediaChapter } from '@tunarr/types';
import type { Duration } from 'dayjs/plugin/duration.js';
import type { Dictionary, NonEmptyArray } from 'ts-essentials';
import type { Maybe } from '../types/util.ts';

export type StreamDetails = {
  duration: Duration;
  // This is the total bitrate
  bitrate?: number;

  // If defined, there is at least one video stream
  videoDetails?: NonEmptyArray<VideoStreamDetails>;
  audioDetails?: NonEmptyArray<AudioStreamDetails>;
  subtitleDetails?: NonEmptyArray<SubtitleStreamDetails>;

  audioOnly?: boolean;
  placeholderImage?: StreamSource;
  serverPath?: string;
  directFilePath?: string;
  chapters?: MediaChapter[];
};

export type VideoStreamDetails = {
  codec: Maybe<string>;
  profile: Maybe<string>;
  width: number;
  height: number;
  framerate: Maybe<number | string>;
  scanType?: 'interlaced' | 'progressive' | 'unknown';
  pixelFormat: Maybe<string>;
  bitDepth: Maybe<number>;
  streamIndex: Maybe<number>;
  sampleAspectRatio?: string;
  displayAspectRatio: string;
  anamorphic: Maybe<boolean>;
  bitrate: Maybe<number>;
  isAttachedPic: Maybe<boolean>;
  colorRange: Maybe<string>;
  colorSpace: Maybe<string>;
  colorTransfer: Maybe<string>;
  colorPrimaries: Maybe<string>;
};

export type AudioStreamDetails = {
  channels?: number;
  codec?: string;
  index: number;
  bitrate?: number;
  profile?: string;
  default?: boolean;
  selected?: boolean;
  title?: string;
  language?: string;
  languageCodeISO6391?: string;
  languageCodeISO6392?: string;
  forced?: boolean;
};

export type SubtitleType = 'embedded' | 'external';

export type SubtitleStreamDetails = {
  type: SubtitleType;
  title?: string;
  description?: string;
  index?: number; // External subs have no index
  codec: string;
  default: boolean;
  forced: boolean;
  sdh: boolean;
  language?: string;
  languageCodeISO6391?: string;
  languageCodeISO6392?: string;
  path?: string; // For external
};

export interface IStreamSource {
  type: string;
  path: string;
}

export class HttpStreamSource implements IStreamSource {
  readonly type = 'http' as const;

  constructor(
    public path: string,
    public extraHeaders: Dictionary<string> = {},
  ) {}

  redact() {
    this.path = this.path
      .replaceAll(/(X-Plex-Token=)([A-z0-9_\\-]+)/g, '$1REDACTED')
      .replaceAll(/(X-Emby-Token:\s)([A-z0-9_\\-]+)/g, '$1REDACTED');
    if (this.extraHeaders['X-Emby-Token']) {
      this.extraHeaders['X-Emby-Token'] = 'REDACTED';
    }
  }
}

export class FileStreamSource implements IStreamSource {
  readonly type = 'file' as const;

  constructor(public path: string) {}
}

export class FilterStreamSource implements IStreamSource {
  readonly type = 'filter' as const;
  constructor(public path: string) {}
}

export class OfflineStreamSource implements IStreamSource {
  private static INSTANCE: OfflineStreamSource;

  readonly type = 'offline' as const;
  readonly path = '';

  private constructor() {}

  public static instance() {
    return this.INSTANCE || (this.INSTANCE = new OfflineStreamSource());
  }
}

export class ErrorStreamSource implements IStreamSource {
  readonly type = 'error' as const;
  readonly path = '';

  constructor(
    public title: string,
    public subtitle?: string,
  ) {}
}

export type StreamSource =
  | FileStreamSource
  | HttpStreamSource
  | OfflineStreamSource
  | ErrorStreamSource;

export type ProgramStreamResult = {
  streamSource: StreamSource;
  streamDetails: StreamDetails;
};
