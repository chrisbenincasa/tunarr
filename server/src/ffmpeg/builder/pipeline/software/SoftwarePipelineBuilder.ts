import { isNull } from 'lodash-es';
import { DeinterlaceFilter } from '../../filter/DeinterlaceFilter';
import { PadFilter } from '../../filter/PadFilter';
import { ScaleFilter } from '../../filter/ScaleFilter';
import { FrameState } from '../../state/FrameState';
import {
  BasePipelineBuilder,
  isVideoPipelineContext,
} from '../BasePIpelineBuilder';
import { OverlayWatermarkFilter } from '../../filter/watermark/OverlayWatermarkFilter';
import { VideoFormats } from '../../constants';

export class SoftwarePipelineBuilder extends BasePipelineBuilder {
  protected setupVideoFilters() {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    const { desiredState, videoStream, filterChain, pipelineSteps } =
      this.context;

    let currentState = desiredState.update({
      frameDataLocation: 'software',
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
    });

    if (desiredState.videoFormat !== VideoFormats.Copy) {
      currentState = this.setDeinterlace(currentState);
      currentState = this.setScale(currentState);
      currentState = this.setPad(currentState);
      currentState = this.setWatermark(currentState);
    }

    const { nextState, encoder } = this.setupEncoder(currentState);
    currentState = nextState;

    if (!isNull(encoder)) {
      pipelineSteps.push(encoder);
      this.videoInputFile.filterSteps.push(encoder);
    }

    filterChain.videoFilterSteps.push(...this.videoInputFile.filterSteps);
  }

  protected setDeinterlace(currentState: FrameState): FrameState {
    if (this.desiredState.interlaced) {
      const filter = new DeinterlaceFilter(this.ffmpegState, currentState);
      this.videoInputFile.filterSteps.push(filter);

      if (filter.affectsFrameState) {
        return filter.nextState(currentState);
      }
    }

    return currentState;
  }

  protected setScale(currentState: FrameState) {
    let nextState = currentState;

    if (!isVideoPipelineContext(this.context)) {
      return nextState;
    }

    const { videoStream, desiredState } = this.context;
    if (!videoStream.frameSize.equals(desiredState.scaledSize)) {
      // Scale filter
      const filter = ScaleFilter.create(
        currentState,
        this.context.ffmpegState,
        desiredState.scaledSize,
        desiredState.paddedSize,
      );
      if (filter.affectsFrameState) {
        nextState = filter.nextState(currentState);
      }
      this.videoInputFile.filterSteps.push(filter);
    }
    return nextState;
  }

  protected setPad(currentState: FrameState): FrameState {
    if (!currentState.paddedSize.equals(this.desiredState.paddedSize)) {
      const padFilter = new PadFilter(currentState, this.desiredState, null);
      this.videoInputFile.filterSteps.push(padFilter);
      if (padFilter.affectsFrameState) {
        return padFilter.nextState(currentState);
      }
    }

    return currentState;
  }

  protected setWatermark(currentState: FrameState): FrameState {
    if (this.watermarkInputSource) {
      // pixel format
      // this.watermarkInoutSource.filterSteps.add()
      // this.watermarkInoutSource.filterSteps.push()

      this.context.filterChain.watermarkOverlayFilterSteps.push(
        new OverlayWatermarkFilter(
          this.watermarkInputSource.watermark,
          this.context.desiredState.paddedSize,
          // Hardcode for testing
          {
            name: 'yuv420p',
            ffmpegName: 'yuv420p',
            bitDepth: 8,
          },
        ),
      );
    }

    return currentState;
  }
}
