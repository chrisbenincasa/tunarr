import type { FfmpegVersionResult } from '../../../ffmpegInfo.ts';
import type { VideoFormat } from '../../constants.ts';
import { VideoFormats } from '../../constants.ts';
import { OutputOption } from '../../options/OutputOption.ts';
import type { FrameSize } from '../../types.ts';

/**
 * Whether this ffmpeg keeps the requested size on CUDA filter output frames.
 *
 * Unpatched ffmpeg (7.x and stock 8.x) hands nvenc 1088- or 736-row frames
 * after overlay_cuda, which shows as a green band at the bottom. ErsatzTV's
 * 8.x builds carry a patch that fixes it, so they need no crop workaround.
 * Their version strings look like `n8.1.2-etv.7` or `8.1.2-etv-gb138f203`.
 */
export function ffmpegKeepsCudaFrameSize(version: FfmpegVersionResult) {
  return (
    !version.isUnknown &&
    (version.majorVersion ?? 0) >= 8 &&
    /-etv[.-]/.test(version.versionString)
  );
}

export class NvidiaCropBottomBitstreamFilter extends OutputOption {
  constructor(
    private videoFormat: VideoFormat,
    private frameSize: FrameSize,
  ) {
    super();
  }

  options(): string[] {
    if (this.videoFormat !== VideoFormats.H264) {
      return [];
    }

    let cropPixels = 0;
    switch (this.frameSize.height) {
      case 1080:
        cropPixels = 8;
        break;
      case 720:
        cropPixels = 16;
        break;
      default:
        break;
    }

    if (cropPixels === 0) {
      return [];
    }

    return ['-bsf:v', `${this.videoFormat}_metadata=crop_bottom=${cropPixels}`];
  }
}
