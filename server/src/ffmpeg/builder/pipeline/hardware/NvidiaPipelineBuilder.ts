import { isNull } from 'lodash-es';
import { Nullable } from '../../../../types/util';
import { VideoFormats } from '../../constants';
import { Decoder } from '../../decoder/Decoder';
import { CudaHardwareAccelerationOption } from '../../options/hardwareAcceleration/NvidiaOptions';
import { isVideoPipelineContext } from '../BasePIpelineBuilder';
import { DecoderFactory } from '../../decoder/DecoderFactory';
import { FrameState } from '../../state/FrameState';
import { DeinterlaceFilter } from '../../filter/DeinterlaceFilter';
import { YadifCudaFilter } from '../../filter/nvidia/YadifCudaFilter';
import { Filter } from '../../filter/FilterBase';
import { ScaleFilter } from '../../filter/ScaleFilter';
import { ScaleCudaFilter } from '../../filter/nvidia/ScaleCudaFilter';
import { isNonEmptyString } from '../../../../util';
import { PixelFormat } from '../../types';
import { PadFilter } from '../../filter/PadFilter';
import { EncoderFactory } from '../../encoder/EncoderFactory';
import { VideoEncoder } from '../../encoder/BaseEncoder';
import { SoftwarePipelineBuilder } from '../software/SoftwarePipelineBuilder';

export class NvidiaPipelineBuilder extends SoftwarePipelineBuilder {
  protected setHardwareAccelState(): void {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    const { videoStream, ffmpegState, desiredState, pipelineSteps } =
      this.context;

    let canDecode = true;
    const canEncode = true;
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

  protected setupDecoder(): Nullable<Decoder> {
    if (!isVideoPipelineContext(this.context)) {
      return null;
    }

    const { videoStream, ffmpegState } = this.context;
    let decoder: Nullable<Decoder> = null;
    if (ffmpegState.decoderHwAccelMode === 'nvenc') {
      decoder = DecoderFactory.getNvidiaDecoder(videoStream, 'nvenc');
      if (!isNull(decoder)) {
        this.videoInputFile.addOption(decoder);
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

    const { desiredState, videoStream, ffmpegState, pipelineSteps } =
      this.context;

    let currentState = {
      ...desiredState,
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
    };

    currentState = this.decoder?.nextState(currentState) ?? currentState;

    currentState = this.setDeinterlace(currentState);
    currentState = this.setScale(currentState);
    currentState = this.setPad(currentState);

    let encoder: Nullable<VideoEncoder> = null;
    if (ffmpegState.encoderHwAccelMode === 'nvenc') {
      encoder = EncoderFactory.getNvidiaEncoder(videoStream);
    }

    if (isNull(encoder)) {
      const { encoder: softwareEncoder, nextState } = super.setupEncoder(
        currentState,
      );
      currentState = nextState;
      encoder = softwareEncoder;
    }

    if (!isNull(encoder)) {
      pipelineSteps.push(encoder);
      this.videoInputFile.filterSteps.push(encoder);
    }

    // args.filterChain.videoFilterSteps.push(...this.videoInputFile.filterSteps);
  }

  protected override setDeinterlace(currentState: FrameState): FrameState {
    if (this.desiredState.interlaced) {
      const filter =
        currentState.frameDataLocation === 'software'
          ? new DeinterlaceFilter(this.ffmpegState, currentState)
          : new YadifCudaFilter(currentState);
      this.videoInputFile.filterSteps.push(filter);
      if (filter.affectsFrameState) {
        return filter.nextState(currentState);
      }
    }
    return currentState;
  }

  protected setScale(currentState: FrameState): FrameState {
    let nextState = currentState;
    const { desiredState, ffmpegState } = this.context;

    if (currentState.scaledSize.equals(desiredState.scaledSize)) {
      return currentState;
    }

    let scaleStep: Filter;
    const decodeToSoftware = ffmpegState.decoderHwAccelMode === 'none';
    const softwareEncoder = ffmpegState.encoderHwAccelMode === 'none';

    const noHardwareFilters = !desiredState.interlaced;
    const needsToPad = !currentState.paddedSize.equals(desiredState.paddedSize);

    if (
      decodeToSoftware &&
      (needsToPad || noHardwareFilters) &&
      softwareEncoder
    ) {
      scaleStep = ScaleFilter.create(
        currentState,
        ffmpegState,
        desiredState.scaledSize,
        desiredState.paddedSize,
      );
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

  protected setPad(currentState: FrameState): FrameState {
    if (!isVideoPipelineContext(this.context)) {
      return currentState;
    }

    let nextState = currentState;
    if (currentState.paddedSize.equals(this.desiredState.paddedSize) == false) {
      // TODO: move this into current/desired state, but see if it works here for now
      const pixelFormat: Nullable<PixelFormat> =
        this.ffmpegState.decoderHwAccelMode == 'nvenc' &&
        this.context.videoStream.pixelFormat != null &&
        this.context.videoStream.pixelFormat.bitDepth == 8
          ? new PixelFormatNv12(this.context.videoStream.pixelFormat.name)
          : this.context.videoStream.pixelFormat;

      const padStep = new PadFilter(
        currentState,
        this.desiredState,
        pixelFormat,
      );

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
