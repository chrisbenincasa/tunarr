import { FfmpegState } from '../state/FfmpegState';
import { FrameState } from '../state/FrameState';
import { FrameSize } from '../types';
import { Filter } from './FilterBase';

export class ScaleFilter extends Filter {
  readonly filter: string;

  readonly affectsFrameState = true;

  private constructor(
    private currentState: FrameState,
    private ffmpegState: FfmpegState,
    private desiredScaledSize: FrameSize,
    private desiredPaddedSize: FrameSize,
  ) {
    super();
    this.filter = this.generateFilter();
  }

  static create(
    currentState: FrameState,
    ffmpegState: FfmpegState,
    desiredScaledSize: FrameSize,
    desiredPaddedSize: FrameSize,
  ) {
    return new ScaleFilter(
      currentState,
      ffmpegState,
      desiredScaledSize,
      desiredPaddedSize,
    );
  }

  private generateFilter(): string {
    if (this.currentState.scaledSize.equals(this.desiredScaledSize)) {
      return '';
    }

    const aspectRatio = this.desiredScaledSize.equals(this.desiredPaddedSize)
      ? ''
      : ':force_original_aspect_ratio=decrease';

    let scaleFilter: string;
    if (this.currentState.isAnamorphic) {
      scaleFilter = `scale=iw*sar:ih,setsar=1,scale=${this.desiredPaddedSize.width}:${this.desiredPaddedSize.height}:flags=${this.ffmpegState.softwareScalingAlgorithm}${aspectRatio}`;
    } else {
      scaleFilter = `scale=${this.desiredPaddedSize.width}:${this.desiredPaddedSize.height}:flags=${this.ffmpegState.softwareScalingAlgorithm}${aspectRatio},setsar=1`;
    }

    // TODO: hwdownload if needed

    return scaleFilter;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      scaledSize: this.desiredScaledSize,
      paddedSize: this.desiredPaddedSize,
      isAnamorphic: false,
    });
  }
}
