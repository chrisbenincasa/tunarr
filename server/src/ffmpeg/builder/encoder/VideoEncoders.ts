import { constant, once } from 'lodash-es';
import { VideoEncoder } from './BaseEncoder.js';
import { FrameState } from '../state/FrameState.js';

export class Libx265Encoder extends VideoEncoder {
  private constructor() {
    super('libx265');
  }

  static create = once(() => new Libx265Encoder());

  outputOptions(): string[] {
    const defaults = super.outputOptions();
    return [...defaults, '-tag:v', 'hvc1', '-x265-params', 'log-level=error'];
  }

  readonly affectsFrameState = true;

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

export class CopyideoEncoder extends VideoEncoder {
  private constructor() {
    super('copy');
  }

  static create = once(() => new CopyideoEncoder());
}

export class ImplicitVideoEncoder extends VideoEncoder {
  private constructor() {
    super('');
  }

  static create = once(() => new ImplicitVideoEncoder());

  outputOptions = constant([]);
}
