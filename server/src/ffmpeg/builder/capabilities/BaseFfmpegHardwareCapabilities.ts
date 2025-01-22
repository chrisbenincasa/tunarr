import type { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { RateControlMode } from '@/ffmpeg/builder/types.js';
import type { Maybe, Nilable } from '@/types/util.js';
import type { NvidiaHardwareCapabilities } from './NvidiaHardwareCapabilities.ts';

export interface FfmpegHardwareCapabilitiesFactory {
  getCapabilities(): Promise<BaseFfmpegHardwareCapabilities>;
}
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

  // Right now we assume that all decoders for a hw "class"
  // have the same decoder options. This is not necessarily true.
  hasDecoderOption(_opt: string): boolean {
    return false;
  }
}

export type FfmpegHardwareCapabilities = NvidiaHardwareCapabilities;
