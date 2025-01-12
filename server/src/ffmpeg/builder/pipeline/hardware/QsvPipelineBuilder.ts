import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.ts';
import { BaseFfmpegHardwareCapabilities } from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.ts';
import { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.ts';
import { OutputFormatTypes, VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { Decoder } from '@/ffmpeg/builder/decoder/Decoder.ts';
import { DecoderFactory } from '@/ffmpeg/builder/decoder/DecoderFactory.ts';
import { Encoder } from '@/ffmpeg/builder/encoder/Encoder.ts';
import { DeinterlaceFilter } from '@/ffmpeg/builder/filter/DeinterlaceFilter.ts';
import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { HardwareDownloadFilter } from '@/ffmpeg/builder/filter/HardwareDownloadFilter.ts';
import { PadFilter } from '@/ffmpeg/builder/filter/PadFilter.ts';
import { PixelFormatFilter } from '@/ffmpeg/builder/filter/PixelFormatFilter.ts';
import { ScaleFilter } from '@/ffmpeg/builder/filter/ScaleFilter.ts';
import { DeinterlaceQsvFilter } from '@/ffmpeg/builder/filter/qsv/DeinterlaceQsvFilter.ts';
import { QsvFormatFilter } from '@/ffmpeg/builder/filter/qsv/QsvFormatFilter.ts';
import { ScaleQsvFilter } from '@/ffmpeg/builder/filter/qsv/ScaleQsvFilter.ts';
import { OverlayWatermarkFilter } from '@/ffmpeg/builder/filter/watermark/OverlayWatermarkFilter.ts';
import { WatermarkOpacityFilter } from '@/ffmpeg/builder/filter/watermark/WatermarkOpacityFilter.ts';
import { WatermarkScaleFilter } from '@/ffmpeg/builder/filter/watermark/WatermarkScaleFilter.ts';
import {
  PixelFormatNv12,
  PixelFormatP010,
  PixelFormatYuv420P10Le,
  PixelFormatYuva420P,
  PixelFormats,
} from '@/ffmpeg/builder/format/PixelFormat.ts';
import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.ts';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.ts';
import { PixelFormatOutputOption } from '@/ffmpeg/builder/options/OutputOption.ts';
import { QsvHardwareAccelerationOption } from '@/ffmpeg/builder/options/hardwareAcceleration/QsvOptions.ts';
import { DoNotIgnoreLoopInputOption } from '@/ffmpeg/builder/options/input/DoNotIgnoreLoopInputOption.ts';
import { InfiniteLoopInputOption } from '@/ffmpeg/builder/options/input/InfiniteLoopInputOption.ts';
import { isVideoPipelineContext } from '@/ffmpeg/builder/pipeline/BasePipelineBuilder.ts';
import { SoftwarePipelineBuilder } from '@/ffmpeg/builder/pipeline/software/SoftwarePipelineBuilder.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { FrameDataLocation } from '@/ffmpeg/builder/types.ts';
import { Nullable } from '@/types/util.ts';
import { isDefined, isNonEmptyString } from '@/util/index.ts';
import { every, head, inRange, isNull, some } from 'lodash-es';
import { H264QsvEncoder } from '../../encoder/qsv/H264QsvEncoder.ts';
import { HevcQsvEncoder } from '../../encoder/qsv/HevcQsvEncoder.ts';
import { Mpeg2QsvEncoder } from '../../encoder/qsv/Mpeg2QsvEncoder.ts';

export class QsvPipelineBuilder extends SoftwarePipelineBuilder {
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

    const { videoStream, desiredState } = this.context;

    let canDecode = this.hardwareCapabilities.canDecodeVideoStream(videoStream);
    let canEncode = this.hardwareCapabilities.canEncodeState(desiredState);

    this.pipelineSteps.push(
      new QsvHardwareAccelerationOption(this.ffmpegState.vaapiDevice),
    );

    if (this.ffmpegState.outputFormat.type === OutputFormatTypes.Nut) {
      canEncode = false;
    }

    if (
      (this.context.videoStream.codec === VideoFormats.H264 ||
        this.context.videoStream.codec === VideoFormats.Hevc) &&
      this.context.videoStream.pixelFormat?.bitDepth === 10
    ) {
      canDecode = false;
    }

    this.ffmpegState.decoderHwAccelMode = canDecode
      ? HardwareAccelerationMode.Qsv
      : HardwareAccelerationMode.None;
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
      decoder = DecoderFactory.getQsvDecoder(videoStream);
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
      const pad = new PadFilter(currentState, desiredState);
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

  protected getIsIntelQsvOrVaapi(): boolean {
    return (
      this.ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Qsv ||
      this.ffmpegState.encoderHwAccelMode === HardwareAccelerationMode.Qsv
    );
  }
}
