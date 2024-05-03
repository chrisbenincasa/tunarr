import { once } from 'lodash-es';
import { VideoEncoder } from './BaseEncoder.js';
import { FrameState } from '../state/FrameState.js';

export class Libx265Encoder extends VideoEncoder {
  readonly affectsFrameState = true;

  private constructor() {
    super('libx265');
  }

  static create = once(() => new Libx265Encoder());

  options(): string[] {
    const defaults = super.options();
    return [...defaults, '-tag:v', 'hvc1', '-x265-params', 'log-level=error'];
  }

  updateFrameState(currentState: FrameState): FrameState {
    return {
      ...currentState,
      frameDataLocation: 'software',
    };
  }
}

export class Libx264Encoder extends VideoEncoder {
  private constructor() {
    super('libx264');
  }

  static create = once(() => new Libx264Encoder());
}

export class Mpeg2VideoEncoder extends VideoEncoder {
  private constructor() {
    super('mpeg2video');
  }

  static create = once(() => new Mpeg2VideoEncoder());
}

export class CopyVideoEncoder extends VideoEncoder {
  private constructor() {
    super('copy');
  }

  static create = once(() => new CopyVideoEncoder());
}

export class ImplicitVideoEncoder extends VideoEncoder {
  private constructor() {
    super('');
  }

  static create = once(() => new ImplicitVideoEncoder());

  options(): string[] {
    return [];
  }
}
