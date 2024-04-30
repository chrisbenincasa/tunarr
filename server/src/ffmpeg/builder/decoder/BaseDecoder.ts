import { first, isNil } from 'lodash-es';
import { InputSource } from '../input/InputSource.ts';
import { FrameState } from '../state/FrameState.ts';
import { FrameDataLocation } from '../types.ts';
import { Decoder } from './Decoder.ts';

export abstract class BaseDecoder extends Decoder {
  readonly type = 'input';
  readonly affectsFrameState: boolean = true;

  abstract readonly name: string;
  protected abstract outputFrameDataLocation: FrameDataLocation;

  appliesToInput(input: InputSource): boolean {
    return input.type === 'video';
  }

  options(_inputSource: InputSource): string[] {
    return ['-c:v', this.name];
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation(this.outputFrameDataLocation);
  }

  protected inputBitDepth(inputFile: InputSource): number {
    let depth = 8;
    if (inputFile.isVideo()) {
      const fmt = first(inputFile.streams)?.pixelFormat;
      if (!isNil(fmt)) {
        depth = fmt.bitDepth;
      }
    }
    return depth;
  }
}
