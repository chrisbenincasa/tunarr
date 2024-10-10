import { once } from 'lodash-es';
import { VideoEncoder } from './BaseEncoder.js';
import { FrameState } from '../state/FrameState.js';
import { VideoFormats } from '../constants.js';

export class Libx265Encoder extends VideoEncoder {
  protected readonly videoFormat: string = VideoFormats.Hevc;
  readonly affectsFrameState = true;

  // TODO probably need an hw download filter here

  private constructor() {
    super('libx265');
  }

  static create = once(() => new Libx265Encoder());

  options(): string[] {
    const defaults = super.options();
    return [...defaults, '-tag:v', 'hvc1', '-x265-params', 'log-level=error'];
  }

  updateFrameState(currentState: FrameState): FrameState {
    return super.updateFrameState(currentState).update({
      frameDataLocation: 'software',
    });
  }
}

export class Libx264Encoder extends VideoEncoder {
  protected readonly videoFormat: string = VideoFormats.H264;

  private constructor() {
    super('libx264');
  }

  static create = once(() => new Libx264Encoder());
}

export class Mpeg2VideoEncoder extends VideoEncoder {
  protected videoFormat: string = VideoFormats.Mpeg2Video;

  private constructor() {
    super('mpeg2video');
  }

  static create = once(() => new Mpeg2VideoEncoder());
}

export class RawVideoEncoder extends VideoEncoder {
  protected videoFormat: string = VideoFormats.Raw;

  private constructor() {
    super('rawvideo');
  }

  static create = once(() => new RawVideoEncoder());
}

export class CopyVideoEncoder extends VideoEncoder {
  protected readonly videoFormat: string = '';

  private constructor() {
    super('copy');
  }

  static create = once(() => new CopyVideoEncoder());
}

export class ImplicitVideoEncoder extends VideoEncoder {
  protected readonly videoFormat: string = '';

  private constructor() {
    super('');
  }

  static create = once(() => new ImplicitVideoEncoder());

  options(): string[] {
    return [];
  }
}
