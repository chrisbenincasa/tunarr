import { FrameState } from '../state/FrameState';
import { StreamKinds } from '../types';
import { Encoder } from './Encoder';

// Only video or audio is valid.
type EncoderStreamKind = Exclude<(typeof StreamKinds)[number], 'all'>;

export abstract class BaseEncoder implements Encoder {
  readonly type = 'output';
  readonly affectsFrameState: boolean = false;
  // Unclear why this is needed here. Some work still left
  // to do on the hierarchy
  readonly filter: string = '';

  constructor(
    public name: string,
    public kind: EncoderStreamKind,
  ) {}

  options(): string[] {
    return [BaseEncoder.optionForStreamKind(this.kind), this.name];
  }

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  private static optionForStreamKind(kind: EncoderStreamKind): string {
    switch (kind) {
      case 'audio':
        return '-c:a';
      case 'video':
        return '-c:v';
    }
  }
}

export class AudioEncoder extends BaseEncoder {
  constructor(encoder: string) {
    super(encoder, 'audio');
  }
}

export class VideoEncoder extends BaseEncoder {
  constructor(encoder: string) {
    super(encoder, 'video');
  }

  static create(): VideoEncoder {
    throw new Error('Implement in concrete class!');
  }

  // Denotes if this encoder changes the current state of
  // the pipeline
  affectsFrameState = false;

  // If affectsFrameState, this method should return the
  // 'next' state.
  updateFrameState(currentState: FrameState): FrameState {
    return currentState;
  }
}
