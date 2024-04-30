import { Nullable } from '../../../../types/util.ts';
import { isNonEmptyString } from '../../../../util/index.ts';
import { VideoFormats } from '../../constants.ts';
import { VideoEncoder } from '../BaseEncoder.ts';

abstract class QsvEncoder extends VideoEncoder {
  protected constructor(name: string) {
    super(name);
  }

  options(): string[] {
    return [...super.options(), '-low_power', '0', '-look_ahead', '0'];
  }
}

export class Mpeg2QsvEncoder extends QsvEncoder {
  protected videoFormat: string = VideoFormats.Mpeg2Video;

  constructor() {
    super('mpeg2_qsv');
  }
}

export class H264QsvEncoder extends QsvEncoder {
  protected videoFormat: string = VideoFormats.H264;

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
