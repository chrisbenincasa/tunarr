import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import { VideoEncoder } from '@/ffmpeg/builder/encoder/BaseEncoder.js';
import type { Nullable } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';

export class NvidiaHevcEncoder extends VideoEncoder {
  protected videoFormat = VideoFormats.Hevc;

  constructor(private videoPreset: Nullable<string>) {
    super('hevc_nvenc');
  }

  options(): string[] {
    // TODO add options/support for HEVC b-frames
    const opts = [
      ...super.options(),
      '-b_ref_mode',
      '0',
      '-rc-lookahead',
      '20',
    ];
    if (isNonEmptyString(this.videoPreset)) {
      opts.push('-preset:v', this.videoPreset);
    }

    return opts;
  }
}

export class NvidiaH264Encoder extends VideoEncoder {
  protected videoFormat = VideoFormats.H264;

  constructor(
    private videoProfile: Nullable<string>,
    private videoPreset: Nullable<string>,
  ) {
    super('h264_nvenc');
  }

  options(): string[] {
    const opts = super.options();
    if (isNonEmptyString(this.videoProfile)) {
      opts.push('-profile:v', this.videoProfile.toLowerCase());
    }

    if (isNonEmptyString(this.videoPreset)) {
      opts.push('-preset:v', this.videoPreset.toLowerCase());
    }

    opts.push('-rc-lookahead', '20');

    return opts;
  }
}
