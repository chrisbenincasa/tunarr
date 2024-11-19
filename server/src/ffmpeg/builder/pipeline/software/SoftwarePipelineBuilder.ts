import { VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { Encoder } from '@/ffmpeg/builder/encoder/Encoder.ts';
import { DeinterlaceFilter } from '@/ffmpeg/builder/filter/DeinterlaceFilter.ts';
import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { PadFilter } from '@/ffmpeg/builder/filter/PadFilter.ts';
import { ScaleFilter } from '@/ffmpeg/builder/filter/ScaleFilter.ts';
import { OverlayWatermarkFilter } from '@/ffmpeg/builder/filter/watermark/OverlayWatermarkFilter.ts';
import { PixelFormatYuv420P } from '@/ffmpeg/builder/format/PixelFormat.ts';
import { PixelFormatOutputOption } from '@/ffmpeg/builder/options/OutputOption.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { filter, isNull, some } from 'lodash-es';
import {
  BasePipelineBuilder,
  isVideoPipelineContext,
} from '../BasePipelineBuilder.ts';

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

    if (!this.hasVideoEncoderPipelineStep()) {
      const encoder = this.setupEncoder(currentState);
      if (!isNull(encoder)) {
        pipelineSteps.push(encoder);
        this.videoInputSource.filterSteps.push(encoder);
      }
    }

    if (this.desiredState.videoFormat === VideoFormats.Copy) {
      return;
    }

    this.setPixelFormat(currentState);

    filterChain.videoFilterSteps.push(...this.videoInputSource.filterSteps);
  }

  protected setDeinterlace(currentState: FrameState): FrameState {
    if (this.desiredState.deinterlaced) {
      const filter = new DeinterlaceFilter(this.ffmpegState, currentState);
      this.videoInputSource.filterSteps.push(filter);

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
      this.videoInputSource.filterSteps.push(filter);
    }
    return nextState;
  }

  protected setPad(currentState: FrameState): FrameState {
    if (!currentState.paddedSize.equals(this.desiredState.paddedSize)) {
      const padFilter = new PadFilter(currentState, this.desiredState);
      this.videoInputSource.filterSteps.push(padFilter);
      if (padFilter.affectsFrameState) {
        return padFilter.nextState(currentState);
      }
    }

    return currentState;
  }

  protected setWatermark(currentState: FrameState): FrameState {
    if (!isVideoPipelineContext(this.context)) {
      return currentState;
    }

    if (this.context.hasWatermark) {
      const watermarkInputSource = this.watermarkInputSource!;
      // pixel format
      // this.watermarkInoutSource.filterSteps.add()
      // this.watermarkInoutSource.filterSteps.push()

      this.context.filterChain.watermarkOverlayFilterSteps.push(
        new OverlayWatermarkFilter(
          watermarkInputSource.watermark,
          this.context.desiredState.paddedSize,
          this.context.videoStream.squarePixelFrameSize(
            this.desiredState.paddedSize,
          ),
          // this.context.videoStream
          // Hardcode for testing
          new PixelFormatYuv420P(),
        ),
      );
    }

    return currentState;
  }

  protected setPixelFormat(currentState: FrameState): FrameState {
    const steps: FilterOption[] = [];
    if (this.desiredState.pixelFormat) {
      if (
        currentState.pixelFormat?.ffmpegName !==
        this.desiredState.pixelFormat.ffmpegName
      ) {
        const opt = new PixelFormatOutputOption(this.desiredState.pixelFormat);
        currentState = opt.nextState(currentState);
        this.pipelineSteps.push(opt);
      }
    }
    this.context.filterChain.pixelFormatFilterSteps = steps;
    return currentState;
  }

  protected hasVideoEncoderPipelineStep() {
    return some(
      filter(
        this.pipelineSteps,
        (step): step is Encoder => step instanceof Encoder,
      ),
      (step) => step.kind === 'video',
    );
  }

  protected isVideoContext() {}
}
