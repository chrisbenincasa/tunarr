import {
  BasePipelineBuilder,
  PipelineFunctionArgs,
} from '../BasePIpelineBuilder';

export class SoftwarePipelineBuilder extends BasePipelineBuilder {
  protected setupVideoFilters({
    desiredState,
    videoStream,
  }: PipelineFunctionArgs) {
    const currentState: FrameState = {
      ...desiredState,
      frameDataLocation: 'software',
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
    };
  }
}
