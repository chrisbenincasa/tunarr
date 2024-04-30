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
  globalOptions(): string[] {
    return [];
  }

  filterOptions(): string[] {
    return [];
  }

  inputOptions(): string[] {
    return [];
  }

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
}
