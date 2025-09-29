import { HardwareAccelerationMode } from '../../../../db/schema/TranscodeConfig.ts';
import { isNonEmptyString } from '../../../../util/index.ts';
import type { FilterOption } from '../../filter/FilterOption.ts';
import { HardwareUploadCudaFilter } from '../../filter/nvidia/HardwareUploadCudaFilter.ts';
import { ScaleCudaFilter } from '../../filter/nvidia/ScaleCudaFilter.ts';
import { ScaleFilter } from '../../filter/ScaleFilter.ts';
import { PixelFormatNv12 } from '../../format/PixelFormat.ts';
import type { VideoInputSource } from '../../input/VideoInputSource.ts';
import type { FrameState } from '../../state/FrameState.ts';
import { FrameDataLocation } from '../../types.ts';
import type { PipelineBuilderContext } from '../BasePipelineBuilder.ts';

export class NvidiaScaler {
  private constructor() {}

  static setScale(
    context: PipelineBuilderContext,
    videoInputSource: VideoInputSource,
    currentState: FrameState,
  ): FrameState {
    let nextState = currentState;
    const { desiredState, ffmpegState, hasWatermark } = context;

    if (currentState.scaledSize.equals(desiredState.scaledSize)) {
      return currentState;
    }

    let scaleStep: FilterOption;
    const decodeToSoftware =
      ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.None;
    const softwareEncoder =
      ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None;

    const noHardwareFilters = !desiredState.deinterlace;
    const needsToPad = !currentState.paddedSize.equals(desiredState.paddedSize);

    const useSoftwareScale =
      (decodeToSoftware &&
        (needsToPad || noHardwareFilters) &&
        softwareEncoder) ||
      context.pipelineOptions?.disableHardwareFilters;

    if (useSoftwareScale) {
      scaleStep = ScaleFilter.create(
        currentState,
        ffmpegState,
        desiredState.scaledSize,
        desiredState.paddedSize,
      );
    } else {
      const hasOverlay = hasWatermark || context.hasSubtitleOverlay();
      const isHardwareDecodeAndSoftwareEncode =
        ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Cuda &&
        ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None;
      const outPixelFormat =
        !context.is10BitOutput &&
        (hasOverlay ||
          !desiredState.scaledSize.equals(desiredState.paddedSize) ||
          isHardwareDecodeAndSoftwareEncode)
          ? desiredState.pixelFormat
            ? new PixelFormatNv12(desiredState.pixelFormat)
            : null
          : null;
      if (currentState.frameDataLocation === FrameDataLocation.Software) {
        const hwupload = new HardwareUploadCudaFilter(currentState);
        if (isNonEmptyString(hwupload.filter)) {
          videoInputSource.filterSteps.push(hwupload);
          currentState = hwupload.nextState(currentState);
        }
      }
      scaleStep = new ScaleCudaFilter(
        currentState.update({
          pixelFormat: outPixelFormat,
        }),
        desiredState.scaledSize,
        desiredState.paddedSize,
      );
    }

    nextState = scaleStep.nextState(nextState);

    if (isNonEmptyString(scaleStep.filter)) {
      videoInputSource.filterSteps.push(scaleStep);
    }

    return nextState;
  }
}
