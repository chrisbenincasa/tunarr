import { OutputFormatTypes, VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { Decoder } from '@/ffmpeg/builder/decoder/Decoder.ts';
import { DecoderFactory } from '@/ffmpeg/builder/decoder/DecoderFactory.ts';
import { Encoder } from '@/ffmpeg/builder/encoder/Encoder.ts';
import { DeinterlaceFilter } from '@/ffmpeg/builder/filter/DeinterlaceFilter.ts';
import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { ScaleFilter } from '@/ffmpeg/builder/filter/ScaleFilter.ts';
import { DeinterlaceQsvFilter } from '@/ffmpeg/builder/filter/qsv/DeinterlaceQsvFilter.ts';
import { ScaleQsvFilter } from '@/ffmpeg/builder/filter/qsv/ScaleQsvFilter.ts';
import { QsvHardwareAccelerationOption } from '@/ffmpeg/builder/options/hardwareAcceleration/QsvOptions.ts';
import { isVideoPipelineContext } from '@/ffmpeg/builder/pipeline/BasePipelineBuilder.ts';
import { SoftwarePipelineBuilder } from '@/ffmpeg/builder/pipeline/software/SoftwarePipelineBuilder.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import {
  FrameDataLocation,
  HardwareAccelerationMode,
} from '@/ffmpeg/builder/types.ts';
import { Nullable } from '@/types/util.ts';
import { isNonEmptyString } from '@/util/index.ts';
import { isNull, some } from 'lodash-es';
import { BaseFfmpegHardwareCapabilities } from '../../capabilities/BaseFfmpegHardwareCapabilities.ts';
import { FfmpegCapabilities } from '../../capabilities/FfmpegCapabilities.ts';
import { BaseEncoder } from '../../encoder/BaseEncoder.ts';
import {
  H264QsvEncoder,
  HevcQsvEncoder,
  Mpeg2QsvEncoder,
} from '../../encoder/qsv/QsvEncoders.ts';
import { HardwareDownloadFilter } from '../../filter/HardwareDownloadFilter.ts';
import {
  FfmpegPixelFormats,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../../format/PixelFormat.ts';
import { AudioInputSource } from '../../input/AudioInputSource.ts';
import { ConcatInputSource } from '../../input/ConcatInputSource.ts';
import { VideoInputSource } from '../../input/VideoInputSource.ts';
import { WatermarkInputSource } from '../../input/WatermarkInputSource.ts';

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

    let canDecode = this.hardwareCapabilities.canDecodeVideoStream(
      this.context.videoStream,
    );
    let canEncode = this.hardwareCapabilities.canEncodeState(this.desiredState);

    if (this.ffmpegState.outputFormat.type === OutputFormatTypes.Nut) {
      canEncode = false;
    }

    this.pipelineSteps.push(
      new QsvHardwareAccelerationOption(this.ffmpegState.vaapiDevice),
    );

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
      pixelFormat:
        this.ffmpegState.decoderHwAccelMode === HardwareAccelerationMode.Qsv
          ? videoStream.pixelFormat?.bitDepth === 8
            ? videoStream.pixelFormat.wrap(FfmpegPixelFormats.NV12)
            : videoStream.pixelFormat
          : videoStream.pixelFormat,
    });

    if (decoder?.affectsFrameState) {
      currentState = decoder.nextState(currentState);
    }

    if (this.context.hasWatermark || this.context.hasSubtitleOverlay) {
      const newPixelFormat =
        this.desiredState.pixelFormat ??
        (this.context.is10BitOutput
          ? new PixelFormatYuv420P10Le()
          : new PixelFormatYuv420P());
      desiredState.pixelFormat = this.context.is10BitOutput
        ? newPixelFormat
        : newPixelFormat.wrap(FfmpegPixelFormats.NV12);
    }

    currentState = this.setDeinterlace(currentState);
    currentState = this.setScale(currentState);
    currentState = this.setPad(currentState);
    this.setStillImageLoop();

    if (
      currentState.frameDataLocation === FrameDataLocation.Hardware &&
      (this.context.hasWatermark || this.context.hasSubtitleOverlay)
    ) {
      const hwDownload = new HardwareDownloadFilter(currentState);
      currentState = hwDownload.nextState(currentState);
      this.videoInputSource.filterSteps.push(hwDownload);
    }

    currentState = this.setWatermark(currentState);

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

    this.setPixelFormat(currentState);

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

  protected setPixelFormat(currentState: FrameState): FrameState {
    const steps = [];

    if (!this.desiredState.pixelFormat) {
      return currentState;
    }

    const pixelFormat = this.desiredState.pixelFormat.unwrap();

    // VPP

    const hasFilters = some(
      this.videoInputSource.filterSteps,
      (step) => !(step instanceof BaseEncoder),
    );

    if (hasFilters && currentState.pixelFormat) {
      let needsConversion = false;
      if (currentState.pixelFormat.ffmpegName === FfmpegPixelFormats.NV12) {
        const unwrapped = currentState.pixelFormat.unwrap();
        if (unwrapped) {
          needsConversion =
            currentState.pixelFormat.ffmpegName !== unwrapped.ffmpegName;
          if (!needsConversion) {
            currentState = currentState.update({
              pixelFormat: currentState.pixelFormat,
            });
          }
        }
      } else {
        needsConversion =
          currentState.pixelFormat.ffmpegName !== pixelFormat?.ffmpegName;
      }

      if (
        needsConversion &&
        currentState.frameDataLocation === FrameDataLocation.Hardware
      ) {
        const filter = new QsvFormatFilter();
        steps.push(filter);
        currentState = filter.nextState(currentState);
      }
    }
  }
}
