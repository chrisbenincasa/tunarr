import type { InputSource } from '@/ffmpeg/builder/input/InputSource.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { some } from 'lodash-es';
import { InputOption } from './InputOption.ts';

// TODO: Figure out how to model output options here ... this option
// needs noautoscale

export class InfiniteLoopInputOption extends InputOption {
  options(inputSource: InputSource): string[] {
    if (
      inputSource.isVideo() &&
      some(inputSource.streams, (stream) => stream.inputKind === 'stillimage')
    ) {
      return ['-loop', '1'];
    }

    return ['-stream_loop', '1'];
  }

  appliesToInput(): boolean {
    return true;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      realtime: true,
    });
  }
}
