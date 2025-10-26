import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import type { BaseFfmpegHardwareCapabilities } from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.js';
import type { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.js';
import { OutputFormatTypes, VideoFormats } from '@/ffmpeg/builder/constants.js';
import type { Decoder } from '@/ffmpeg/builder/decoder/Decoder.js';
import { DecoderFactory } from '@/ffmpeg/builder/decoder/DecoderFactory.js';
import { Encoder } from '@/ffmpeg/builder/encoder/Encoder.js';
import { DeinterlaceFilter } from '@/ffmpeg/builder/filter/DeinterlaceFilter.js';
import type { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import { HardwareDownloadFilter } from '@/ffmpeg/builder/filter/HardwareDownloadFilter.js';
import { PadFilter } from '@/ffmpeg/builder/filter/PadFilter.js';
import { PixelFormatFilter } from '@/ffmpeg/builder/filter/PixelFormatFilter.js';
import { ScaleFilter } from '@/ffmpeg/builder/filter/ScaleFilter.js';
import { DeinterlaceQsvFilter } from '@/ffmpeg/builder/filter/qsv/DeinterlaceQsvFilter.js';
import { QsvFormatFilter } from '@/ffmpeg/builder/filter/qsv/QsvFormatFilter.js';
import { ScaleQsvFilter } from '@/ffmpeg/builder/filter/qsv/ScaleQsvFilter.js';
import { OverlayWatermarkFilter } from '@/ffmpeg/builder/filter/watermark/OverlayWatermarkFilter.js';
import { WatermarkOpacityFilter } from '@/ffmpeg/builder/filter/watermark/WatermarkOpacityFilter.js';
import { WatermarkScaleFilter } from '@/ffmpeg/builder/filter/watermark/WatermarkScaleFilter.js';
import {
  PixelFormatNv12,
  PixelFormatP010,
  PixelFormatYuv420P10Le,
  PixelFormatYuva420P,
  PixelFormats,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import type { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.js';
import type { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import type { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.js';
import type { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.js';
import { PixelFormatOutputOption } from '@/ffmpeg/builder/options/OutputOption.js';
import { QsvHardwareAccelerationOption } from '@/ffmpeg/builder/options/hardwareAcceleration/QsvOptions.js';
import { DoNotIgnoreLoopInputOption } from '@/ffmpeg/builder/options/input/DoNotIgnoreLoopInputOption.js';
import { InfiniteLoopInputOption } from '@/ffmpeg/builder/options/input/InfiniteLoopInputOption.js';
import { isVideoPipelineContext } from '@/ffmpeg/builder/pipeline/BasePipelineBuilder.js';
import { SoftwarePipelineBuilder } from '@/ffmpeg/builder/pipeline/software/SoftwarePipelineBuilder.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import type { Nullable } from '@/types/util.js';
import { isDefined, isNonEmptyString } from '@/util/index.js';
import { every, head, inRange, isNull, some } from 'lodash-es';
import { H264QsvEncoder } from '../../encoder/qsv/H264QsvEncoder.ts';
import { HevcQsvEncoder } from '../../encoder/qsv/HevcQsvEncoder.ts';
import { Mpeg2QsvEncoder } from '../../encoder/qsv/Mpeg2QsvEncoder.ts';
import { ImageScaleFilter } from '../../filter/ImageScaleFilter.ts';
import { ResetPtsFilter } from '../../filter/ResetPtsFilter.ts';
import { SetFpsFilter } from '../../filter/SetFpsFilter.ts';
import { SubtitleFilter } from '../../filter/SubtitleFilter.ts';
import { SubtitleOverlayFilter } from '../../filter/SubtitleOverlayFilter.ts';
import type { SubtitlesInputSource } from '../../input/SubtitlesInputSource.ts';
import { CopyTimestampInputOption } from '../../options/input/CopyTimestampInputOption.ts';
import { FrameRateOutputOption } from '../../options/output/FrameRateOutputOption.ts';

export class QsvPipelineBuilder extends SoftwarePipelineBuilder {
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

    const { videoStream, desiredState } = this.context;

    let canDecode = this.context.pipelineOptions?.disableHardwareDecoding
      ? false
      : this.hardwareCapabilities.canDecodeVideoStream(videoStream);
    let canEncode = this.context.pipelineOptions?.disableHardwareEncoding
      ? false
      : this.hardwareCapabilities.canEncodeState(desiredState);

    if (
      canEncode &&
      this.ffmpegState.outputFormat.type === OutputFormatTypes.Nut
    ) {
      canEncode = false;
    }

    if (
      canDecode &&
      (this.context.videoStream.codec === VideoFormats.H264 ||
        this.context.videoStream.codec === VideoFormats.Hevc) &&
      this.context.videoStream.pixelFormat?.bitDepth === 10
    ) {
      canDecode = false;
    }

    this.ffmpegState.decoderHwAccelMode = canDecode
      ? HardwareAccelerationMode.Qsv
      : HardwareAccelerationMode.None;

    this.pipelineSteps.push(
      new QsvHardwareAccelerationOption(
        this.ffmpegState.vaapiDevice,
        this.ffmpegState.decoderHwAccelMode,
      ),
    );

    this.ffmpegState.encoderHwAccelMode = canEncode
      ? HardwareAccelerationMode.Qsv
      : HardwareAccelerationMode.None;
  }

  protected setupDecoder(): Nullable<Decoder> {
    if (!isVideoPipelineContext(this.context)) {
      return null;
    }

    const { ffmpegState, videoStream } = this.context;
    let decoder: Nullable<Decoder> = null;

    if (ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Qsv) {
      decoder = DecoderFactory.getQsvDecoder(
        videoStream,
        this.hardwareCapabilities,
      );
      if (!isNull(decoder)) {
        this.videoInputSource.addOption(decoder);
      }
    } else {
      decoder = super.setupDecoder();
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
      ffmpegState,
      pipelineSteps,
      filterChain,
    } = this.context;

    let currentState = desiredState.update({
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
    });

    if (this.decoder) {
      currentState = this.decoder.nextState(currentState);
    }

    currentState = this.addFilterToVideoChain(
      currentState,
      new ResetPtsFilter(),
    );

    const setFrameRate =
      this.context?.videoStream.getNumericFrameRateOrDefault() ?? 24;
    currentState = this.addFilterToVideoChain(
      currentState,
      new SetFpsFilter(setFrameRate),
    );

    // Remove existing frame rate output option if the framerate we just
    // set differs from the
    if (
      this.desiredState.frameRate &&
      this.desiredState.frameRate !== setFrameRate
    ) {
      const idx = this.pipelineSteps.findIndex(
        (step) => step instanceof FrameRateOutputOption,
      );
      if (idx !== -1) {
        this.pipelineSteps.splice(idx, 1);
      }
    }

    currentState = this.setDeinterlace(currentState);
    currentState = this.setScale(currentState);
    currentState = this.setPad(currentState);
    this.setStillImageLoop();

    if (
      currentState.frameDataLocation === FrameDataLocation.Hardware &&
      this.context.hasWatermark
    ) {
      const hwDownload = new HardwareDownloadFilter(currentState);
      currentState = hwDownload.nextState(currentState);
      this.videoInputSource.filterSteps.push(hwDownload);
    }

    this.setWatermark(currentState);

    const noEncoderSteps = every(
      this.getEncoderSteps(),
      (encoder) => encoder.kind !== 'video',
    );

    if (noEncoderSteps) {
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
      } else {
        encoder = super.setupEncoder(currentState);
      }

      if (encoder) {
        pipelineSteps.push(encoder);
        this.videoInputSource.filterSteps.push(encoder);
      }
    }

    currentState = this.setPixelFormat(currentState);

    filterChain.videoFilterSteps.push(...this.videoInputSource.filterSteps);
  }

  protected setDeinterlace(currentState: FrameState): FrameState {
    let nextState = currentState;
    if (this.context.shouldDeinterlace) {
      const filter =
        currentState.frameDataLocation === FrameDataLocation.Software
          ? new DeinterlaceFilter(this.ffmpegState, currentState)
          : new DeinterlaceQsvFilter(currentState);
      nextState = filter.nextState(nextState);
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
      ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.None &&
      ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None;
    const onlySoftwareFilters =
      currentState.frameDataLocation === FrameDataLocation.Software &&
      !desiredState.scaledSize.equals(desiredState.paddedSize);

    let scaleFilter: FilterOption;
    if (
      this.context.pipelineOptions.disableHardwareFilters ||
      (needsScale && (noHardware || onlySoftwareFilters))
    ) {
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
      nextState = scaleFilter.nextState(nextState);
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
      const pad = PadFilter.create(currentState, desiredState);
      currentState = pad.nextState(currentState);
      this.videoInputSource.filterSteps.push(pad);
    }

    return currentState;
  }

  protected setPixelFormat(currentState: FrameState): FrameState {
    const steps: FilterOption[] = [];

    if (this.desiredState.pixelFormat) {
      let pixelFormat = this.desiredState.pixelFormat;
      if (this.desiredState.pixelFormat.name === PixelFormats.NV12) {
        pixelFormat = this.desiredState.pixelFormat.unwrap();
      }

      let pixelFormatToDownload = pixelFormat;

      let hasQsvFilter = some(
        this.videoInputSource.filterSteps,
        (step) =>
          step instanceof ScaleQsvFilter ||
          step instanceof DeinterlaceQsvFilter,
      );

      const currentPixelFormat = currentState.pixelFormat;

      if (
        some(
          this.videoInputSource.filterSteps,
          (step) => !(step instanceof Encoder),
        ) &&
        currentPixelFormat
      ) {
        let needsConversion = false;
        if (currentPixelFormat.name === PixelFormats.NV12) {
          needsConversion =
            currentPixelFormat.unwrap().name !== pixelFormat.name;
          if (!needsConversion) {
            currentState = currentState.update({ pixelFormat });
          }
        } else {
          needsConversion = currentPixelFormat.name !== pixelFormat.name;
        }

        if (needsConversion) {
          const filter = new QsvFormatFilter(currentPixelFormat);
          steps.push(filter);
          currentState = filter.nextState(currentState);

          if (currentPixelFormat.bitDepth === 8 && this.context.is10BitOutput) {
            const tenbitFilter = new QsvFormatFilter(new PixelFormatP010());
            steps.push(tenbitFilter);
            currentState = tenbitFilter.nextState(currentState);
          }

          hasQsvFilter = true;
        }
      }

      if (hasQsvFilter) {
        if (currentState.frameDataLocation === FrameDataLocation.Hardware) {
          if (
            currentState.pixelFormat?.bitDepth === 10 &&
            pixelFormatToDownload?.name !== PixelFormats.YUV420P10LE
          ) {
            pixelFormatToDownload = new PixelFormatYuv420P10Le();
            currentState = currentState.update({
              pixelFormat: pixelFormatToDownload,
            });
          } else if (
            currentState.pixelFormat?.bitDepth === 8 &&
            pixelFormatToDownload?.name !== PixelFormats.NV12
          ) {
            pixelFormatToDownload = new PixelFormatNv12(pixelFormatToDownload);
            currentState = currentState.update({
              pixelFormat: pixelFormatToDownload,
            });
          }
        }
      }

      if (
        this.ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.None &&
        currentState.frameDataLocation === FrameDataLocation.Hardware
      ) {
        pixelFormatToDownload = new PixelFormatNv12(pixelFormatToDownload);
        const hwDownloadFilter = new HardwareDownloadFilter(
          currentState.update({ pixelFormat: pixelFormatToDownload }),
        );
        currentState = hwDownloadFilter.nextState(currentState);
        steps.push(hwDownloadFilter);
      }

      if (currentState.pixelFormat?.name !== pixelFormat.name) {
        // TODO: Handle color params
        this.pipelineSteps.push(new PixelFormatOutputOption(pixelFormat));
      }

      // if (this.ffmpegState.outputFormat.type === OutputFormatTypes.Nut) {
      // }

      this.context.filterChain.pixelFormatFilterSteps = steps;
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
      const fmt = new PixelFormatYuva420P();
      this.subtitleInputSource.filterSteps.push(new PixelFormatFilter(fmt));
      const desiredPixelFmt = this.desiredState.pixelFormat?.unwrap();

      if (desiredPixelFmt) {
        const needsScale = this.videoInputSource.hasAnyFilterStep([
          ScaleQsvFilter,
          ScaleFilter,
          PadFilter,
        ]);

        if (needsScale) {
          this.subtitleInputSource.addFilter(
            new ImageScaleFilter(this.desiredState.paddedSize),
          );
        }

        this.subtitleOverlayFilterChain.push(
          new SubtitleOverlayFilter(desiredPixelFmt),
        );

        if (
          this.videoInputSource.streams.some((s) => s.codec === 'vp9') &&
          this.context.is10BitOutput
        ) {
          this.subtitleOverlayFilterChain.push(
            new PixelFormatFilter(new PixelFormatYuv420P10Le()),
          );
        }
      }
    }

    return currentState;
  }

  protected getIsIntelQsvOrVaapi(): boolean {
    return (
      this.ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Qsv ||
      this.ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.Qsv
    );
  }
}
