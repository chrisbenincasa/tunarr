import { isNull } from 'lodash-es';
import { Nullable } from '../../../types/util';
import { FrameState } from '../state/FrameState';
import { FrameDataLocation, FrameSize, PixelFormat } from '../types';
import { Filter } from './FilterBase';

export class PadFilter extends Filter {
  private currentFrameDataLocation: FrameDataLocation;
  private desiredPaddedSize: FrameSize;

  readonly filter: string;
  readonly affectsFrameState: boolean = true;

  constructor(
    currentState: FrameState,
    desiredState: FrameState,
    private hardwarePixelFormat: Nullable<PixelFormat>,
  ) {
    super();
    this.currentFrameDataLocation = currentState.frameDataLocation;
    this.desiredPaddedSize = desiredState.paddedSize;
    this.filter = this.generateFilter();
  }

  nextState(currentState: FrameState): FrameState {
    return {
      ...currentState,
      paddedSize: this.desiredPaddedSize,
      frameDataLocation: 'software',
    };
  }

  private generateFilter(): string {
    const pad = `pad=${this.desiredPaddedSize.width}:${this.desiredPaddedSize.height}:-1:-1:color=black`;

    if (this.currentFrameDataLocation === 'hardware') {
      if (!isNull(this.hardwarePixelFormat)) {
        return `hwdownload,format=${this.hardwarePixelFormat.ffmpegName},${pad}`;
      }

      return `hwdownload,${pad}`;
    }

    return pad;
  }
}
