import { isNull } from 'lodash-es';
import { Nullable } from '../../../../types/util';
import { VideoFormats } from '../../constants';
import { Decoder } from '../../decoder/Decoder';
import { CudaHardwareAccelerationOption } from '../../options/hardwareAcceleration/NvidiaOptions';
import {
  BasePipelineBuilder,
  PipelineVideoFunctionArgs,
} from '../BasePIpelineBuilder';
import { DecoderFactory } from '../../decoder/DecoderFactory';
import { FrameState } from '../../state/FrameState';
import { FfmpegState } from '../../state/FfmpegState';
import { DeinterlaceFilter } from '../../filter/DeinterlaceFilter';
import { YadifCudaFilter } from '../../filter/nvidia/YadifCudaFilter';
import { FilterBase } from '../../filter/FilterBase';
import { ScaleFilter } from '../../filter/ScaleFilter';
import { ScaleCudaFilter } from '../../filter/nvidia/ScaleCudaFilter';
import { isNonEmptyString } from '../../../../util';
import { PixelFormat } from '../../types';
import { VideoStream } from '../../MediaStream';
import { PadFilter } from '../../filter/PadFilter';
import { EncoderFactory } from '../../encoder/EncoderFactory';
import { VideoEncoder } from '../../encoder/BaseEncoder';

export class NvidiaPipelineBuilder extends BasePipelineBuilder {
  protected setHardwareAccelState({
    videoStream,
    desiredState,
    pipelineSteps,
    ffmpegState,
  }: PipelineVideoFunctionArgs): void {
    let canDecode = true,
      canEncode = true;
    // TODO: check whether can decode and can encode based on capabilities
    // minimal check for now, h264_cuvid doesn't support 10-bit
    if (
      videoStream.codec === VideoFormats.H264 &&
      videoStream.pixelFormat?.bitDepth === 10
    ) {
      canDecode = false;
    }

    if (
      desiredState.interlaced &&
      videoStream.codec === VideoFormats.Mpeg2Video
    ) {
      canDecode = false;
    }

    if (canDecode || canEncode) {
      pipelineSteps.push(new CudaHardwareAccelerationOption());
    }

    ffmpegState.decoderHwAccelMode = canDecode ? 'nvenc' : 'none';
    ffmpegState.encoderHwAccelMode = canEncode ? 'nvenc' : 'none';
  }

  protected setupDecoder(args: PipelineVideoFunctionArgs): Nullable<Decoder> {
    const { videoStream, ffmpegState } = args;
    let decoder: Nullable<Decoder> = null;
    if (ffmpegState.decoderHwAccelMode === 'nvenc') {
      decoder = DecoderFactory.getNvidiaDecoder(videoStream, 'nvenc');
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
    const { desiredState, videoStream, decoder, ffmpegState, pipelineSteps } =
      args;

    let currentState = {
      ...desiredState,
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
    };

    currentState = decoder?.nextState(currentState) ?? currentState;

    currentState = this.setDeinterlace(ffmpegState, currentState, desiredState);
    currentState = this.setScale(currentState, args);
    currentState = this.setPad(
      videoStream,
      currentState,
      desiredState,
      ffmpegState,
    );

    let encoder: Nullable<VideoEncoder> = null;
    if (ffmpegState.encoderHwAccelMode === 'nvenc') {
      encoder = EncoderFactory.getNvidiaEncoder(videoStream);
    }

    if (isNull(encoder)) {
      const { encoder: softwareEncoder, nextState } = super.setupEncoder(
        currentState,
        args,
      );
      currentState = nextState;
      encoder = softwareEncoder;
    }

    pipelineSteps.push(encoder);
    this.videoInputFile.filterSteps.push(encoder);

    args.filterChain.videoFilterSteps.push(...this.videoInputFile.filterSteps);
  }

  private setDeinterlace(
    ffmpegState: FfmpegState,
    currentState: FrameState,
    desiredState: FrameState,
  ): FrameState {
    if (desiredState.interlaced) {
      const filter =
        currentState.frameDataLocation === 'software'
          ? new DeinterlaceFilter(ffmpegState, currentState)
          : new YadifCudaFilter(currentState);
      this.videoInputFile.filterSteps.push(filter);
      if (filter.affectsFrameState) {
        return filter.nextState(currentState);
      }
    }
    return currentState;
  }

  private setScale(
    currentState: FrameState,
    args: PipelineVideoFunctionArgs,
  ): FrameState {
    let nextState = currentState;
    const { desiredState, ffmpegState } = args;

    if (currentState.scaledSize.equals(desiredState.scaledSize)) {
      return currentState;
    }

    let scaleStep: FilterBase;
    const decodeToSoftware = ffmpegState.decoderHwAccelMode === 'none';
    const softwareEncoder = ffmpegState.encoderHwAccelMode === 'none';

    const noHardwareFilters = !desiredState.interlaced;
    const needsToPad = !currentState.paddedSize.equals(desiredState.paddedSize);

    if (
      decodeToSoftware &&
      (needsToPad || noHardwareFilters) &&
      softwareEncoder
    ) {
      scaleStep = ScaleFilter.create(currentState, args);
    } else {
      scaleStep = new ScaleCudaFilter(
        currentState,
        desiredState.scaledSize,
        desiredState.paddedSize,
      );
    }

    if (scaleStep.affectsFrameState) {
      nextState = scaleStep.nextState(nextState);
    }

    if (isNonEmptyString(scaleStep.filter)) {
      this.videoInputFile.filterSteps.push(scaleStep);
    }

    return nextState;
  }

  private setPad(
    videoStream: VideoStream,
    currentState: FrameState,
    desiredState: FrameState,
    ffmpegState: FfmpegState,
  ): FrameState {
    let nextState = currentState;
    if (currentState.paddedSize.equals(desiredState.paddedSize) == false) {
      // TODO: move this into current/desired state, but see if it works here for now
      const pixelFormat: Nullable<PixelFormat> =
        ffmpegState.decoderHwAccelMode == 'nvenc' &&
        videoStream.pixelFormat != null &&
        videoStream.pixelFormat.bitDepth == 8
          ? new PixelFormatNv12(videoStream.pixelFormat.name)
          : videoStream.pixelFormat;

      const padStep = new PadFilter(currentState, desiredState, pixelFormat);

      if (padStep.affectsFrameState) {
        nextState = padStep.nextState(nextState);
      }

      this.videoInputFile.filterSteps.push(padStep);
    }
    return nextState;
  }
}

export class PixelFormatNv12 implements PixelFormat {
  constructor(public readonly name: string) {}

  readonly ffmpegName: string = 'nv12';
  readonly bitDepth: number = 8;
}
