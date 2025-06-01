import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import { VideoEncoder } from '@/ffmpeg/builder/encoder/BaseEncoder.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import type { Nullable } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';

export class VideoToolboxHevcEncoder extends VideoEncoder {
  constructor(private bitDepth: number) {
    super('hevc_videotoolbox');
  }

  protected videoFormat = VideoFormats.Hevc;

  options(): string[] {
    return [
      ...super.options(),
      '-profile:v',
      this.bitDepth === 10 ? 'main10' : 'main',
    ];
  }

  affectsFrameState: boolean = true;

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      videoFormat: this.videoFormat,
      frameDataLocation: FrameDataLocation.Hardware,
    });
  }
}

export class VideoToolboxH264Encoder extends VideoEncoder {
  constructor(private videoProfile: Nullable<string>) {
    super('h264_videotoolbox');
  }

  protected videoFormat = VideoFormats.H264;

  affectsFrameState: boolean = true;

  options(): string[] {
    const opts = [...super.options()];
    if (isNonEmptyString(this.videoProfile)) {
      opts.push('-profile:v', this.videoProfile);
    }
    return opts;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      videoFormat: this.videoFormat,
      frameDataLocation: FrameDataLocation.Hardware,
    });
  }
}
