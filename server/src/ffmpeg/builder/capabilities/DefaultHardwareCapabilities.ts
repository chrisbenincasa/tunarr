import { Maybe } from '../../../types/util';
import { run } from '../../../util';
import { FFMPEGInfo } from '../../ffmpegInfo';
import { VideoFormats } from '../constants';
import { PixelFormat } from '../format/PixelFormat';
import { BaseFfmpegHardwareCapabilities } from './BaseFfmpegHardwareCapabilities';

export class DefaultHardwareCapabilities extends BaseFfmpegHardwareCapabilities {
  readonly type = 'none' as const;
  constructor(ffmpegInfo: FFMPEGInfo) {
    super(ffmpegInfo);
  }

  canDecode(
    videoFormat: string,
    _videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): Promise<boolean> {
    const bitDepth = pixelFormat?.bitDepth ?? 8;
    return Promise.resolve(
      run(() => {
        if (videoFormat === VideoFormats.H264 && bitDepth === 10) {
          return false;
        }
        return true;
      }),
    );
  }

  canEncode(
    videoFormat: string,
    videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): Promise<boolean> {
    // These are the same...for now
    return this.canDecode(videoFormat, videoProfile, pixelFormat);
  }
}
