import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import type { Nullable } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import { VideoEncoder } from './BaseEncoder.js';

export class LibOpenH264Encoder extends VideoEncoder {
  protected readonly videoFormat = VideoFormats.H264;

  constructor(private videoProfile: Nullable<string>) {
    super('libopenh264');
  }

  options(): string[] {
    const opts = [...super.options()];
    if (isNonEmptyString(this.videoProfile)) {
      opts.push('-profile:v', this.videoProfile);
    }
    return opts;
  }
}
