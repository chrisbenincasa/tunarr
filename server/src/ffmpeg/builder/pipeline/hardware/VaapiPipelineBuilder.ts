import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import type { BaseFfmpegHardwareCapabilities } from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.js';
import type { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.js';
import { OutputFormatTypes, VideoFormats } from '@/ffmpeg/builder/constants.js';
import type { Decoder } from '@/ffmpeg/builder/decoder/Decoder.js';
import { VaapiDecoder } from '@/ffmpeg/builder/decoder/vaapi/VaapiDecoder.js';
import { DeinterlaceFilter } from '@/ffmpeg/builder/filter/DeinterlaceFilter.js';
import type { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import { HardwareDownloadFilter } from '@/ffmpeg/builder/filter/HardwareDownloadFilter.js';
import { PadFilter } from '@/ffmpeg/builder/filter/PadFilter.js';
import { PixelFormatFilter } from '@/ffmpeg/builder/filter/PixelFormatFilter.js';
import { ScaleFilter } from '@/ffmpeg/builder/filter/ScaleFilter.js';
import { DeinterlaceVaapiFilter } from '@/ffmpeg/builder/filter/vaapi/DeinterlaceVaapiFilter.js';
import { HardwareUploadVaapiFilter } from '@/ffmpeg/builder/filter/vaapi/HardwareUploadVaapiFilter.js';
import { ScaleVaapiFilter } from '@/ffmpeg/builder/filter/vaapi/ScaleVaapiFilter.js';
import { VaapiFormatFilter } from '@/ffmpeg/builder/filter/vaapi/VaapiFormatFilter.js';
import { OverlayWatermarkFilter } from '@/ffmpeg/builder/filter/watermark/OverlayWatermarkFilter.js';
import { WatermarkOpacityFilter } from '@/ffmpeg/builder/filter/watermark/WatermarkOpacityFilter.js';
import { WatermarkScaleFilter } from '@/ffmpeg/builder/filter/watermark/WatermarkScaleFilter.js';
import type { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.js';
import type { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import type { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.js';
import type { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.js';
import { VaapiDriverEnvironmentVariable } from '@/ffmpeg/builder/options/EnvironmentVariables.js';
import { ExtraHardwareFramesOption } from '@/ffmpeg/builder/options/hardwareAcceleration/ExtraHardwareFramesOption.js';
import { VaapiHardwareAccelerationOption } from '@/ffmpeg/builder/options/hardwareAcceleration/VaapiOptions.js';
import { DoNotIgnoreLoopInputOption } from '@/ffmpeg/builder/options/input/DoNotIgnoreLoopInputOption.js';
import { InfiniteLoopInputOption } from '@/ffmpeg/builder/options/input/InfiniteLoopInputOption.js';
import { isVideoPipelineContext } from '@/ffmpeg/builder/pipeline/BasePipelineBuilder.js';
import { SoftwarePipelineBuilder } from '@/ffmpeg/builder/pipeline/software/SoftwarePipelineBuilder.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Nullable } from '@/types/util.js';
import { isDefined, isNonEmptyString } from '@/util/index.js';
import { every, head, inRange, isUndefined } from 'lodash-es';
import { P, match } from 'ts-pattern';
import {
  H264VaapiEncoder,
  HevcVaapiEncoder,
  Mpeg2VaapiEncoder,
} from '../../encoder/vaapi/VaapiEncoders.ts';
import { ImageScaleFilter } from '../../filter/ImageScaleFilter.ts';
import { SubtitleFilter } from '../../filter/SubtitleFilter.ts';
import { SubtitleOverlayFilter } from '../../filter/SubtitleOverlayFilter.ts';
import { ScaleSubtitlesVaapiFilter } from '../../filter/vaapi/ScaleSubtitlesVaapiFilter.ts';
import { VaapiOverlayFilter } from '../../filter/vaapi/VaapiOverlayFilter.ts';
import { VaapiSubtitlePixelFormatFilter } from '../../filter/vaapi/VaapiSubtitlePixelFormatFilter.ts';
import {
  KnownPixelFormats,
  PixelFormatNv12,
  PixelFormatYuva420P,
  PixelFormats,
} from '../../format/PixelFormat.ts';
import type { SubtitlesInputSource } from '../../input/SubtitlesInputSource.ts';
import { CopyTimestampInputOption } from '../../options/input/CopyTimestampInputOption.ts';
import {
  NoAutoScaleOutputOption,
  PixelFormatOutputOption,
} from '../../options/OutputOption.ts';
import { FrameDataLocation, RateControlMode } from '../../types.ts';

export class VaapiPipelineBuilder extends SoftwarePipelineBuilder {
  constructor(
    private hardwareCapabilities: BaseFfmpegHardwareCapabilities,
    binaryCapabilities: FfmpegCapabilities,
    videoInputFile: Nullable<VideoInputSource>,
    audioInputFile: Nullable<AudioInputSource>,
    watermarkInputSource: Nullable<WatermarkInputSource>,
    subtitleInputSource: Nullable<SubtitlesInputSource>,
    concatInputSource: Nullable<ConcatInputSource>,
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

  protected override setHardwareAccelState(): void {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    const { videoStream, desiredState, ffmpegState } = this.context;

    const canDecode = this.context.pipelineOptions?.disableHardwareDecoding
      ? false
      : this.hardwareCapabilities.canDecodeVideoStream(videoStream);
    let canEncode = this.context.pipelineOptions?.disableHardwareEncoding
      ? false
      : this.hardwareCapabilities.canEncodeState(desiredState);

    if (canEncode && ffmpegState.outputFormat.type === OutputFormatTypes.Nut) {
      canEncode = false;
    }

    if (isNonEmptyString(ffmpegState.vaapiDevice)) {
      this.pipelineSteps.push(
        new VaapiHardwareAccelerationOption(ffmpegState.vaapiDevice, canDecode),
      );

      if (isNonEmptyString(ffmpegState.vaapiDriver)) {
        this.pipelineSteps.push(
          new VaapiDriverEnvironmentVariable(ffmpegState.vaapiDriver),
        );
      }
    }

    // ETV turns off hw decoding if there are subtitles and watermarks
    // determine why

    if (canDecode) {
      this.pipelineSteps.push(new ExtraHardwareFramesOption());
    }

    if (canEncode) {
      this.pipelineSteps.push(NoAutoScaleOutputOption());
    }

    ffmpegState.decoderHwAccelMode = canDecode
      ? HardwareAccelerationMode.Vaapi
      : HardwareAccelerationMode.None;
    ffmpegState.encoderHwAccelMode = canEncode
      ? HardwareAccelerationMode.Vaapi
      : HardwareAccelerationMode.None;

    this.logger.debug(ffmpegState);
  }

  protected setupDecoder(): Nullable<Decoder> {
    const decoder = match([
      this.ffmpegState.decoderHwAccelMode,
      this.context.videoStream?.codec,
    ])
      .with(['vaapi', P._], () => {
        const decoder = new VaapiDecoder();
        this.videoInputSource.addOption(decoder);
        return decoder;
      })
      .otherwise(() => super.setupDecoder());

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

    currentState = this.setDeinterlace(currentState);
    currentState = this.setScale(currentState);
    currentState = this.setPad(currentState);
    this.setStillImageLoop();
    // TODO: Set crop

    // TODO: Make vaapi driver a union
    const forceSoftwareOverlay =
      this.context.pipelineOptions?.disableHardwareFilters ||
      (this.context.hasWatermark && this.context.hasSubtitleOverlay()) ||
      ffmpegState.vaapiDriver === 'radeonsi';

    currentState.forceSoftwareOverlay = forceSoftwareOverlay;

    if (
      currentState.frameDataLocation === FrameDataLocation.Software &&
      this.context.hasSubtitleOverlay() &&
      !forceSoftwareOverlay
    ) {
      const filter = new HardwareUploadVaapiFilter(true);
      currentState = this.addFilterToVideoChain(currentState, filter);
      this.videoInputSource.frameDataLocation = FrameDataLocation.Hardware;
    } else if (
      currentState.frameDataLocation === FrameDataLocation.Hardware &&
      (!this.context.hasSubtitleOverlay() || forceSoftwareOverlay) &&
      this.context.hasWatermark
    ) {
      // download for watermark (or forced software subtitle)
      const filter = new HardwareDownloadFilter(currentState);
      currentState = filter.nextState(currentState);
      this.videoInputSource.frameDataLocation = FrameDataLocation.Software;
      this.videoInputSource.filterSteps.push(filter);
    }

    currentState = this.addSubtitles(currentState);

    // Watermark
    currentState = this.setWatermark(currentState);

    const noEncoderSteps = every(
      this.getEncoderSteps(),
      (encoder) => encoder.kind !== 'video',
    );

    if (noEncoderSteps) {
      // Rate control
      const rateControlMode =
        this.hardwareCapabilities.getRateControlMode(
          desiredState.videoFormat,
          desiredState.pixelFormat ?? undefined,
        ) ?? RateControlMode.VBR;
      // encoder
      const maybeEncoder = match([
        ffmpegState.encoderHwAccelMode,
        desiredState.videoFormat,
      ])
        .with(
          [HardwareAccelerationMode.Vaapi, VideoFormats.Hevc],
          () => new HevcVaapiEncoder(rateControlMode),
        )
        .with(
          [HardwareAccelerationMode.Vaapi, VideoFormats.H264],
          () =>
            new H264VaapiEncoder(
              desiredState.videoProfile ?? undefined,
              rateControlMode,
            ),
        )
        .with(
          [HardwareAccelerationMode.Vaapi, VideoFormats.Mpeg2Video],
          () => new Mpeg2VaapiEncoder(rateControlMode),
        )
        .otherwise(() => super.setupEncoder(currentState));

      if (maybeEncoder) {
        pipelineSteps.push(maybeEncoder);
        this.videoInputSource.filterSteps.push(maybeEncoder);
      }
    }

    // pixel format
    this.context.filterChain.videoFilterSteps.push(
      ...this.videoInputSource.filterSteps,
    );
    currentState = this.setPixelFormat(currentState);
  }

  protected setPixelFormat(currentState: FrameState) {
    const steps: FilterOption[] = [];

    if (this.desiredState.pixelFormat) {
      let pixelFormat = this.desiredState.pixelFormat;
      if (this.desiredState.pixelFormat instanceof PixelFormatNv12) {
        const mappedFormat = KnownPixelFormats.forPixelFormat(
          this.desiredState.pixelFormat.name,
        );
        if (mappedFormat) {
          pixelFormat = mappedFormat;
        }
      }

      // Color params

      if (
        this.ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None
      ) {
        // Software encoder
        if (currentState.frameDataLocation === FrameDataLocation.Hardware) {
          // Download
          const desiredBitDepth = this.desiredState.pixelFormat?.bitDepth;
          const hwDownloaFilter =
            (currentState.bitDepth === 8 && (desiredBitDepth ?? 8) === 10) ||
            (currentState.bitDepth === 10 && (desiredBitDepth ?? 10) === 8)
              ? new HardwareDownloadFilter(currentState)
              : new HardwareDownloadFilter(
                  currentState.update({ pixelFormat }),
                );
          currentState = hwDownloaFilter.nextState(currentState);
          steps.push(hwDownloaFilter);
        }
      }

      let needsVaapiSetFormat = true;
      if (currentState.pixelFormat?.name !== pixelFormat.name) {
        // Pixel formats
        if (
          pixelFormat.name === PixelFormats.YUV420P &&
          this.ffmpegState.outputFormat.type !== OutputFormatTypes.Nut
        ) {
          pixelFormat = new PixelFormatNv12(pixelFormat);
        }

        if (currentState.frameDataLocation === FrameDataLocation.Hardware) {
          steps.push(new VaapiFormatFilter(pixelFormat));
          needsVaapiSetFormat = false;
        } else if (
          this.ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.Vaapi
        ) {
          steps.push(new PixelFormatFilter(pixelFormat));
          needsVaapiSetFormat = false;
        } else {
          this.pipelineSteps.push(new PixelFormatOutputOption(pixelFormat));
        }
      }

      if (
        this.ffmpegState.encoderHwAccelMode ===
          HardwareAccelerationMode.Vaapi &&
        currentState.frameDataLocation === FrameDataLocation.Software
      ) {
        steps.push(new HardwareUploadVaapiFilter(needsVaapiSetFormat, 64));
      }
    }

    this.context.filterChain.pixelFormatFilterSteps = steps;

    return currentState;
  }

  protected setDeinterlace(currentState: FrameState): FrameState {
    let nextState = currentState;
    if (this.context.shouldDeinterlace) {
      const filter =
        this.context.ffmpegState.decoderHwAccelMode ===
        HardwareAccelerationMode.Vaapi
          ? new DeinterlaceVaapiFilter(currentState)
          : new DeinterlaceFilter(this.context.ffmpegState, currentState);
      nextState = filter.nextState(currentState);
      this.videoInputSource.filterSteps.push(filter);
    }
    return nextState;
  }

  protected setScale(currentState: FrameState): FrameState {
    let nextState = currentState;
    const { desiredState, ffmpegState, shouldDeinterlace } = this.context;
    let scaleOption: FilterOption;
    if (
      !currentState.scaledSize.equals(desiredState.scaledSize) &&
      ((ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.None &&
        ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None &&
        !shouldDeinterlace) ||
        ffmpegState.decoderHwAccelMode !== HardwareAccelerationMode.Vaapi)
    ) {
      scaleOption = ScaleFilter.create(
        currentState,
        ffmpegState,
        desiredState.scaledSize,
        desiredState.paddedSize,
        // desiredState.croppedSize
      );
    } else {
      scaleOption = new ScaleVaapiFilter(
        currentState.update({
          pixelFormat:
            ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Cuda &&
            ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None
              ? desiredState.pixelFormat
                ? new PixelFormatNv12(desiredState.pixelFormat)
                : null
              : null,
        }),
        desiredState.scaledSize,
        desiredState.paddedSize,
      );
    }

    if (isNonEmptyString(scaleOption.filter)) {
      nextState = scaleOption.nextState(currentState);
      this.videoInputSource.filterSteps.push(scaleOption);
    }

    return nextState;
  }

  protected setPad(currentState: FrameState) {
    let nextState = currentState;
    if (
      isUndefined(this.desiredState.croppedSize) &&
      !currentState.paddedSize.equals(this.desiredState.paddedSize)
    ) {
      const padFilter = PadFilter.create(currentState, this.desiredState);
      nextState = padFilter.nextState(currentState);
      this.videoInputSource.filterSteps.push(padFilter);
    }
    return nextState;
  }

  protected addSubtitles(currentState: FrameState): FrameState {
    if (!this.subtitleInputSource) {
      return currentState;
    }

    if (this.context.hasSubtitleTextContext()) {
      this.videoInputSource.addOption(new CopyTimestampInputOption());
      currentState = this.addFilterToVideoChain(
        currentState,
        new HardwareDownloadFilter(currentState),
      );
      currentState = this.addFilterToVideoChain(
        currentState,
        new SubtitleFilter(this.subtitleInputSource),
      );
    }

    if (this.context.hasSubtitleOverlay()) {
      this.subtitleInputSource.addFilter(new VaapiSubtitlePixelFormatFilter());
      const needsScale = this.videoInputSource.hasAnyFilterStep([
        ScaleVaapiFilter,
        ScaleFilter,
        PadFilter,
      ]);

      if (currentState.forceSoftwareOverlay) {
        currentState = this.addFilterToVideoChain(
          currentState,
          new HardwareDownloadFilter(currentState),
        );
        if (this.desiredState.pixelFormat) {
          const targetFmt = this.desiredState.pixelFormat.unwrap();
          if (needsScale) {
            this.subtitleInputSource.filterSteps.push(
              new ImageScaleFilter(this.desiredState.paddedSize),
            );
          }
          this.subtitleOverlayFilterChain.push(
            new SubtitleOverlayFilter(targetFmt),
          );
        }
      } else {
        this.subtitleInputSource.addFilter(
          new HardwareUploadVaapiFilter(false),
        );
        if (needsScale) {
          this.subtitleInputSource.addFilter(
            new ScaleSubtitlesVaapiFilter(this.desiredState.paddedSize),
          );
        }

        this.subtitleOverlayFilterChain.push(new VaapiOverlayFilter());
      }

      if (this.context.hasWatermark && !currentState.forceSoftwareOverlay) {
        const hwDownload = new HardwareDownloadFilter(currentState);
        currentState = hwDownload.nextState(currentState);
        this.subtitleOverlayFilterChain.push(hwDownload);
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

    const watermarkInput = this.watermarkInputSource!;

    for (const watermark of watermarkInput.streams ?? []) {
      if (watermark.inputKind !== 'stillimage') {
        watermarkInput.addOption(new DoNotIgnoreLoopInputOption());
      } else if (isDefined(head(watermarkInput.watermark.fadeConfig))) {
        // TODO: Needs hwaccel option here
        watermarkInput.addOption(new InfiniteLoopInputOption());
      }
    }

    if (!watermarkInput.watermark.fixedSize) {
      // scale filter
      watermarkInput.filterSteps.push(
        new WatermarkScaleFilter(
          currentState.paddedSize,
          watermarkInput.watermark,
        ),
      );
    }

    if (inRange(watermarkInput.watermark.opacity, 0, 100)) {
      // opacity
      watermarkInput.filterSteps.push(
        new WatermarkOpacityFilter(watermarkInput.watermark.opacity),
      );
    }

    watermarkInput.filterSteps.push(
      ...this.getWatermarkFadeFilters(watermarkInput.watermark),
    );

    watermarkInput.filterSteps.push(
      new PixelFormatFilter(new PixelFormatYuva420P()),
    );

    const fadeConfig = head(watermarkInput.watermark.fadeConfig);
    if (isDefined(fadeConfig)) {
      // Fades
    }

    if (this.desiredState.pixelFormat) {
      const pf = this.desiredState.pixelFormat.unwrap();

      // Overlay
      this.context.filterChain.watermarkOverlayFilterSteps.push(
        new OverlayWatermarkFilter(
          watermarkInput.watermark,
          this.desiredState.paddedSize,
          this.context.videoStream.squarePixelFrameSize(
            currentState.paddedSize,
          ),
          pf,
        ),
      );
    }

    return currentState;
  }

  protected getIsIntelQsvOrVaapi(): boolean {
    return (
      (this.ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Vaapi ||
        this.ffmpegState.encoderHwAccelMode ===
          HardwareAccelerationMode.Vaapi) &&
      !(this.ffmpegState.vaapiDriver ?? '').toLowerCase().startsWith('radeon')
    );
  }
}
