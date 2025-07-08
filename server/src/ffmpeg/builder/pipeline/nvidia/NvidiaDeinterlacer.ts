import { DeinterlaceFilter } from '../../filter/DeinterlaceFilter.ts';
import { YadifCudaFilter } from '../../filter/nvidia/YadifCudaFilter.ts';
import type { VideoInputSource } from '../../input/VideoInputSource.ts';
import type { FrameState } from '../../state/FrameState.ts';
import { FrameDataLocation } from '../../types.ts';
import type { PipelineBuilderContext } from '../BasePipelineBuilder.ts';

export class NvidiaDeinterlacer {
  private constructor() {}

  static setDeinterlace(
    context: PipelineBuilderContext,
    videoInputSource: VideoInputSource,
    currentState: FrameState,
  ) {
    if (context.shouldDeinterlace) {
      const filter =
        currentState.frameDataLocation === FrameDataLocation.Software
          ? new DeinterlaceFilter(context.ffmpegState, currentState)
          : new YadifCudaFilter(currentState);
      videoInputSource.filterSteps.push(filter);
      currentState = filter.nextState(currentState);
    }

    return currentState;
  }
}
