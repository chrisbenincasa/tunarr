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
import { ScaleFilter } from '@/ffmpeg/builder/filter/ScaleFilter.ts';
import { DeinterlaceQsvFilter } from '@/ffmpeg/builder/filter/qsv/DeinterlaceQsvFilter.ts';
import { QsvFormatFilter } from '@/ffmpeg/builder/filter/qsv/QsvFormatFilter.ts';
import { ScaleQsvFilter } from '@/ffmpeg/builder/filter/qsv/ScaleQsvFilter.ts';
import {
  KnownPixelFormats,
  PixelFormatNv12,
  PixelFormatP010,
  PixelFormatYuv420P10Le,
  PixelFormats,
} from '@/ffmpeg/builder/format/PixelFormat.ts';
import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.ts';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.ts';
import { PixelFormatOutputOption } from '@/ffmpeg/builder/options/OutputOption.ts';
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
import { every, isNull, some } from 'lodash-es';
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
      decoder,
      ffmpegState,
      pipelineSteps,
      filterChain,
    } = this.context;

    let currentState = desiredState.update({
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
    });

    if (decoder?.affectsFrameState) {
      currentState = decoder.nextState(currentState);
    }

    currentState = this.setDeinterlace(currentState);
    currentState = this.setScale(currentState);
    currentState = this.setPad(currentState);
    this.setStillImageLoop();

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
      }

      if (!isNull(encoder)) {
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
      if (this.desiredState.pixelFormat instanceof PixelFormatNv12) {
        const mappedFormat = KnownPixelFormats.forPixelFormat(
          this.desiredState.pixelFormat.name,
        );
        if (mappedFormat) {
          pixelFormat = mappedFormat;
        }
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
}
