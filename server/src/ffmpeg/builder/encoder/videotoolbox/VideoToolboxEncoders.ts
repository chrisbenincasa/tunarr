import { Nullable } from '../../../../types/util.ts';
import { isNonEmptyString } from '../../../../util/index.ts';
import { VideoFormats } from '../../constants.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameDataLocation } from '../../types.ts';
import { VideoEncoder } from '../BaseEncoder.ts';

export class VideoToolboxHevcEncoder extends VideoEncoder {
  constructor(private bitDepth: number) {
    super('hevc_videotoolbox');
  }

  protected videoFormat: string = VideoFormats.Hevc;

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

  protected videoFormat: string = VideoFormats.H264;

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
