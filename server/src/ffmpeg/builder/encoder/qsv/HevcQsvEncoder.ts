import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import type { Nullable } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import { QsvEncoder } from './QsvEncoders.ts';

export class HevcQsvEncoder extends QsvEncoder {
  protected videoFormat = VideoFormats.Hevc;

  constructor(private videoPreset: Nullable<string>) {
    super('hevc_qsv');
  }

  options(): string[] {
    const opts = [...super.options()];
    if (isNonEmptyString(this.videoPreset)) {
      opts.push('-preset:v', this.videoPreset);
    }
    return opts;
  }
}
