import { isNull } from 'lodash-es';
import { Nullable } from '../../../../types/util';
import { VideoFormats } from '../../constants';
import { Decoder } from '../../decoder/Decoder';
import { DecoderFactory } from '../../decoder/DecoderFactory';
import { QsvHardwareAccelerationOption } from '../../options/hardwareAcceleration/QsvOptions';
import {
  BasePipelineBuilder,
  PipelineVideoFunctionArgs,
} from '../BasePIpelineBuilder';
import { FfmpegState } from '../../state/FfmpegState';
import { FrameState } from '../../state/FrameState';
import { DeinterlaceFilter } from '../../filter/DeinterlaceFilter';
import { DeinterlaceQsvFilter } from '../../filter/qsv/DeinterlaceQsvFilter';
import { Filter } from '../../filter/FilterBase';
import { ScaleFilter } from '../../filter/ScaleFilter';
import { ScaleQsvFilter } from '../../filter/qsv/ScaleQsvFilter';
import { isNonEmptyString } from '../../../../util';
import { VideoStream } from '../../MediaStream';
import { PixelFormat } from '../../types';
import { PadFilter } from '../../filter/PadFilter';
import { PixelFormatNv12 } from './NvidiaPipelineBuilder';
import { Encoder } from '../../encoder/Encoder';
import { EncoderFactory } from '../../encoder/EncoderFactory';

export class QsvPipelineBuilder extends BasePipelineBuilder {
  protected setHardwareAccelState({
    ffmpegState,
    pipelineSteps,
    videoStream,
  }: PipelineVideoFunctionArgs): void {
    let canDecode = true;
    const canEncode = true;

    // TODO: vaapi device
    pipelineSteps.push(
      new QsvHardwareAccelerationOption(ffmpegState.vaapiDevice),
    );

    // TODO: check whether can decode and can encode based on capabilities
    // minimal check for now, h264/hevc have issues with 10-bit
    if (
      (videoStream.codec === VideoFormats.H264 ||
        videoStream.codec === VideoFormats.Hevc) &&
      videoStream.pixelFormat?.bitDepth === 10
    ) {
      canDecode = false;
    }

    ffmpegState.decoderHwAccelMode = canDecode ? 'qsv' : 'none';
    ffmpegState.encoderHwAccelMode = canEncode ? 'qsv' : 'none';
  }

  protected setupDecoder(args: PipelineVideoFunctionArgs): Nullable<Decoder> {
    const { ffmpegState, videoStream } = args;
    let decoder: Nullable<Decoder> = null;

    if (ffmpegState.decoderHwAccelMode === 'qsv') {
      decoder = DecoderFactory.getQsvDecoder(videoStream);
    }

    if (isNull(decoder)) {
      decoder = super.setupDecoder(args);
    }

    if (!isNull(decoder)) {
      this.videoInputFile.addOption(decoder);
    }

    return decoder;
  }

  protected setupVideoFilters(args: Readonly<PipelineVideoFunctionArgs>): void {
    const {
      desiredState,
      videoStream,
      decoder,
      ffmpegState,
      pipelineSteps,
      filterChain,
    } = args;
    let currentState = {
      ...desiredState,
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
    };

    if (decoder?.affectsFrameState) {
      currentState = decoder.nextState(currentState);
    }

    currentState = this.setDeinterlaceFilter(
      ffmpegState,
      currentState,
      desiredState,
    );
    currentState = this.setScaleFilter(currentState, args);
    currentState = this.setPadFilter(videoStream, currentState, desiredState);

    let encoder: Nullable<Encoder> = null;
    if (ffmpegState.encoderHwAccelMode === 'qsv') {
      encoder = EncoderFactory.getQsvEncoder(videoStream);
    }

    if (isNull(encoder)) {
      const { nextState, encoder: softwareEncoder } = super.setupEncoder(
        currentState,
        args,
      );
      currentState = nextState;
      encoder = softwareEncoder;
    }

    if (!isNull(encoder)) {
      pipelineSteps.push(encoder);
      this.videoInputFile.filterSteps.push(encoder);
    }

    filterChain.videoFilterSteps.push(...this.videoInputFile.filterSteps);
  }

  private setDeinterlaceFilter(
    ffmpegState: FfmpegState,
    currentState: FrameState,
    desiredState: FrameState,
  ): FrameState {
    let nextState = currentState;
    if (desiredState.interlaced) {
      const filter =
        currentState.frameDataLocation === 'software'
          ? new DeinterlaceFilter(ffmpegState, currentState)
          : new DeinterlaceQsvFilter(currentState);
      if (filter.affectsFrameState) {
        nextState = filter.nextState(nextState);
      }
      this.videoInputFile.filterSteps.push(filter);
    }
    return nextState;
  }

  private setScaleFilter(
    currentState: FrameState,
    args: PipelineVideoFunctionArgs,
  ): FrameState {
    const { videoStream, ffmpegState, desiredState } = args;
    let nextState = currentState;
    const needsScale = !currentState.scaledSize.equals(desiredState.scaledSize);
    const noHardware =
      ffmpegState.decoderHwAccelMode === 'none' &&
      ffmpegState.encoderHwAccelMode === 'none';
    const onlySoftwareFilters =
      currentState.frameDataLocation === 'software' &&
      !desiredState.scaledSize.equals(desiredState.paddedSize);

    let scaleFilter: Filter;
    if (needsScale && (noHardware || onlySoftwareFilters)) {
      scaleFilter = ScaleFilter.create(currentState, args);
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
      this.videoInputFile.filterSteps.push(scaleFilter);
    }

    return nextState;
  }

  private setPadFilter(
    videoStream: VideoStream,
    currentState: FrameState,
    desiredState: FrameState,
  ): FrameState {
    if (!currentState.paddedSize.equals(desiredState.paddedSize)) {
      // TODO: move this into current/desired state, but see if it works here for now
      const pixelFormat: Nullable<PixelFormat> =
        !isNull(videoStream.pixelFormat) &&
        videoStream.pixelFormat.bitDepth == 8
          ? new PixelFormatNv12(videoStream.pixelFormat.name)
          : videoStream.pixelFormat;

      const padStep = new PadFilter(currentState, desiredState, pixelFormat);

      this.videoInputFile.filterSteps.push(padStep);
      if (padStep.affectsFrameState) {
        return padStep.nextState(currentState);
      }

      return currentState;
    } else {
      return currentState;
    }
  }
}
