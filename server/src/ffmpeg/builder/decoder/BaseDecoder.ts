import { constant, first, isNil } from 'lodash-es';
import { FrameState } from '../state/FrameState';
import { FrameDataLocation, InputSource } from '../types';
import { Decoder } from './Decoder';

export abstract class BaseDecoder implements Decoder {
  abstract name: string;
  protected abstract outputFrameDataLocation: FrameDataLocation;

  // It's weird that these are defined in places where they
  // will never be hit... perhaps we should rethink the hierarchy
  filterOptions = constant([]);
  globalOptions = constant([]);
  outputOptions = constant([]);

  appliesToInput(input: InputSource): boolean {
    return input.type === 'video';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inputOptions(_unusedInputFile: InputSource): string[] {
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
