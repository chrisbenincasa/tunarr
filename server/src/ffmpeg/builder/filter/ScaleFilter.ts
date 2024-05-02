import { PipelineVideoFunctionArgs } from '../pipeline/BasePIpelineBuilder';
import { FrameState } from '../state/FrameState';
import { FrameSize } from '../types';
import { FilterBase } from './FilterBase';

export class ScaleFilter extends FilterBase {
  private desiredScaledSize: FrameSize;
  private desiredPaddedSize: FrameSize;

  readonly filter: string;

  readonly affectsFrameState = true;

  private constructor(
    currentState: FrameState,
    args: PipelineVideoFunctionArgs,
  ) {
    super();
    this.filter = ScaleFilter.generateFilter(currentState, args);
    this.desiredScaledSize = args.desiredState.scaledSize;
    this.desiredPaddedSize = args.desiredState.paddedSize;
  }

  static create(currentState: FrameState, args: PipelineVideoFunctionArgs) {
    const filter = new ScaleFilter(currentState, args);
    return {
      nextState: filter.nextState(currentState),
      filter,
    };
  }

  static generateFilter(
    currentState: FrameState,
    {
      ffmpegState,
      desiredState: {
        scaledSize: desiredScaledSize,
        paddedSize: desiredPaddedSize,
      },
    }: PipelineVideoFunctionArgs,
  ): string {
    if (currentState.scaledSize.equals(desiredScaledSize)) {
      return '';
    }

    const aspectRatio = desiredScaledSize.equals(desiredPaddedSize)
      ? ''
      : ':force_original_aspect_ratio=decrease';

    let scaleFilter: string;
    if (currentState.isAnamorphic) {
      scaleFilter = `scale=iw*sar:ih,setsar=1,scale=${desiredPaddedSize.width}:${desiredPaddedSize.height}:flags=${ffmpegState.softwareScalingAlgorithm}${aspectRatio}`;
    } else {
      scaleFilter = `scale=${desiredPaddedSize.width}:${desiredPaddedSize.height}:flags=${ffmpegState.softwareScalingAlgorithm}${aspectRatio},setsar=1`;
    }

    // TODO: hwdownload if needed

    return scaleFilter;
  }

  nextState(currentState: FrameState): FrameState {
    return {
      ...currentState,
      scaledSize: this.desiredScaledSize,
      paddedSize: this.desiredPaddedSize,
      isAnamorphic: false,
    };
  }
}
