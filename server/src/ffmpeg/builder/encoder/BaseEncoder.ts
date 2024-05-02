import { constant } from 'lodash-es';
import { FrameState } from '../state/FrameState';
import { StreamKinds } from '../types';
import { Encoder } from './Encoder';

// Only video or audio is valid.
type EncoderStreamKind = Exclude<(typeof StreamKinds)[number], 'all'>;

export abstract class BaseEncoder implements Encoder {
  constructor(
    public name: string,
    public kind: EncoderStreamKind,
  ) {}

  // env vars
  globalOptions = constant([]);

  filterOptions = constant([]);

  inputOptions = constant([]);

  outputOptions(): string[] {
    return [BaseEncoder.optionForStreamKind(this.kind), this.name];
  }

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  filter: string = '';

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
