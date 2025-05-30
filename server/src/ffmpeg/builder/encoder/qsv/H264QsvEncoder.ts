import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import type { Nullable } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import { QsvEncoder } from './QsvEncoders.ts';

export class H264QsvEncoder extends QsvEncoder {
  protected videoFormat = VideoFormats.H264;

  constructor(
    private videoPreset: Nullable<string>,
    private videoProfile: Nullable<string>,
  ) {
    super('h264_qsv');
  }

  options(): string[] {
    const opts = [...super.options()];
    if (isNonEmptyString(this.videoProfile)) {
      opts.push('-profile:v', this.videoProfile);
    }
    if (isNonEmptyString(this.videoPreset)) {
      opts.push('-preset:v', this.videoPreset);
    }
    return opts;
  }
}
