import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import { BaseDecoder } from '@/ffmpeg/builder/decoder/BaseDecoder.js';
import { PixelFormats } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';

export abstract class NvidiaDecoder extends BaseDecoder {
  constructor(private _hardwareAccelerationMode: HardwareAccelerationMode) {
    super();
  }

  protected get _outputFrameDataLocation() {
    return this.hardwareAccelerationMode === HardwareAccelerationMode.None
      ? FrameDataLocation.Software
      : FrameDataLocation.Hardware;
  }

  get hardwareAccelerationMode() {
    return this._hardwareAccelerationMode;
  }

  set hardwareAccelerationMode(mode: HardwareAccelerationMode) {
    this._hardwareAccelerationMode = mode;
  }

  options(inputFile: InputSource): string[] {
    const result = super.options(inputFile);
    if (this.hardwareAccelerationMode !== HardwareAccelerationMode.None) {
      result.push('-hwaccel_output_format', 'cuda');
    } else {
      result.push(
        '-hwaccel_output_format',
        super.inputBitDepth(inputFile) === 10
          ? PixelFormats.P010
          : PixelFormats.NV12,
      );
    }

    return result;
  }
}
