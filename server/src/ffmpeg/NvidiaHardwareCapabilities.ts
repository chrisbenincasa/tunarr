import { Maybe } from '../types/util.ts';

const MaxwellGm206Models = new Set([
  'GTX 750',
  'GTX 950',
  'GTX 960',
  'GTX 965M',
]);

// https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix-new
export class NvidiaHardwareCapabilities {
  constructor(
    private model: string,
    private arch: number,
  ) {}

  // Will be used eventually
  canDecode(
    videoFormat: string,
    pixelFormat: Maybe<{ bitDepth: number }>,
  ): boolean {
    // TODO: Clean this up with ffmpeg builder and consts
    const bitDepth = pixelFormat?.bitDepth ?? 8;

    switch (videoFormat) {
      case 'hevc':
        return (
          (this.arch === 52 && MaxwellGm206Models.has(this.model)) ||
          this.arch >= 60
        );

      case 'h264':
        return bitDepth < 10;

      case 'mpeg2video':
        return true;

      case 'mp4':
        return false;

      case 'av1':
        return this.arch >= 86;

      case 'vp9':
        return bitDepth === 10
          ? this.arch >= 60
          : (this.arch === 52 && MaxwellGm206Models.has(this.model)) ||
              this.arch >= 60;

      default:
        return false;
    }
  }

  canEncode(
    videoFormat: string,
    pixelFormat: Maybe<{ bitDepth: number }>,
  ): boolean {
    // TODO: Clean this up with ffmpeg builder and consts
    const bitDepth = pixelFormat?.bitDepth ?? 8;

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
  }
}
