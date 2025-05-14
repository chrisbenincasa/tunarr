import { first, isNull, isUndefined } from 'lodash-es';
import {
  KnownPixelFormats,
  PixelFormatUnknown,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
  type PixelFormat,
} from '../ffmpeg/builder/format/PixelFormat.ts';
import type { Nullable } from '../types/util.ts';
import { isNonEmptyString } from '../util/index.ts';
import type { StreamDetails } from './types.ts';

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

export function isImageBasedSubtitle(codec: string) {
  return [
    'hdmv_pgs_subtitle',
    'dvd_subtitle',
    'dvdsub',
    'vobsub',
    'pgssub',
    'pgs',
  ].includes(codec);
}
