import { Maybe, Nilable } from '../../../types/util.ts';
import { VideoStream } from '../MediaStream.ts';
import { PixelFormat } from '../format/PixelFormat.ts';
import { FrameState } from '../state/FrameState.ts';
import { RateControlMode } from '../types.ts';
import { NvidiaHardwareCapabilities } from './NvidiaHardwareCapabilities.ts';

export abstract class BaseFfmpegHardwareCapabilities {
  readonly type: string;
  constructor() {}

  // Convenience
  canDecodeVideoStream(videoStream: VideoStream) {
    return this.canDecode(
      videoStream.codec,
      videoStream.profile,
      videoStream.pixelFormat,
    );
  }

  canEncodeState(frameState: FrameState) {
    return this.canEncode(
      frameState.videoFormat,
      frameState.videoProfile,
      frameState.pixelFormat,
    );
  }

  abstract canDecode(
    videoFormat: string,
    videoProfile: Nilable<string>,
    pixelFormat: Nilable<PixelFormat>,
  ): boolean;

  abstract canEncode(
    videoFormat: string,
    videoProfile: Nilable<string>,
    pixelFormat: Nilable<PixelFormat>,
  ): boolean;

  getRateControlMode(
    _videoFormat: string,
    _pixelFormat: Maybe<PixelFormat>,
  ): Maybe<RateControlMode> {
    return;
  }
}

export type FfmpegHardwareCapabilities = NvidiaHardwareCapabilities;
