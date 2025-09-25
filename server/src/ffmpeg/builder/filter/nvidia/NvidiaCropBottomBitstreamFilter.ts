import type { VideoFormat } from '../../constants.ts';
import { VideoFormats } from '../../constants.ts';
import { OutputOption } from '../../options/OutputOption.ts';
import type { FrameSize } from '../../types.ts';

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
