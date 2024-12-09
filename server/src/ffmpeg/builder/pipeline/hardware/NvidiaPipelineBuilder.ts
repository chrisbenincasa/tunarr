import { BaseFfmpegHardwareCapabilities } from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.ts';
import { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.ts';
import { OutputFormatTypes, VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { Decoder } from '@/ffmpeg/builder/decoder/Decoder.ts';
import { DecoderFactory } from '@/ffmpeg/builder/decoder/DecoderFactory.ts';
import {
  BaseEncoder,
  VideoEncoder,
} from '@/ffmpeg/builder/encoder/BaseEncoder.ts';
import { DeinterlaceFilter } from '@/ffmpeg/builder/filter/DeinterlaceFilter.ts';
import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { PadFilter } from '@/ffmpeg/builder/filter/PadFilter.ts';
import { PixelFormatFilter } from '@/ffmpeg/builder/filter/PixelFormatFilter.ts';
import { ScaleFilter } from '@/ffmpeg/builder/filter/ScaleFilter.ts';
import { FormatCudaFilter } from '@/ffmpeg/builder/filter/nvidia/FormatCudaFilter.ts';
import { HardwareDownloadCudaFilter } from '@/ffmpeg/builder/filter/nvidia/HardwareDownloadCudaFilter.ts';
import { HardwareUploadCudaFilter } from '@/ffmpeg/builder/filter/nvidia/HardwareUploadCudaFilter.ts';
import { OverlayWatermarkCudaFilter } from '@/ffmpeg/builder/filter/nvidia/OverlayWatermarkCudaFilter.ts';
import { ScaleCudaFilter } from '@/ffmpeg/builder/filter/nvidia/ScaleCudaFilter.ts';
import { YadifCudaFilter } from '@/ffmpeg/builder/filter/nvidia/YadifCudaFilter.ts';
import { OverlayWatermarkFilter } from '@/ffmpeg/builder/filter/watermark/OverlayWatermarkFilter.ts';
import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.ts';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.ts';
import { PixelFormatOutputOption } from '@/ffmpeg/builder/options/OutputOption.ts';
import { CudaHardwareAccelerationOption } from '@/ffmpeg/builder/options/hardwareAcceleration/NvidiaOptions.ts';
import { isVideoPipelineContext } from '@/ffmpeg/builder/pipeline/BasePipelineBuilder.ts';
import { SoftwarePipelineBuilder } from '@/ffmpeg/builder/pipeline/software/SoftwarePipelineBuilder.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import {
  FrameDataLocation,
  HardwareAccelerationMode,
} from '@/ffmpeg/builder/types.ts';
import { Nullable } from '@/types/util.ts';
import { isDefined, isNonEmptyString } from '@/util/index.ts';
import { isEmpty, isNil, isNull, reject, some } from 'lodash-es';
import {
  NvidiaH264Encoder,
  NvidiaHevcEncoder,
} from '../../encoder/nvidia/NvidiaEncoders.ts';
import { WatermarkOpacityFilter } from '../../filter/watermark/WatermarkOpacityFilter.ts';
import { WatermarkScaleFilter } from '../../filter/watermark/WatermarkScaleFilter.ts';
import {
  PixelFormatNv12,
  PixelFormatYuv420P,
  PixelFormatYuva420P,
} from '../../format/PixelFormat.ts';

export class NvidiaPipelineBuilder extends SoftwarePipelineBuilder {
  constructor(
    private hardwareCapabilities: BaseFfmpegHardwareCapabilities,
    binaryCapabilities: FfmpegCapabilities,
    videoInputFile: Nullable<VideoInputSource>,
    audioInputFile: Nullable<AudioInputSource>,
    concatInputSource: Nullable<ConcatInputSource>,
    watermarkInputSource: Nullable<WatermarkInputSource>,
  ) {
    super(
      videoInputFile,
      audioInputFile,
      watermarkInputSource,
      concatInputSource,
      binaryCapabilities,
    );
  }

  protected setHardwareAccelState(): void {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    const { videoStream, ffmpegState, desiredState, pipelineSteps } =
      this.context;

    let canDecode = this.hardwareCapabilities.canDecodeVideoStream(videoStream);
    let canEncode = this.hardwareCapabilities.canEncodeState(desiredState);

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
      this.context.shouldDeinterlace &&
      videoStream.codec === VideoFormats.Mpeg2Video
    ) {
      canDecode = false;
    }

    if (canDecode || canEncode) {
      pipelineSteps.push(new CudaHardwareAccelerationOption());
    }

    ffmpegState.decoderHwAccelMode = canDecode
      ? HardwareAccelerationMode.Cuda
      : HardwareAccelerationMode.None;
    ffmpegState.encoderHwAccelMode = canEncode
      ? HardwareAccelerationMode.Cuda
      : HardwareAccelerationMode.None;
  }

  protected setupDecoder(): Nullable<Decoder> {
    if (!isVideoPipelineContext(this.context)) {
      return null;
    }

    const { videoStream, ffmpegState } = this.context;
    let decoder: Nullable<Decoder> = null;
    if (ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Cuda) {
      decoder = DecoderFactory.getNvidiaDecoder(
        videoStream,
        HardwareAccelerationMode.Cuda,
      );
      if (!isNull(decoder)) {
        this.videoInputSource.addOption(decoder);
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
        ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Cuda &&
        videoStream.bitDepth() === 8
          ? videoStream.pixelFormat
            ? new PixelFormatNv12(videoStream.pixelFormat)
            : null
          : desiredState.pixelFormat,
    });

    currentState = this.decoder?.nextState(currentState) ?? currentState;

    currentState = this.setDeinterlace(currentState);
    currentState = this.setScale(currentState);
    currentState = this.setPad(currentState);
    this.setStillImageLoop();

    if (currentState.bitDepth === 8 && this.watermarkInputSource) {
      this.logger.debug('adding pixel filter format for watermark!!!');
      const desiredPixelFormat = new PixelFormatYuv420P();
      if (
        !isNil(currentState.pixelFormat) &&
        !desiredPixelFormat.equals(currentState.pixelFormat)
      ) {
        if (currentState.frameDataLocation === FrameDataLocation.Software) {
          const pixelFormatFilter = new PixelFormatFilter(desiredPixelFormat);
          currentState = pixelFormatFilter.nextState(currentState);
          this.videoInputSource.filterSteps.push(pixelFormatFilter);
        } else {
          const filter = new ScaleCudaFilter(
            currentState.update({ pixelFormat: desiredPixelFormat }),
            currentState.scaledSize,
            currentState.paddedSize,
          );
          currentState = filter.nextState(currentState);
          this.videoInputSource.filterSteps.push(filter);
        }
      }
    }

    const needsSoftwareWatermarkOverlay =
      (this.context.hasWatermark &&
        !isEmpty(this.watermarkInputSource?.watermark.fadeConfig)) ||
      (isDefined(this.watermarkInputSource?.watermark.duration) &&
        this.watermarkInputSource.watermark.duration > 0);

    if (
      currentState.frameDataLocation === FrameDataLocation.Software &&
      currentState.bitDepth === 8 &&
      // We're not going to attempt to use the hwaccel overlay
      // filter unless we're on >=5.0.0 because overlay_cuda does
      // not support the W/w/H/h params on earlier versions
      this.ffmpegState.isAtLeastVersion({ major: 5 }) &&
      !needsSoftwareWatermarkOverlay
    ) {
      const filter = new HardwareUploadCudaFilter(currentState);
      currentState = filter.nextState(currentState);
      this.videoInputSource.filterSteps.push(filter);
    }

    // Overlay watermark in software if we have any timeline-enabled features
    // (e.g. intermittent watermarks or absolute duration)
    if (
      currentState.frameDataLocation === FrameDataLocation.Hardware &&
      needsSoftwareWatermarkOverlay
    ) {
      const hwDownloadFilter = new HardwareDownloadCudaFilter(
        currentState.pixelFormat,
        null,
      );
      currentState = hwDownloadFilter.nextState(currentState);
      this.videoInputSource.filterSteps.push(hwDownloadFilter);
    }

    currentState = this.setWatermark(currentState);

    let encoder: Nullable<VideoEncoder> = null;
    if (ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.Cuda) {
      switch (desiredState.videoFormat) {
        case VideoFormats.Hevc: {
          encoder = new NvidiaHevcEncoder(desiredState.videoPreset);
          break;
        }
        case VideoFormats.H264: {
          encoder = new NvidiaH264Encoder(
            desiredState.videoProfile,
            desiredState.videoPreset,
          );
          break;
        }
        default:
          encoder = super.setupEncoder(currentState);
          break;
      }
    }

    if (!isNull(encoder)) {
      pipelineSteps.push(encoder);
      this.videoInputSource.filterSteps.push(encoder);
    }

    currentState = this.setPixelFormat(currentState);

    this.context.filterChain.videoFilterSteps =
      this.videoInputSource.filterSteps;
  }

  protected override setDeinterlace(currentState: FrameState): FrameState {
    if (this.context.shouldDeinterlace) {
      const filter =
        currentState.frameDataLocation === FrameDataLocation.Software
          ? new DeinterlaceFilter(this.ffmpegState, currentState)
          : new YadifCudaFilter(currentState);
      this.videoInputSource.filterSteps.push(filter);
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

    let scaleStep: FilterOption;
    const decodeToSoftware =
      ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.None;
    const softwareEncoder =
      ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None;

    const noHardwareFilters = !desiredState.deinterlaced;
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
      const hasOverlay =
        this.context.hasWatermark || this.context.hasSubtitleOverlay;
      const isHardwareDecodeAndSoftwareEncode =
        this.ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Cuda &&
        this.ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None;
      const outPixelFormat =
        !this.context.is10BitOutput &&
        (hasOverlay ||
          !desiredState.scaledSize.equals(desiredState.paddedSize) ||
          isHardwareDecodeAndSoftwareEncode)
          ? desiredState.pixelFormat
            ? new PixelFormatNv12(desiredState.pixelFormat)
            : null
          : null;
      scaleStep = new ScaleCudaFilter(
        currentState.update({
          pixelFormat: outPixelFormat,
        }),
        desiredState.scaledSize,
        desiredState.paddedSize,
      );
    }

    if (scaleStep.affectsFrameState) {
      nextState = scaleStep.nextState(nextState);
    }

    if (isNonEmptyString(scaleStep.filter)) {
      this.videoInputSource.filterSteps.push(scaleStep);
    }

    return nextState;
  }

  protected setPad(currentState: FrameState): FrameState {
    if (!isVideoPipelineContext(this.context)) {
      return currentState;
    }

    let nextState = currentState;
    if (!currentState.paddedSize.equals(this.desiredState.paddedSize)) {
      // TODO: move this into current/desired state, but see if it works here for now
      // const pixelFormat: Nullable<PixelFormat> =
      //   this.ffmpegState.decoderHwAccelMode == HardwareAccelerationMode.Cuda &&
      //   this.context.videoStream.pixelFormat?.bitDepth === 8
      //     ? new PixelFormatNv12(this.context.videoStream.pixelFormat.name)
      //     : this.context.videoStream.pixelFormat;

      const padStep = new PadFilter(
        currentState,
        this.desiredState,
        // pixelFormat,
      );

      nextState = padStep.nextState(nextState);
      this.videoInputSource.filterSteps.push(padStep);
    }
    return nextState;
  }

  protected setPixelFormat(currentState: FrameState): FrameState {
    if (!isVideoPipelineContext(this.context)) {
      return currentState;
    }

    const steps: FilterOption[] = [];

    if (!this.desiredState.pixelFormat) {
      return currentState;
    }

    const desiredFormat =
      this.desiredState.pixelFormat.toSoftwareFormat() ??
      this.desiredState.pixelFormat;

    this.logger.debug('Desired pixel format: %s', desiredFormat.name);

    // TODO vp9
    if (this.context.videoStream.codec === VideoFormats.Vp9) {
      // this.context.videoStream.colorParams
    }

    // TODO color params -- wow there's a lot of stuff to account for!!!

    if (
      this.ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None &&
      this.watermarkInputSource &&
      currentState.frameDataLocation === FrameDataLocation.Hardware
    ) {
      const hwDownloadFilter = new HardwareDownloadCudaFilter(
        currentState.pixelFormat,
        null,
      );
      currentState = hwDownloadFilter.nextState(currentState);
      steps.push(hwDownloadFilter);
    }

    if (
      currentState.frameDataLocation === FrameDataLocation.Hardware &&
      this.ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None
    ) {
      if (!currentState.pixelFormat?.equals(desiredFormat)) {
        this.logger.debug(
          "Pixel format %s doesn't equal format %s",
          currentState.pixelFormat?.prettyPrint(),
          desiredFormat.prettyPrint(),
        );
        const formatFilter = new FormatCudaFilter(desiredFormat);
        currentState = formatFilter.nextState(currentState);
        steps.push(formatFilter);
      }

      const hwDownloadFilter = new HardwareDownloadCudaFilter(
        currentState.pixelFormat,
        desiredFormat,
      );
      currentState = hwDownloadFilter.nextState(currentState);
      steps.push(hwDownloadFilter);
    }

    if (!currentState.pixelFormat?.equals(desiredFormat)) {
      if (currentState.frameDataLocation === FrameDataLocation.Hardware) {
        const noPipelineFilters = !some(
          reject(this.pipelineSteps, (step) => step instanceof BaseEncoder),
          (step) => step instanceof FilterOption,
        );
        const isSoftwareDecoder =
          this.ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.None;
        const isHardwareDecoder = !isSoftwareDecoder;
        if (
          isSoftwareDecoder ||
          noPipelineFilters ||
          (isHardwareDecoder &&
            this.ffmpegState.encoderHwAccelMode ===
              HardwareAccelerationMode.Cuda &&
            noPipelineFilters)
        ) {
          steps.push(new FormatCudaFilter(desiredFormat));
        } else {
          this.pipelineSteps.push(new PixelFormatOutputOption(desiredFormat));
        }
      } else if (!currentState.pixelFormat?.unwrap()?.equals(desiredFormat)) {
        // We are in software with possibly hardware formatted pixels... if the underlying
        // pixel format type is the same as our desired type, we shouldn't need to do anything!
        // this.pipelineSteps.push(new PixelFormatFilter(desiredFormat));
        // Using the output option seems to break with NVENC...
        this.pipelineSteps.push(new PixelFormatOutputOption(desiredFormat));
      }
    }

    if (
      this.ffmpegState.outputFormat.type === OutputFormatTypes.Nut &&
      desiredFormat.bitDepth === 10
    ) {
      this.pipelineSteps.push(new PixelFormatOutputOption(desiredFormat));
    }

    this.context.filterChain.pixelFormatFilterSteps.push(...steps);

    return currentState;
  }

  protected setWatermark(currentState: FrameState): FrameState {
    if (!this.watermarkInputSource) {
      return currentState;
    }

    if (!this.watermarkInputSource.watermark.fixedSize) {
      this.watermarkInputSource.filterSteps.push(
        new WatermarkScaleFilter(
          currentState.paddedSize,
          this.watermarkInputSource.watermark,
        ),
      );
    }

    if (this.watermarkInputSource.watermark.opacity !== 100) {
      this.watermarkInputSource.filterSteps.push(
        new WatermarkOpacityFilter(
          this.watermarkInputSource.watermark.opacity / 100.0,
        ),
      );
    }

    this.watermarkInputSource.filterSteps.push(
      ...this.getWatermarkFadeFilters(this.watermarkInputSource.watermark),
    );

    this.watermarkInputSource.filterSteps.push(
      new PixelFormatFilter(new PixelFormatYuva420P()),
    );

    // This is not compatible with ffmpeg < 5.0
    if (currentState.frameDataLocation === FrameDataLocation.Software) {
      const desiredPixelFormat = this.desiredState.pixelFormat?.unwrap();
      if (desiredPixelFormat) {
        const overlayFilter = new OverlayWatermarkFilter(
          this.watermarkInputSource.watermark,
          this.context.desiredState.paddedSize,
          this.context.videoStream!.squarePixelFrameSize(
            this.desiredState.paddedSize,
          ),
          desiredPixelFormat,
        );
        this.context.filterChain.watermarkOverlayFilterSteps.push(
          overlayFilter,
        );
        currentState = overlayFilter.nextState(currentState);
      } else {
        this.logger.warn(
          'Cannot overlay watermark without a known pixel format target! Desired state was: %s',
          this.desiredState.pixelFormat?.name,
        );
      }
    } else {
      this.watermarkInputSource.filterSteps.push(
        new HardwareUploadCudaFilter(
          currentState.updateFrameLocation(FrameDataLocation.Software),
        ),
      );

      const overlayFilter = new OverlayWatermarkCudaFilter(
        this.watermarkInputSource.watermark,
        this.context.desiredState.paddedSize,
      );

      this.context.filterChain.watermarkOverlayFilterSteps.push(overlayFilter);
      currentState = overlayFilter.nextState(currentState);
    }

    return currentState;
  }
}
