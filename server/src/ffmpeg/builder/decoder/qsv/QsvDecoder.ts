import { BaseDecoder } from '@/ffmpeg/builder/decoder/BaseDecoder.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { BaseFfmpegHardwareCapabilities } from '../../capabilities/BaseFfmpegHardwareCapabilities.ts';
import { InputSource } from '../../input/InputSource.ts';
import { KnownFfmpegOptions } from '../../options/KnownFfmpegOptions.ts';

export abstract class QsvDecoder extends BaseDecoder {
  affectsFrameState: boolean = true;

  protected outputFrameDataLocation: FrameDataLocation = 'hardware';

  protected constructor(
    public name: string,
    private hardwareCapabilities: BaseFfmpegHardwareCapabilities,
  ) {
    super();
  }

  options(inputSource: InputSource): string[] {
    const baseOptions = super.options(inputSource);
    if (
      this.hardwareCapabilities.hasDecoderOption(KnownFfmpegOptions.GpuCopy)
    ) {
      baseOptions.unshift(`-${KnownFfmpegOptions.GpuCopy}`, '1');
    }
    return baseOptions;
  }
}
