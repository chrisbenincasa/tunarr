import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.ts';
import { BaseDecoder } from '@/ffmpeg/builder/decoder/BaseDecoder.ts';
import { PixelFormats } from '@/ffmpeg/builder/format/PixelFormat.ts';
import { InputSource } from '@/ffmpeg/builder/input/InputSource.ts';
import { FrameDataLocation } from '@/ffmpeg/builder/types.ts';

export abstract class NvidiaDecoder extends BaseDecoder {
  protected outputFrameDataLocation: FrameDataLocation;

  constructor(private hardwareAccelerationMode: HardwareAccelerationMode) {
    super();
    this.outputFrameDataLocation =
      hardwareAccelerationMode === HardwareAccelerationMode.None
        ? FrameDataLocation.Software
        : FrameDataLocation.Hardware;
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
