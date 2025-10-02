import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import { Encoder } from '@/ffmpeg/builder/encoder/Encoder.js';
import { DeinterlaceFilter } from '@/ffmpeg/builder/filter/DeinterlaceFilter.js';
import type { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import { PadFilter } from '@/ffmpeg/builder/filter/PadFilter.js';
import { ScaleFilter } from '@/ffmpeg/builder/filter/ScaleFilter.js';
import { OverlayWatermarkFilter } from '@/ffmpeg/builder/filter/watermark/OverlayWatermarkFilter.js';
import { PixelFormatOutputOption } from '@/ffmpeg/builder/options/OutputOption.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import dayjs from '@/util/dayjs.js';
import type { Watermark } from '@tunarr/types';
import { filter, first, isEmpty, isNull, some } from 'lodash-es';
import { ImageScaleFilter } from '../../filter/ImageScaleFilter.ts';
import { SubtitleFilter } from '../../filter/SubtitleFilter.ts';
import { SubtitleOverlayFilter } from '../../filter/SubtitleOverlayFilter.ts';
import { WatermarkFadeFilter } from '../../filter/watermark/WatermarkFadeFilter.ts';
import { WatermarkOpacityFilter } from '../../filter/watermark/WatermarkOpacityFilter.ts';
import { WatermarkScaleFilter } from '../../filter/watermark/WatermarkScaleFilter.ts';
import { CopyTimestampInputOption } from '../../options/input/CopyTimestampInputOption.ts';
import type { HasFilterOption } from '../../types/PipelineStep.ts';
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
      frameDataLocation: FrameDataLocation.Software,
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
    });

    if (desiredState.videoFormat !== VideoFormats.Copy) {
      currentState = this.setDeinterlace(currentState);
      currentState = this.setScale(currentState);
      currentState = this.setPad(currentState);
      currentState = this.addSubtitles(currentState);
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
    if (this.desiredState.deinterlace) {
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
      const padFilter = PadFilter.create(currentState, this.desiredState);
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

    if (!this.context.hasWatermark) {
      return currentState;
    }

    const watermarkInputSource = this.watermarkInputSource!;
    const watermark = watermarkInputSource.watermark;

    if (!watermarkInputSource.watermark.fixedSize) {
      watermarkInputSource.filterSteps.push(
        new WatermarkScaleFilter(
          currentState.paddedSize,
          watermarkInputSource.watermark,
        ),
      );
    }

    if (watermarkInputSource.watermark.opacity !== 100) {
      watermarkInputSource.filterSteps.push(
        new WatermarkOpacityFilter(
          watermarkInputSource.watermark.opacity / 100.0,
        ),
      );
    }

    watermarkInputSource.filterSteps.push(
      ...this.getWatermarkFadeFilters(watermark),
    );

    // pixel format
    const desiredPixelState = this.desiredState.pixelFormat?.unwrap();

    if (desiredPixelState) {
      this.context.filterChain.watermarkOverlayFilterSteps.push(
        new OverlayWatermarkFilter(
          watermarkInputSource.watermark,
          this.context.desiredState.paddedSize,
          this.context.videoStream.squarePixelFrameSize(
            this.desiredState.paddedSize,
          ),
          desiredPixelState,
        ),
      );
    }

    return currentState;
  }

  protected setPixelFormat(currentState: FrameState): FrameState {
    const steps: FilterOption[] = [];
    if (this.desiredState.pixelFormat) {
      if (!currentState.pixelFormat?.equals(this.desiredState.pixelFormat)) {
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

  protected getWatermarkFadeFilters(watermark: Watermark) {
    if (isEmpty(watermark?.fadeConfig)) {
      return [];
    }

    if (!this.ffmpegState.duration) {
      return [];
    }

    const filters: HasFilterOption[] = [];
    // Pick the first for now
    const fadeConfig = first(watermark.fadeConfig)!;
    const periodMins = fadeConfig.periodMins;
    if (periodMins > 0) {
      const start = this.ffmpegState.start ?? dayjs.duration(0);
      const streamDur =
        +this.ffmpegState.duration > +start
          ? this.ffmpegState.duration.subtract(start)
          : this.ffmpegState.duration;

      const periodSeconds = periodMins * 60;
      const cycles = streamDur.asMilliseconds() / (periodSeconds * 1000);

      // If leading edge, fade in the watermark after the first second of programming
      // otherwise, wait a full period
      const fadeStartTime = fadeConfig.leadingEdge ? 1 : periodSeconds;
      // Make the watermark transparent before the first fade in
      filters.push(
        new WatermarkOpacityFilter(0, {
          startSeconds: 0,
          endSeconds: fadeStartTime,
        }),
      );

      for (let cycle = 0, t = fadeStartTime; cycle < cycles; cycle++) {
        filters.push(
          new WatermarkFadeFilter(true, t, t, t + (periodSeconds - 1)),
          new WatermarkFadeFilter(
            false,
            t + periodSeconds,
            t + periodSeconds,
            t + periodSeconds * 2,
          ),
        );
        t += periodSeconds * 2;
      }
    }

    return filters;
  }

  protected addSubtitles(currentState: FrameState): FrameState {
    if (!this.subtitleInputSource) {
      return currentState;
    }

    if (this.context.hasSubtitleTextContext()) {
      this.videoInputSource.addOption(new CopyTimestampInputOption());
      const filter = new SubtitleFilter(this.subtitleInputSource);
      currentState = filter.nextState(currentState);
      this.videoInputSource.filterSteps.push(filter);
    } else if (this.context.hasSubtitleOverlay()) {
      const hasScaleOrPad = this.videoInputSource.filterSteps.some(
        (step) => step instanceof ScaleFilter || step instanceof PadFilter,
      );
      if (hasScaleOrPad) {
        const scaleFilter = new ImageScaleFilter(this.desiredState.paddedSize);
        this.subtitleInputSource.filterSteps.push(scaleFilter);
      }

      if (this.desiredState.pixelFormat) {
        const unwrapped = this.desiredState.pixelFormat.unwrap();
        const overlayFilter = new SubtitleOverlayFilter(unwrapped);
        this.context.filterChain.subtitleOverlayFilterSteps.push(overlayFilter);
      }
    }

    return currentState;
  }
}
