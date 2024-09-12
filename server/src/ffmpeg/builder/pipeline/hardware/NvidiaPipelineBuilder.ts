import { isNil, isNull } from 'lodash-es';
import util from 'node:util';
import { Nullable } from '../../../../types/util';
import { isNonEmptyString } from '../../../../util';
import { VideoFormats } from '../../constants';
import { Decoder } from '../../decoder/Decoder';
import { DecoderFactory } from '../../decoder/DecoderFactory';
import { VideoEncoder } from '../../encoder/BaseEncoder';
import { EncoderFactory } from '../../encoder/EncoderFactory';
import { DeinterlaceFilter } from '../../filter/DeinterlaceFilter';
import { Filter } from '../../filter/FilterBase';
import { PadFilter } from '../../filter/PadFilter';
import { PipelineFilterStep } from '../../filter/PipelineFilterStep';
import { PixelFormatFilter } from '../../filter/PixelFormatFilter';
import { ScaleFilter } from '../../filter/ScaleFilter';
import { FormatCudaFilter } from '../../filter/nvidia/FormatCudaFilter';
import { HardwareDownloadCudaFilter } from '../../filter/nvidia/HardwareDownloadCudaFilter';
import { HardwareUploadCudaFilter } from '../../filter/nvidia/HardwareUploadCudaFilter';
import { OverlayWatermarkCudaFilter } from '../../filter/nvidia/OverlayWatermarkCudaFilter';
import { ScaleCudaFilter } from '../../filter/nvidia/ScaleCudaFilter';
import { YadifCudaFilter } from '../../filter/nvidia/YadifCudaFilter';
import { OverlayWatermarkFilter } from '../../filter/watermark/OverlayWatermarkFilter';
import {
  PixelFormat,
  PixelFormatNv12,
  PixelFormatYuv420P,
} from '../../format/PixelFormat';
import { CudaHardwareAccelerationOption } from '../../options/hardwareAcceleration/NvidiaOptions';
import { FrameState } from '../../state/FrameState';
import { isVideoPipelineContext } from '../BasePipelineBuilder';
import { SoftwarePipelineBuilder } from '../software/SoftwarePipelineBuilder';

export class NvidiaPipelineBuilder extends SoftwarePipelineBuilder {
  protected setHardwareAccelState(): void {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    const { videoStream, ffmpegState, desiredState, pipelineSteps } =
      this.context;

    let canDecode = true;
    let canEncode = true;

    // TODO: check whether can decode and can encode based on capabilities
    // minimal check for now, h264_cuvid doesn't support 10-bit
    if (
      videoStream.codec === VideoFormats.H264 &&
      videoStream.pixelFormat?.bitDepth === 10
    ) {
      canDecode = false;
    }

    // Hardcode this assumption for now
    if (desiredState.videoFormat === VideoFormats.Raw) {
      canEncode = false;
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

    ffmpegState.decoderHwAccelMode = canDecode ? 'cuda' : 'none';
    ffmpegState.encoderHwAccelMode = canEncode ? 'cuda' : 'none';
  }

  protected setupDecoder(): Nullable<Decoder> {
    if (!isVideoPipelineContext(this.context)) {
      return null;
    }

    const { videoStream, ffmpegState } = this.context;
    let decoder: Nullable<Decoder> = null;
    if (ffmpegState.decoderHwAccelMode === 'cuda') {
      decoder = DecoderFactory.getNvidiaDecoder(videoStream, 'cuda');
      if (!isNull(decoder)) {
        this.videoInputFile.addOption(decoder);
      } else {
        decoder = super.setupDecoder();
      }
    }
    this.context.decoder = decoder;
    return decoder;
  }

  protected setupVideoFilters(): void {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    const { desiredState, videoStream, ffmpegState, pipelineSteps } =
      this.context;

    let currentState = desiredState.update({
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
      pixelFormat:
        ffmpegState.decoderHwAccelMode === 'cuda' && videoStream.bitDepth === 8
          ? new PixelFormatNv12()
          : desiredState.pixelFormat,
    });

    currentState = this.decoder?.nextState(currentState) ?? currentState;

    currentState = this.setDeinterlace(currentState);
    currentState = this.setScale(currentState);
    currentState = this.setPad(currentState);

    if (currentState.bitDepth === 8 && this.watermarkInputSource) {
      console.log('adding pixel filter format for watermark!!!');
      const desiredPixelFormat = new PixelFormatYuv420P();
      if (
        !isNil(currentState.pixelFormat) &&
        !desiredPixelFormat.equals(currentState.pixelFormat)
      ) {
        if (currentState.frameDataLocation === 'software') {
          const pixelFormatFilter = new PixelFormatFilter(desiredPixelFormat);
          currentState = pixelFormatFilter.nextState(currentState);
          this.videoInputFile.filterSteps.push(pixelFormatFilter);
        } else {
          const filter = new ScaleCudaFilter(
            currentState.update({ pixelFormat: desiredPixelFormat }),
            currentState.scaledSize,
            currentState.paddedSize,
          );
          currentState = filter.nextState(currentState);
          this.videoInputFile.filterSteps.push(filter);
        }
      }
    }

    if (
      currentState.frameDataLocation === 'software' &&
      currentState.bitDepth === 8 &&
      // We're not going to attempt to use the hwaccel overlay
      // filter unless we're on >=5.0.0 because overlay_cuda does
      // not support the W/w/H/h params on earlier versions
      this.ffmpegState.isAtLeastVersion('5.0.0') &&
      this.watermarkInputSource
    ) {
      const filter = new HardwareUploadCudaFilter(currentState);
      currentState = filter.nextState(currentState);
      this.videoInputFile.filterSteps.push(filter);
    }

    currentState = this.setWatermark(currentState);

    let encoder: Nullable<VideoEncoder> = null;
    console.log(ffmpegState.encoderHwAccelMode);
    if (ffmpegState.encoderHwAccelMode === 'cuda') {
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

    this.logger.debug(util.inspect(currentState));
    currentState = this.setPixelFormat(currentState);

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

    console.log('do scale', currentState.scaledSize, desiredState.scaledSize);
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
        this.ffmpegState.decoderHwAccelMode == 'cuda' &&
        this.context.videoStream.pixelFormat?.bitDepth === 8
          ? new PixelFormatNv12()
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

  protected setPixelFormat(currentState: FrameState): FrameState {
    let nextState = currentState;
    const steps: PipelineFilterStep[] = [];
    // TODO ton of stuff to do here
    if (!isNull(this.desiredState.pixelFormat)) {
      // TODO figure out about available pixel formats
      const desiredFormat = this.desiredState.pixelFormat; //.name === PixelFormats.NV12 ? null : this.desiredState.pixelFormat;

      // TODO vp9

      // TODO color params -- wow there's a lot of stuff to account for!!!

      if (
        this.ffmpegState.encoderHwAccelMode === 'none' &&
        this.watermarkInputSource &&
        currentState.frameDataLocation === 'hardware'
      ) {
        this.logger.debug('%O', currentState);
        const hwDownloadFilter = new HardwareDownloadCudaFilter(
          currentState.pixelFormat,
          null,
        );
        nextState = hwDownloadFilter.nextState(nextState);
        steps.push(hwDownloadFilter);
      }

      console.log('pixelFormat', nextState, this.ffmpegState);
      if (
        nextState.frameDataLocation === 'hardware' &&
        this.ffmpegState.encoderHwAccelMode === 'none'
      ) {
        if (nextState.pixelFormat?.ffmpegName !== desiredFormat?.ffmpegName) {
          // TODO CUDA format filter
          const formatFilter = new FormatCudaFilter(desiredFormat);
          nextState = formatFilter.nextState(nextState);
          steps.push(formatFilter);
        }

        const hwDownloadFilter = new HardwareDownloadCudaFilter(
          nextState.pixelFormat,
          desiredFormat,
        );
        nextState = hwDownloadFilter.nextState(nextState);
        steps.push(hwDownloadFilter);
      }

      if (nextState.pixelFormat?.ffmpegName !== desiredFormat?.ffmpegName) {
        // TODO figureout what is going on here
      }
    }

    this.context.filterChain.pixelFormatFilterSteps.push(...steps);

    return currentState;
  }

  protected setWatermark(currentState: FrameState): FrameState {
    let nextState = currentState;
    if (this.watermarkInputSource) {
      this.watermarkInputSource.filterSteps.push(
        new PixelFormatFilter(new PixelFormatYuv420P()),
      );

      // This is not compatible with ffmpeg < 5.0
      if (this.context.ffmpegState.isAtLeastVersion('5.0.0')) {
        this.watermarkInputSource.filterSteps.push(
          new HardwareUploadCudaFilter(
            currentState.updateFrameLocation('software'),
          ),
        );

        const overlayFilter = new OverlayWatermarkCudaFilter(
          this.watermarkInputSource.watermark,
          this.context.desiredState.paddedSize,
        );

        this.context.filterChain.watermarkOverlayFilterSteps.push(
          overlayFilter,
        );
        nextState = overlayFilter.nextState(currentState);
      } else {
        const overlayFilter = new OverlayWatermarkFilter(
          this.watermarkInputSource.watermark,
          this.context.desiredState.paddedSize,
          new PixelFormatYuv420P(),
        );
        this.context.filterChain.watermarkOverlayFilterSteps.push(
          overlayFilter,
        );
        nextState = overlayFilter.nextState(nextState);
      }
    }

    return nextState;
  }
}
