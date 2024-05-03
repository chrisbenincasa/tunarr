import { first, isNil } from 'lodash-es';
import { FrameState } from '../state/FrameState';
import { FrameDataLocation, InputSource } from '../types';
import { Decoder } from './Decoder';

export abstract class BaseDecoder extends Decoder {
  readonly type = 'input';
  readonly affectsFrameState: boolean = true;

  abstract readonly name: string;
  protected abstract outputFrameDataLocation: FrameDataLocation;

  // It's weird that these are defined in places where they
  // will never be hit... perhaps we should rethink the hierarchy
  // filterOptions = constant([]);
  // globalOptions = constant([]);
  // outputOptions = constant([]);

  appliesToInput(input: InputSource): boolean {
    return input.type === 'video';
  }

  options(_inputSource: InputSource): string[] {
    return ['-c:v', this.name];
  }

  nextState(currentState: FrameState): FrameState {
    return {
      ...currentState,
      frameDataLocation: this.outputFrameDataLocation,
    };
  }

  protected inputBitDepth(inputFile: InputSource): number {
    let depth = 8;
    if (inputFile.isVideo()) {
      const fmt = first(inputFile.videoStreams)?.pixelFormat;
      if (!isNil(fmt)) {
        depth = fmt.bitDepth;
      }
    }
    return depth;
  }
}
