import { isNull } from 'lodash-es';
import { Nullable } from '../../../../types/util.ts';
import { isNonEmptyString } from '../../../../util/index.ts';
import { VideoFormats } from '../../constants.ts';
import { Decoder } from '../../decoder/Decoder.ts';
import { DecoderFactory } from '../../decoder/DecoderFactory.ts';
import { Encoder } from '../../encoder/Encoder.ts';
import {
  H264QsvEncoder,
  HevcQsvEncoder,
  Mpeg2QsvEncoder,
} from '../../encoder/qsv/QsvEncoders.ts';
import { DeinterlaceFilter } from '../../filter/DeinterlaceFilter.ts';
import { FilterOption } from '../../filter/FilterOption.ts';
import { ScaleFilter } from '../../filter/ScaleFilter.ts';
import { DeinterlaceQsvFilter } from '../../filter/qsv/DeinterlaceQsvFilter.ts';
import { ScaleQsvFilter } from '../../filter/qsv/ScaleQsvFilter.ts';
import { QsvHardwareAccelerationOption } from '../../options/hardwareAcceleration/QsvOptions.ts';
import { FrameState } from '../../state/FrameState.ts';
import { HardwareAccelerationMode } from '../../types.ts';
import { isVideoPipelineContext } from '../BasePipelineBuilder.ts';
import { SoftwarePipelineBuilder } from '../software/SoftwarePipelineBuilder.ts';

export class QsvPipelineBuilder extends SoftwarePipelineBuilder {
  protected setHardwareAccelState(): void {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    let canDecode = true;
    const canEncode = true;

    // TODO: vaapi device
    this.pipelineSteps.push(
      new QsvHardwareAccelerationOption(this.ffmpegState.vaapiDevice),
    );

    // TODO: check whether can decode and can encode based on capabilities
    // minimal check for now, h264/hevc have issues with 10-bit
    if (
      (this.context.videoStream.codec === VideoFormats.H264 ||
        this.context.videoStream.codec === VideoFormats.Hevc) &&
      this.context.videoStream.pixelFormat?.bitDepth === 10
    ) {
      canDecode = false;
    }

    this.ffmpegState.decoderHwAccelMode = canDecode ? 'qsv' : 'none';
    this.ffmpegState.encoderHwAccelMode = canEncode ? 'qsv' : 'none';
  }

  protected setupDecoder(): Nullable<Decoder> {
    if (!isVideoPipelineContext(this.context)) {
      return null;
    }

    const { ffmpegState, videoStream } = this.context;
    let decoder: Nullable<Decoder> = null;

    if (ffmpegState.decoderHwAccelMode === 'qsv') {
      decoder = DecoderFactory.getQsvDecoder(videoStream);
      if (!isNull(decoder)) {
        this.videoInputSource.addOption(decoder);
      } else {
        decoder = super.setupDecoder();
      }
    }

    return decoder;
  }

  protected setupVideoFilters(): void {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    const {
      desiredState,
      videoStream,
      decoder,
      ffmpegState,
      pipelineSteps,
      filterChain,
    } = this.context;

    let currentState = desiredState.update({
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
    });

    if (decoder?.affectsFrameState) {
      currentState = decoder.nextState(currentState);
    }

    currentState = this.setDeinterlace(currentState);
    currentState = this.setScale(currentState);
    currentState = this.setPad(currentState);
    this.setStillImageLoop();

    let encoder: Nullable<Encoder> = null;
    if (ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.Qsv) {
      switch (this.desiredState.videoFormat) {
        case VideoFormats.Hevc:
          encoder = new HevcQsvEncoder(this.desiredState.videoPreset);
          break;
        case VideoFormats.H264:
          encoder = new H264QsvEncoder(
            this.desiredState.videoPreset,
            this.desiredState.videoProfile,
          );
          break;
        case VideoFormats.Mpeg2Video:
          encoder = new Mpeg2QsvEncoder();
          break;
        default:
          encoder = super.setupEncoder(currentState);
          break;
      }
    }

    if (!isNull(encoder)) {
      pipelineSteps.push(encoder);
      this.videoInputSource.filterSteps.push(encoder);
    }

    filterChain.videoFilterSteps.push(...this.videoInputSource.filterSteps);
  }

  protected setDeinterlace(currentState: FrameState): FrameState {
    let nextState = currentState;
    if (this.context.shouldDeinterlace) {
      const filter =
        currentState.frameDataLocation === 'software'
          ? new DeinterlaceFilter(this.ffmpegState, currentState)
          : new DeinterlaceQsvFilter(currentState);
      if (filter.affectsFrameState) {
        nextState = filter.nextState(nextState);
      }
      this.videoInputSource.filterSteps.push(filter);
    }
    return nextState;
  }

  protected setScale(currentState: FrameState): FrameState {
    if (!isVideoPipelineContext(this.context)) {
      return currentState;
    }

    const { videoStream, ffmpegState, desiredState } = this.context;
    let nextState = currentState;
    const needsScale = !currentState.scaledSize.equals(desiredState.scaledSize);
    const noHardware =
      ffmpegState.decoderHwAccelMode === 'none' &&
      ffmpegState.encoderHwAccelMode === 'none';
    const onlySoftwareFilters =
      currentState.frameDataLocation === 'software' &&
      !desiredState.scaledSize.equals(desiredState.paddedSize);

    let scaleFilter: FilterOption;
    if (needsScale && (noHardware || onlySoftwareFilters)) {
      scaleFilter = ScaleFilter.create(
        currentState,
        ffmpegState,
        desiredState.scaledSize,
        desiredState.paddedSize,
      );
    } else {
      scaleFilter = new ScaleQsvFilter(
        videoStream,
        nextState,
        desiredState.scaledSize,
      );
    }

    if (isNonEmptyString(scaleFilter.filter)) {
      if (scaleFilter.affectsFrameState) {
        nextState = scaleFilter.nextState(nextState);
      }
      this.videoInputSource.filterSteps.push(scaleFilter);
    }

    return nextState;
  }

  protected setPad(currentState: FrameState): FrameState {
    if (!isVideoPipelineContext(this.context)) {
      return currentState;
    }

    const { desiredState } = this.context;

    if (!currentState.paddedSize.equals(desiredState.paddedSize)) {
      //   // TODO: move this into current/desired state, but see if it works here for now
      //   const pixelFormat: Nullable<PixelFormat> =
      //     !isNull(videoStream.pixelFormat) &&
      //     videoStream.pixelFormat.bitDepth == 8
      //       ? new PixelFormatNv12(videoStream.pixelFormat.name)
      //       : videoStream.pixelFormat;

      //   const padStep = new PadFilter(currentState, desiredState, pixelFormat);

      //   this.videoInputFile.filterSteps.push(padStep);
      //   if (padStep.affectsFrameState) {
      //     return padStep.nextState(currentState);
      //   }

      return currentState;
    } else {
      return currentState;
    }
  }
}
