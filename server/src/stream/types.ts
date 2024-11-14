import { Duration } from 'dayjs/plugin/duration.js';
import { first, isNull, isUndefined } from 'lodash-es';
import { Dictionary } from 'ts-essentials';
import {
  KnownPixelFormats,
  PixelFormat,
  PixelFormatUnknown,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../ffmpeg/builder/format/PixelFormat.ts';
import { Nullable } from '../types/util.ts';
import { isNonEmptyString } from '../util/index.ts';

export type StreamDetails = {
  duration?: Duration;
  // This is the total bitrate
  bitrate?: number;

  // If defined, there is at least one video stream
  videoDetails?: [VideoStreamDetails, ...VideoStreamDetails[]];
  audioDetails?: [AudioStreamDetails, ...AudioStreamDetails[]];

  audioOnly?: boolean;
  placeholderImage?: string;
  serverPath?: string;
  directFilePath?: string;
};

export type VideoStreamDetails = {
  codec?: string;
  profile?: string;
  width: number;
  height: number;
  framerate?: number;
  scanType?: 'interlaced' | 'progressive' | 'unknown';
  pixelFormat?: string;
  bitDepth?: number;
  streamIndex?: string;
  sampleAspectRatio: string;
  displayAspectRatio: string;
  anamorphic?: boolean;
  bitrate?: number;
  isAttachedPic?: boolean;
};

export type AudioStreamDetails = {
  channels?: number;
  codec?: string;
  index?: string;
  bitrate?: number;
  profile?: string;
  default?: boolean;
  title?: string;
  language?: string;
  forced?: boolean;
};

// TODO: Move me
export function getPixelFormatForStream(details: StreamDetails) {
  if (isUndefined(first(details.videoDetails))) {
    return PixelFormatUnknown();
  }

  const videoStream = first(details.videoDetails)!;

  let format: Nullable<PixelFormat> = null;
  if (isNonEmptyString(videoStream.pixelFormat)) {
    format = KnownPixelFormats.forPixelFormat(videoStream.pixelFormat) ?? null;
  }

  if (isNull(format)) {
    switch (videoStream.bitDepth) {
      case 8: {
        format = new PixelFormatYuv420P();
        break;
      }
      case 10: {
        format = new PixelFormatYuv420P10Le();
        break;
      }
      default: {
        format = PixelFormatUnknown(videoStream.bitDepth);
        break;
      }
    }
  }

  return format;
}

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

export type ProgramStream = {
  streamSource: StreamSource;
  streamDetails: StreamDetails;
};
