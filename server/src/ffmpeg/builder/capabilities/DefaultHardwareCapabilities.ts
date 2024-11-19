import { VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.ts';
import { Maybe } from '@/types/util.ts';
import { BaseFfmpegHardwareCapabilities } from './BaseFfmpegHardwareCapabilities.ts';

export class DefaultHardwareCapabilities extends BaseFfmpegHardwareCapabilities {
  readonly type = 'none' as const;
  constructor() {
    super();
  }

  canDecode(
    videoFormat: string,
    _videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): boolean {
    const bitDepth = pixelFormat?.bitDepth ?? 8;
    if (videoFormat === VideoFormats.H264 && bitDepth === 10) {
      return false;
    }
    return true;
  }

  canEncode(
    videoFormat: string,
    videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): boolean {
    // These are the same...for now
    return this.canDecode(videoFormat, videoProfile, pixelFormat);
  }
}
