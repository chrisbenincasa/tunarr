import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import type { Nullable } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import { VideoEncoder } from './BaseEncoder.js';

export class Libx264Encoder extends VideoEncoder {
  protected readonly videoFormat = VideoFormats.H264;

  constructor(
    private videoProfile: Nullable<string>,
    private videoPreset: Nullable<string>,
  ) {
    super('libx264');
  }

  options(): string[] {
    const opts = [...super.options()];
    // Force 8-bit output (yuv420p) to ensure compatibility with most players/devices.
    // Without this, libx264 may output 10-bit H.264 (High 10 profile) which many
    // hardware decoders cannot handle.
    opts.push('-pix_fmt', 'yuv420p');
    if (isNonEmptyString(this.videoPreset)) {
      opts.push('-profile:v', this.videoPreset);
    }
    if (isNonEmptyString(this.videoProfile)) {
      opts.push('-profile:v', this.videoProfile);
    }
    return opts;
  }
}
