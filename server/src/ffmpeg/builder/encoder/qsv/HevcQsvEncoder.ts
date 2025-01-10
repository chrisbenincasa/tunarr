import { VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { Nullable } from '@/types/util.ts';
import { isNonEmptyString } from '@/util/index.ts';
import { QsvEncoder } from './QsvEncoders.ts';

export class HevcQsvEncoder extends QsvEncoder {
  protected videoFormat: string = VideoFormats.Hevc;

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
