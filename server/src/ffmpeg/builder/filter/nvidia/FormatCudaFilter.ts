import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type {
  PixelFormat,
  ValidPixelFormatName,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import { PixelFormats } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';

export class FormatCudaFilter extends FilterOption {
  public affectsFrameState: boolean = true;

  static supportedPixelFormats: ValidPixelFormatName[] = [
    PixelFormats.YUV420P,
    PixelFormats.NV12,
    PixelFormats.YUV444P,
    PixelFormats.P010,
    PixelFormats.YUV444P16LE,
    PixelFormats.CUDA,
  ] as const;

  constructor(private pixelFormat: PixelFormat) {
    super();
  }

  get filter() {
    const fmt = this.supportedPixelFormat;

    if (!fmt) {
      return '';
    }

    return `scale_cuda=format=${fmt.name}`;
  }

  private get supportedPixelFormat() {
    return FormatCudaFilter.supportedPixelFormats.includes(
      this.pixelFormat.name,
    )
      ? this.pixelFormat
      : this.pixelFormat.toHardwareFormat();
  }

  nextState(currentState: FrameState): FrameState {
    const fmt = this.supportedPixelFormat;
    if (!fmt) {
      return currentState;
    }

    return currentState.update({
      pixelFormat: fmt,
    });
  }
}
