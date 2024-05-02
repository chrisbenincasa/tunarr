import { DeinterlaceFilter } from '../../filter/DeinterlaceFilter';
import { PadFilter } from '../../filter/PadFilter';
import { ScaleFilter } from '../../filter/ScaleFilter';
import { FrameState } from '../../state/FrameState';
import {
  BasePipelineBuilder,
  PipelineVideoFunctionArgs,
} from '../BasePIpelineBuilder';

export class SoftwarePipelineBuilder extends BasePipelineBuilder {
  protected setupVideoFilters(args: PipelineVideoFunctionArgs) {
    const { desiredState, videoStream, filterChain, pipelineSteps } = args;

    let currentState: FrameState = {
      ...desiredState,
      frameDataLocation: 'software',
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
    };

    currentState = this.setDeinterlace(currentState, args);
    currentState = this.setScaleOption(currentState, args);
    currentState = this.setPadOption(currentState, args);
    const { nextState, encoder } = this.setupEncoder(currentState, args);
    currentState = nextState;
    pipelineSteps.push(encoder);
    this.videoInputFile.filterSteps.push(encoder);

    filterChain.videoFilterSteps.push(...this.videoInputFile.filterSteps);
  }

  private setDeinterlace(
    currentState: FrameState,
    args: Readonly<PipelineVideoFunctionArgs>,
  ): FrameState {
    if (args.desiredState.interlaced) {
      const filter = new DeinterlaceFilter(args.ffmpegState, currentState);
      this.videoInputFile.filterSteps.push(filter);

      if (filter.affectsFrameState) {
        return filter.nextState(currentState);
      }
    }

    return currentState;
  }

  private setScaleOption(
    currentState: FrameState,
    args: Readonly<PipelineVideoFunctionArgs>,
  ) {
    let nextState = currentState;
    const { videoStream, desiredState } = args;
    if (!videoStream.frameSize.equals(desiredState.scaledSize)) {
      // Scale filter
      const { nextState: state, filter } = ScaleFilter.create(
        currentState,
        args,
      );
      nextState = state;
      this.videoInputFile.filterSteps.push(filter);
    }
    return nextState;
  }

  private setPadOption(
    currentState: FrameState,
    { desiredState }: PipelineVideoFunctionArgs,
  ): FrameState {
    if (!currentState.paddedSize.equals(desiredState.paddedSize)) {
      const padFilter = new PadFilter(currentState, desiredState, null);
      this.videoInputFile.filterSteps.push(padFilter);
      if (padFilter.affectsFrameState) {
        return padFilter.nextState(currentState);
      }
    }

    return currentState;
  }
}
