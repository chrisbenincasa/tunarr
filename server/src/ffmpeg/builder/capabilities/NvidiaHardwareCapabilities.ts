import { Maybe } from '../../../types/util';
import { run } from '../../../util';
import { FFMPEGInfo } from '../../ffmpegInfo';
import { PixelFormat } from '../format/PixelFormat';
import { BaseFfmpegHardwareCapabilities } from './BaseFfmpegHardwareCapabilities';

const MaxwellGm206Models = new Set([
  'GTX 750',
  'GTX 950',
  'GTX 960',
  'GTX 965M',
]);

// https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix-new
export class NvidiaHardwareCapabilities extends BaseFfmpegHardwareCapabilities {
  readonly type = 'nvidia' as const;

  constructor(
    private model: string,
    private arch: number,
    ffmpegInfo: FFMPEGInfo,
    // ffmpegBinaryCapabilities: FfmpegBinaryCapabilities,
  ) {
    super(ffmpegInfo);
  }

  // Will be used eventually
  canDecode(
    videoFormat: string,
    _videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): Promise<boolean> {
    // TODO: Clean this up with ffmpeg builder and consts
    const bitDepth = pixelFormat?.bitDepth ?? 8;

    let canUseHardware = false;

    switch (videoFormat) {
      case 'hevc':
        canUseHardware =
          (this.arch === 52 && MaxwellGm206Models.has(this.model)) ||
          this.arch >= 60;
        break;

      case 'h264':
        canUseHardware = bitDepth < 10;
        break;

      case 'mpeg2video':
        canUseHardware = true;
        break;

      case 'mp4':
        canUseHardware = false;
        break;

      case 'av1':
        canUseHardware = this.arch >= 86;
        break;

      case 'vp9':
        canUseHardware =
          bitDepth === 10
            ? this.arch >= 60
            : (this.arch === 52 && MaxwellGm206Models.has(this.model)) ||
              this.arch >= 60;
        break;

      default:
        break;
    }

    // TODO: Check binary capabilities
    return Promise.resolve(canUseHardware);
  }

  canEncode(
    videoFormat: string,
    _videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): Promise<boolean> {
    // TODO: Clean this up with ffmpeg builder and consts
    const bitDepth = pixelFormat?.bitDepth ?? 8;

    return Promise.resolve(
      run(() => {
        if (videoFormat === 'hevc') {
          if (bitDepth === 10) {
            return this.arch >= 60;
          } else {
            return this.arch >= 52;
          }
        } else if (videoFormat === 'h264' && bitDepth === 10) {
          return false;
        }

        return true;
      }),
    );
  }
}
