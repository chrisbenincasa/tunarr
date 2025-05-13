import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import { VideoEncoder } from '@/ffmpeg/builder/encoder/BaseEncoder.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { RateControlMode } from '@/ffmpeg/builder/types.js';
import type { Maybe } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';

abstract class VaapiEncoder extends VideoEncoder {
  protected constructor(
    name: string,
    protected rateControlMode: RateControlMode,
  ) {
    super(name);
  }

  options(): string[] {
    const opts = [...super.options()];
    if (this.rateControlMode === RateControlMode.CQP) {
      opts.push('-rc_mode', '1');
    }
    return opts;
  }
}

export class Mpeg2VaapiEncoder extends VaapiEncoder {
  protected videoFormat = VideoFormats.Mpeg2Video;

  constructor(rateControlMode: RateControlMode) {
    super('mpeg2_vaapi', rateControlMode);
  }

  nextState(currentState: FrameState): FrameState {
    return super.nextState(currentState).update({
      videoFormat: VideoFormats.Mpeg2Video,
    });
  }
}

export class H264VaapiEncoder extends VaapiEncoder {
  protected videoFormat = VideoFormats.H264;

  constructor(
    private videoProfile: Maybe<string>,
    rateControlMode: RateControlMode,
  ) {
    super('h264_vaapi', rateControlMode);
  }

  options(): string[] {
    const opts = [...super.options(), '-sei', '-a53_cc'];
    if (isNonEmptyString(this.videoProfile)) {
      opts.push('-profile:v', this.videoProfile.toLowerCase());
    }
    return opts;
  }

  nextState(currentState: FrameState): FrameState {
    return super.nextState(currentState).update({
      videoFormat: VideoFormats.H264,
    });
  }
}

export class HevcVaapiEncoder extends VaapiEncoder {
  protected videoFormat = VideoFormats.Hevc;

  constructor(rateControlMode: RateControlMode) {
    super('hevc_vaapi', rateControlMode);
  }

  options(): string[] {
    return [...super.options(), '-sei', '-a53_cc'];
  }

  nextState(currentState: FrameState): FrameState {
    return super.nextState(currentState).update({
      videoFormat: VideoFormats.Hevc,
    });
  }
}
