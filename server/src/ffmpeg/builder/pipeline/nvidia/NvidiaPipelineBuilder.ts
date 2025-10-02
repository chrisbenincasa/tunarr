import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import type { BaseFfmpegHardwareCapabilities } from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.js';
import type { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.js';
import { OutputFormatTypes, VideoFormats } from '@/ffmpeg/builder/constants.js';
import type { Decoder } from '@/ffmpeg/builder/decoder/Decoder.js';
import type { VideoEncoder } from '@/ffmpeg/builder/encoder/BaseEncoder.js';
import { BaseEncoder } from '@/ffmpeg/builder/encoder/BaseEncoder.js';
import { DeinterlaceFilter } from '@/ffmpeg/builder/filter/DeinterlaceFilter.js';
import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import { PadFilter } from '@/ffmpeg/builder/filter/PadFilter.js';
import { PixelFormatFilter } from '@/ffmpeg/builder/filter/PixelFormatFilter.js';
import { ScaleFilter } from '@/ffmpeg/builder/filter/ScaleFilter.js';
import { FormatCudaFilter } from '@/ffmpeg/builder/filter/nvidia/FormatCudaFilter.js';
import { HardwareDownloadCudaFilter } from '@/ffmpeg/builder/filter/nvidia/HardwareDownloadCudaFilter.js';
import { HardwareUploadCudaFilter } from '@/ffmpeg/builder/filter/nvidia/HardwareUploadCudaFilter.js';
import { OverlayWatermarkCudaFilter } from '@/ffmpeg/builder/filter/nvidia/OverlayWatermarkCudaFilter.js';
import { ScaleCudaFilter } from '@/ffmpeg/builder/filter/nvidia/ScaleCudaFilter.js';
import { YadifCudaFilter } from '@/ffmpeg/builder/filter/nvidia/YadifCudaFilter.js';
import { OverlayWatermarkFilter } from '@/ffmpeg/builder/filter/watermark/OverlayWatermarkFilter.js';
import type { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.js';
import type { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import type { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.js';
import type { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.js';
import { PixelFormatOutputOption } from '@/ffmpeg/builder/options/OutputOption.js';
import { CudaHardwareAccelerationOption } from '@/ffmpeg/builder/options/hardwareAcceleration/NvidiaOptions.js';
import { isVideoPipelineContext } from '@/ffmpeg/builder/pipeline/BasePipelineBuilder.js';
import { SoftwarePipelineBuilder } from '@/ffmpeg/builder/pipeline/software/SoftwarePipelineBuilder.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import type { Nullable } from '@/types/util.js';
import { isDefined, isNonEmptyString } from '@/util/index.js';
import { head, isEmpty, isNil, isNull, reject, some } from 'lodash-es';
import {
  ImplicitNvidiaDecoder,
  NvidiaDecoder,
} from '../../decoder/nvidia/NvidiaDecoder.ts';
import {
  NvidiaH264Encoder,
  NvidiaHevcEncoder,
} from '../../encoder/nvidia/NvidiaEncoders.ts';
import { HardwareDownloadFilter } from '../../filter/HardwareDownloadFilter.ts';
import { ImageScaleFilter } from '../../filter/ImageScaleFilter.ts';
import { SubtitleFilter } from '../../filter/SubtitleFilter.ts';
import { SubtitleOverlayFilter } from '../../filter/SubtitleOverlayFilter.ts';
import { NvidiaCropBottomBitstreamFilter } from '../../filter/nvidia/NvidiaCropBottomBitstreamFilter.ts';
import { OverlaySubtitleCudaFilter } from '../../filter/nvidia/OverlaySubtitleCudaFilter.ts';
import { ScaleNppFilter } from '../../filter/nvidia/ScaleNppFilter.ts';
import { SubtitleScaleNppFilter } from '../../filter/nvidia/SubtitleScaleNppFilter.ts';
import { WatermarkOpacityFilter } from '../../filter/watermark/WatermarkOpacityFilter.ts';
import { WatermarkScaleFilter } from '../../filter/watermark/WatermarkScaleFilter.ts';
import {
  PixelFormatNv12,
  PixelFormatP010,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
  PixelFormatYuva420P,
} from '../../format/PixelFormat.ts';
import type { SubtitlesInputSource } from '../../input/SubtitlesInputSource.ts';
import { KnownFfmpegFilters } from '../../options/KnownFfmpegOptions.ts';
import { CopyTimestampInputOption } from '../../options/input/CopyTimestampInputOption.ts';
import { DoNotIgnoreLoopInputOption } from '../../options/input/DoNotIgnoreLoopInputOption.ts';
import { InfiniteLoopInputOption } from '../../options/input/InfiniteLoopInputOption.ts';
import { NvidiaDeinterlacer } from './NvidiaDeinterlacer.ts';
import { NvidiaScaler } from './NvidiaScaler.ts';

export class NvidiaPipelineBuilder extends SoftwarePipelineBuilder {
  constructor(
    private hardwareCapabilities: BaseFfmpegHardwareCapabilities,
    binaryCapabilities: FfmpegCapabilities,
    videoInputFile: Nullable<VideoInputSource>,
    audioInputFile: Nullable<AudioInputSource>,
    concatInputSource: Nullable<ConcatInputSource>,
    watermarkInputSource: Nullable<WatermarkInputSource>,
    subtitleInputSource: Nullable<SubtitlesInputSource>,
  ) {
    super(
      videoInputFile,
      audioInputFile,
      watermarkInputSource,
      subtitleInputSource,
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

    let canDecode = this.context.pipelineOptions?.disableHardwareDecoding
      ? false
      : this.hardwareCapabilities.canDecodeVideoStream(videoStream);
    let canEncode = this.context.pipelineOptions?.disableHardwareEncoding
      ? false
      : this.hardwareCapabilities.canEncodeState(desiredState);

    // Hardcode this assumption for now
    if (canEncode && desiredState.videoFormat === VideoFormats.Raw) {
      canEncode = false;
    }

    if (
      canDecode &&
      this.context.shouldDeinterlace &&
      videoStream.codec === VideoFormats.Mpeg2Video
    ) {
      canDecode = false;
    }

    if (canDecode) {
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

    const { ffmpegState } = this.context;
    let decoder: Nullable<Decoder> = null;
    if (ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Cuda) {
      decoder = new ImplicitNvidiaDecoder();
      this.videoInputSource.addOption(decoder);
    } else {
      decoder = super.setupDecoder();
    }
    this.decoder = decoder;
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
      pixelFormat: videoStream.pixelFormat,
    });

    currentState = this.decoder?.nextState(currentState) ?? currentState;
    this.videoInputSource.frameDataLocation = currentState.frameDataLocation;

    // Workaround change to required pixel format from https://github.com/FFmpeg/FFmpeg/commit/30e6effff94c6f4310aa2db571917bb2952f4d9e
    // Specifically, CUDA pixel formats use 16-bit (p016) internally starting on 7.2 it seems. Preemptively convert
    // to p010 here to avoid potential hwdownload issues later in pipeline.
    if (
      this.decoder instanceof ImplicitNvidiaDecoder &&
      videoStream.bitDepth() === 10
    ) {
      const filter = ScaleCudaFilter.formatOnly(
        currentState,
        new PixelFormatP010(),
        true,
      );
      currentState = filter.nextState(currentState);
      this.videoInputSource.addFilter(filter);
    }

    currentState = NvidiaDeinterlacer.setDeinterlace(
      this.context,
      this.videoInputSource,
      currentState,
    );
    currentState = NvidiaScaler.setScale(
      this.context,
      this.videoInputSource,
      currentState,
    );
    currentState = this.setPad(currentState);
    this.setStillImageLoop();

    if (
      currentState.bitDepth === 8 &&
      (this.watermarkInputSource || this.context.hasSubtitleOverlay())
    ) {
      this.logger.trace(
        'checking for pixel format for overlay: %O',
        currentState,
      );
      const desiredPixelFormat = new PixelFormatYuv420P();
      if (
        !isNil(currentState.pixelFormat) &&
        !desiredPixelFormat.equals(currentState.pixelFormat)
      ) {
        this.logger.trace('adding pixel filter format for watermark!!!');
        if (currentState.frameDataLocation === FrameDataLocation.Software) {
          const pixelFormatFilter = new PixelFormatFilter(desiredPixelFormat);
          currentState = pixelFormatFilter.nextState(currentState);
          this.videoInputSource.filterSteps.push(pixelFormatFilter);
        } else {
          const filter = ScaleCudaFilter.formatOnly(
            currentState,
            desiredPixelFormat,
          );
          currentState = filter.nextState(currentState);
          this.videoInputSource.filterSteps.push(filter);
        }
      }
    }

    // If we're using intermittent watermarks, we're gonna force software overlay
    // to avoid issues with overlay_cuda producing green lines.
    // TODO: is this necessary?
    // See: https://trac.ffmpeg.org/ticket/9442
    const needsSoftwareWatermarkOverlay =
      this.context.hasWatermark &&
      (!isEmpty(this.watermarkInputSource?.watermark.fadeConfig) ||
        (isDefined(this.watermarkInputSource?.watermark.duration) &&
          this.watermarkInputSource.watermark.duration > 0) ||
        this.context.pipelineOptions?.disableHardwareFilters);

    // If we're certain that we're about to use a hardware overlay of some sort
    // then ensure the video stream is uploaded to hardware.
    if (
      currentState.frameDataLocation === FrameDataLocation.Software &&
      currentState.bitDepth === 8 &&
      !this.context.hasSubtitleTextContext() &&
      !this.context.pipelineOptions.disableHardwareFilters &&
      (this.context.hasSubtitleOverlay() ||
        (this.context.hasWatermark && !needsSoftwareWatermarkOverlay))
    ) {
      const filter = new HardwareUploadCudaFilter(currentState);
      currentState = filter.nextState(currentState);
      this.videoInputSource.filterSteps.push(filter);
    }

    currentState = this.addSubtitles(currentState);

    // If we are in hardware after adding subtitles and need to use software
    // for the watermark, do a download
    if (
      currentState.frameDataLocation === FrameDataLocation.Hardware &&
      needsSoftwareWatermarkOverlay
    ) {
      const hwDownloadFilter = new HardwareDownloadCudaFilter(
        currentState,
        null,
      );

      currentState = hwDownloadFilter.nextState(currentState);

      // If we overlaid subtitles, we need to download that stream
      // and now the video stream, since that's where we're going to overlay
      // the watermark
      if (
        this.context.hasSubtitleOverlay() &&
        this.subtitleOverlayFilterChain.length > 0
      ) {
        // Watermark will get overlaid on top of the video+sub stream
        this.subtitleOverlayFilterChain.push(hwDownloadFilter);
      } else {
        // Otherwise we hwdownload the
        this.videoInputSource.filterSteps.push(hwDownloadFilter);
      }
    } else if (
      currentState.frameDataLocation === FrameDataLocation.Software &&
      !needsSoftwareWatermarkOverlay
    ) {
      const hwUpload = new HardwareUploadCudaFilter(currentState);
      currentState = hwUpload.nextState(currentState);

      if (
        this.context.hasSubtitleOverlay() &&
        this.subtitleOverlayFilterChain.length > 0
      ) {
        this.subtitleOverlayFilterChain.push(hwUpload);
      } else {
        currentState = this.addFilterToVideoChain(currentState, hwUpload);
      }
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
          break;
      }
    }

    if (!encoder) {
      encoder = super.setupEncoder(currentState);
    }

    if (!isNull(encoder)) {
      pipelineSteps.push(encoder);
      this.videoInputSource.filterSteps.push(encoder);
    }

    currentState = this.setPixelFormat(currentState);

    if (
      this.ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Cuda &&
      this.ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.Cuda &&
      (this.context.videoStream.frameSize.equals(
        this.desiredState.scaledSize,
      ) ||
        (this.context.hasSubtitleOverlay() &&
          this.desiredState.paddedSize.equals(this.desiredState.scaledSize) &&
          (this.context.hasSubtitleOverlay() || this.context.hasWatermark)))
    ) {
      this.pipelineSteps.push(
        new NvidiaCropBottomBitstreamFilter(
          this.desiredState.videoFormat,
          this.desiredState.paddedSize,
        ),
      );
    }
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
      currentState = filter.nextState(currentState);
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

    const noHardwareFilters = !desiredState.deinterlace;
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
        this.context.hasWatermark || this.context.hasSubtitleOverlay();
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

    nextState = scaleStep.nextState(nextState);

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

      const padStep = this.context.pipelineOptions?.disableHardwareFilters
        ? PadFilter.create(currentState, this.desiredState)
        : PadFilter.forCuda(currentState, this.desiredState);

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

    this.logger.trace('Desired pixel format: %s', desiredFormat.name);

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
        currentState,
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
        this.logger.trace(
          "Pixel format %s doesn't equal format %s",
          currentState.pixelFormat?.prettyPrint(),
          desiredFormat.prettyPrint(),
        );
        const formatFilter = new FormatCudaFilter(desiredFormat);
        currentState = formatFilter.nextState(currentState);
        steps.push(formatFilter);
      }

      const hwDownloadFilter = new HardwareDownloadCudaFilter(
        currentState,
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

  protected addSubtitles(currentState: FrameState): FrameState {
    if (!this.subtitleInputSource) {
      return currentState;
    }

    if (this.context.hasSubtitleTextContext()) {
      this.videoInputSource.addOption(new CopyTimestampInputOption());

      const cuvidDecoder = this.videoInputSource.getInputOption(NvidiaDecoder);
      if (this.videoInputSource.filterSteps.length === 0 && cuvidDecoder) {
        // TODO: is this necessary
        cuvidDecoder.hardwareAccelerationMode = HardwareAccelerationMode.None;
      } else {
        currentState = this.addFilterToVideoChain(
          currentState,
          new HardwareDownloadFilter(currentState),
        );
      }

      currentState = this.addFilterToVideoChain(
        currentState,
        new SubtitleFilter(this.subtitleInputSource),
      );

      // if (this.context.hasWatermark) {
      //   currentState = this.addFilterToVideoChain(
      //     currentState,
      //     new HardwareUploadCudaFilter(currentState),
      //   );
      // }

      return currentState;
    }

    if (this.context.hasSubtitleOverlay()) {
      this.subtitleInputSource.filterSteps.push(
        new PixelFormatFilter(new PixelFormatYuva420P()),
      );

      const needsSubtitleScale = this.videoInputSource.hasAnyFilterStep([
        ScaleCudaFilter,
        ScaleNppFilter,
        ScaleFilter,
        PadFilter,
      ]);

      if (currentState.bitDepth === 8) {
        const hasNpp = this.ffmpegCapabilities.hasFilter(
          KnownFfmpegFilters.ScaleNpp,
        );

        if (needsSubtitleScale) {
          if (hasNpp && !this.context.pipelineOptions?.disableHardwareFilters) {
            // Use a hardware scale. Only scale_npp supports yuva
            const hwUpload = new HardwareUploadCudaFilter(
              currentState.updateFrameLocation(FrameDataLocation.Software),
            );
            this.subtitleInputSource.frameDataLocation =
              FrameDataLocation.Hardware;
            this.subtitleInputSource.filterSteps.push(hwUpload);

            this.subtitleInputSource.filterSteps.push(
              new SubtitleScaleNppFilter(this.desiredState.paddedSize),
            );
          } else {
            // Otherwise perform the scale on software and the upload to the GPU, unless
            // explicitly stated otherwise
            this.subtitleInputSource.addFilter(
              new ImageScaleFilter(this.desiredState.paddedSize),
            );

            if (!this.context.pipelineOptions?.disableHardwareFilters) {
              this.subtitleInputSource.addFilter(
                new HardwareUploadCudaFilter(
                  currentState.updateFrameLocation(FrameDataLocation.Software),
                ),
              );
              this.subtitleInputSource.frameDataLocation =
                FrameDataLocation.Hardware;
            }
          }
        } else {
          // if (needsSubtitleScale) {
          //   const filter = new ImageScaleFilter(this.desiredState.paddedSize);
          //   this.subtitleInputSource.filterSteps.push(filter);
          // }

          if (!this.context.pipelineOptions?.disableHardwareFilters) {
            const hwUpload = new HardwareUploadCudaFilter(
              currentState.updateFrameLocation(FrameDataLocation.Software),
            );
            this.subtitleInputSource.frameDataLocation =
              FrameDataLocation.Hardware;
            this.subtitleInputSource.filterSteps.push(hwUpload);
          }
        }

        if (this.context.pipelineOptions?.disableHardwareFilters) {
          this.context.filterChain.subtitleOverlayFilterSteps.push(
            new SubtitleOverlayFilter(
              this.desiredState.pixelFormat ?? new PixelFormatYuv420P(),
            ),
          );
        } else {
          this.context.filterChain.subtitleOverlayFilterSteps.push(
            new OverlaySubtitleCudaFilter(),
          );
        }
      } else {
        // 10-bit case
        if (currentState.frameDataLocation === FrameDataLocation.Hardware) {
          currentState = this.addFilterToVideoChain(
            currentState,
            new HardwareDownloadCudaFilter(currentState, null),
          );
          this.videoInputSource.frameDataLocation = FrameDataLocation.Software;
        }

        if (needsSubtitleScale) {
          this.subtitleInputSource.addFilter(
            new ImageScaleFilter(this.desiredState.paddedSize),
          );
        }

        this.subtitleOverlayFilterChain.push(
          new SubtitleOverlayFilter(
            this.desiredState.pixelFormat ?? new PixelFormatYuv420P(),
          ),
        );

        if (currentState.bitDepth === 10) {
          this.subtitleOverlayFilterChain.push(
            new PixelFormatFilter(new PixelFormatYuv420P10Le()),
          );
        }
      }
      return currentState;
    }

    return currentState;
  }

  protected setWatermark(currentState: FrameState): FrameState {
    if (!this.watermarkInputSource) {
      return currentState;
    }

    const watermarkInput = this.watermarkInputSource;

    for (const watermark of watermarkInput.streams ?? []) {
      if (watermark.inputKind !== 'stillimage') {
        watermarkInput.addOption(new DoNotIgnoreLoopInputOption());
      } else if (isDefined(head(watermarkInput.watermark.fadeConfig))) {
        // TODO: Needs hwaccel option here
        watermarkInput.addOption(new InfiniteLoopInputOption());
      }
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

      if (currentState.pixelFormat?.bitDepth === 10) {
        // We're about to use overlay_cuda but we still have a 10-bit input, which
        // overlay_cuda does not support. We need to convert the input down to 8-bit
        // to perform the overlay (alternatively, we could've just forced software
        // overlay...and we still might, in a future version)
        const hwPixelFormatChange = ScaleCudaFilter.formatOnly(
          currentState,
          new PixelFormatYuv420P(),
        );
        currentState = hwPixelFormatChange.nextState(currentState);
        this.videoInputSource.filterSteps.push(hwPixelFormatChange);
      }

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
