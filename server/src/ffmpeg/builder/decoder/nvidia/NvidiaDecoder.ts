import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import { BaseDecoder } from '@/ffmpeg/builder/decoder/BaseDecoder.js';
import {
  PixelFormatCuda,
  PixelFormats,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import type { FrameState } from '../../state/FrameState.ts';

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

export class ImplicitNvidiaDecoder extends BaseDecoder {
  readonly name: string = 'implicit_cuda';

  protected _outputFrameDataLocation = FrameDataLocation.Hardware;

  options(): string[] {
    return ['-hwaccel_output_format', 'cuda'];
  }

  nextState(currentState: FrameState): FrameState {
    // TODO: the software format should probably be derived from this code:
    // https://github.com/FFmpeg/FFmpeg/blob/master/libavcodec/nvdec.c#L744-L773
    const nextState = super.nextState(currentState);
    return nextState.update({
      pixelFormat: new PixelFormatCuda(
        currentState.pixelFormatOrUnknown().toHardwareFormat() ??
          currentState.pixelFormatOrUnknown(),
      ),
    });
  }
}
