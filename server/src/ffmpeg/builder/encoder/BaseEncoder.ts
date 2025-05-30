import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { StreamKinds } from '@/ffmpeg/builder/types.js';
import type { TupleToUnion } from '@tunarr/types';
import { isEmpty } from 'lodash-es';
import type { VideoFormat } from '../constants.ts';
import type { Encoder } from './Encoder.ts';

export abstract class BaseEncoder implements Encoder {
  readonly type = 'output';
  readonly affectsFrameState: boolean = false;
  // Unclear why this is needed here. Some work still left
  // to do on the hierarchy
  get filter(): string {
    return '';
  }

  constructor(
    public name: string,
    public kind: TupleToUnion<typeof StreamKinds>,
  ) {}

  options(): string[] {
    return [BaseEncoder.optionForStreamKind(this.kind), this.name];
  }

  nextState(currentState: FrameState): FrameState {
    return currentState;
  }

  private static optionForStreamKind(
    kind: TupleToUnion<typeof StreamKinds>,
  ): string {
    switch (kind) {
      case 'audio':
        return '-c:a';
      case 'video':
        return '-c:v';
      default:
        return '';
    }
  }
}

export class AudioEncoder extends BaseEncoder {
  constructor(encoder: string) {
    super(encoder, 'audio');
  }
}

export abstract class VideoEncoder extends BaseEncoder {
  protected abstract videoFormat: VideoFormat;

  constructor(encoder: string) {
    super(encoder, 'video');
  }

  // Denotes if this encoder changes the current state of
  // the pipeline
  affectsFrameState = false;

  // If affectsFrameState, this method should return the
  // 'next' state.
  updateFrameState(currentState: FrameState): FrameState {
    if (isEmpty(this.name)) {
      return currentState;
    }

    return currentState.update({
      videoFormat: this.videoFormat,
    });
  }
}
