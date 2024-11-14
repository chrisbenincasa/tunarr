import { Nullable } from '../../../types/util.ts';
import { isNonEmptyString } from '../../../util/index.ts';
import { VideoFormats } from '../constants.js';
import { HardwareDownloadFilter } from '../filter/HardwareDownloadFilter.ts';
import { FrameState } from '../state/FrameState.js';
import { VideoEncoder } from './BaseEncoder.js';

export class Libx265Encoder extends VideoEncoder {
  protected readonly videoFormat: string = VideoFormats.Hevc;
  readonly affectsFrameState = true;

  get filter() {
    return new HardwareDownloadFilter(this.currentState).filter;
  }

  constructor(
    private currentState: FrameState,
    private videoPreset: Nullable<string>,
  ) {
    super('libx265');
  }

  options(): string[] {
    const opts = [
      ...super.options(),
      '-tag:v',
      'hvc1',
      '-x265-params',
      'log-level=error',
    ];
    if (isNonEmptyString(this.videoPreset)) {
      opts.push('-preset:v', this.videoPreset);
    }
    return opts;
  }

  updateFrameState(currentState: FrameState): FrameState {
    return super.updateFrameState(currentState).update({
      frameDataLocation: 'software',
    });
  }
}

export class LibKvazaarEncoder extends VideoEncoder {
  protected readonly videoFormat: string = VideoFormats.Hevc;
  readonly affectsFrameState = true;

  get filter() {
    return new HardwareDownloadFilter(this.currentState).filter;
  }

  constructor(
    private currentState: FrameState,
    private videoPreset: Nullable<string>,
  ) {
    super('libkvazaar');
  }

  options(): string[] {
    const opts = [...super.options()];
    if (isNonEmptyString(this.videoPreset)) {
      opts.push('-kvazaar-params', `preset=${this.videoPreset}`);
    }
    return opts;
  }

  updateFrameState(currentState: FrameState): FrameState {
    return super.updateFrameState(currentState).update({
      frameDataLocation: 'software',
    });
  }
}

export class Libx264Encoder extends VideoEncoder {
  protected readonly videoFormat: string = VideoFormats.H264;

  constructor(
    private videoProfile: Nullable<string>,
    private videoPreset: Nullable<string>,
  ) {
    super('libx264');
  }

  options(): string[] {
    const opts = [...super.options()];
    if (isNonEmptyString(this.videoPreset)) {
      opts.push('-profile:v', this.videoPreset);
    }
    if (isNonEmptyString(this.videoProfile)) {
      opts.push('-profile:v', this.videoProfile);
    }
    return opts;
  }
}

export class LibOpenH264Encoder extends VideoEncoder {
  protected readonly videoFormat: string = VideoFormats.H264;

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

export class Mpeg2VideoEncoder extends VideoEncoder {
  protected videoFormat: string = VideoFormats.Mpeg2Video;

  constructor() {
    super('mpeg2video');
  }
}

export class RawVideoEncoder extends VideoEncoder {
  protected videoFormat: string = VideoFormats.Raw;

  constructor() {
    super('rawvideo');
  }
}

export class CopyVideoEncoder extends VideoEncoder {
  protected readonly videoFormat: string = '';

  constructor() {
    super('copy');
  }
}

export class ImplicitVideoEncoder extends VideoEncoder {
  protected readonly videoFormat: string = '';

  constructor() {
    super('');
  }

  options(): string[] {
    return [];
  }
}
