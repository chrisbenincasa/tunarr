import type { Nilable } from '../../../types/util.ts';
import type { PixelFormat } from '../format/PixelFormat.ts';
import { BaseFfmpegHardwareCapabilities } from './BaseFfmpegHardwareCapabilities.ts';

export class QsvHardwareCapabilities extends BaseFfmpegHardwareCapabilities {
  constructor(
    private underlyingCapabilities: BaseFfmpegHardwareCapabilities,
    private decoderOptions: string[],
  ) {
    super();
  }

  canDecode(
    videoFormat: string,
    videoProfile: Nilable<string>,
    pixelFormat: Nilable<PixelFormat>,
  ): boolean {
    return this.underlyingCapabilities.canDecode(
      videoFormat,
      videoProfile,
      pixelFormat,
    );
  }

  canEncode(
    videoFormat: string,
    videoProfile: Nilable<string>,
    pixelFormat: Nilable<PixelFormat>,
  ): boolean {
    return this.underlyingCapabilities.canEncode(
      videoFormat,
      videoProfile,
      pixelFormat,
    );
  }

  hasDecoderOption(opt: string): boolean {
    return this.decoderOptions.includes(opt);
  }
}
