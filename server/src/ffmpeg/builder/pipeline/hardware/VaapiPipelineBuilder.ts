import { BaseFfmpegHardwareCapabilities } from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.ts';
import { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.ts';
import { OutputFormatTypes, VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { Decoder } from '@/ffmpeg/builder/decoder/Decoder.ts';
import { VaapiDecoder } from '@/ffmpeg/builder/decoder/vaapi/VaapiDecoder.ts';
import { Encoder } from '@/ffmpeg/builder/encoder/Encoder.ts';
import { DeinterlaceFilter } from '@/ffmpeg/builder/filter/DeinterlaceFilter.ts';
import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { HardwareDownloadFilter } from '@/ffmpeg/builder/filter/HardwareDownloadFilter.ts';
import { PadFilter } from '@/ffmpeg/builder/filter/PadFilter.ts';
import { PixelFormatFilter } from '@/ffmpeg/builder/filter/PixelFormatFilter.ts';
import { ScaleFilter } from '@/ffmpeg/builder/filter/ScaleFilter.ts';
import { DeinterlaceVaapiFilter } from '@/ffmpeg/builder/filter/vaapi/DeinterlaceVaapiFilter.ts';
import { HardwareUploadVaapiFilter } from '@/ffmpeg/builder/filter/vaapi/HardwareUploadVaapiFilter.ts';
import { ScaleVaapiFilter } from '@/ffmpeg/builder/filter/vaapi/ScaleVaapiFilter.ts';
import { VaapiFormatFilter } from '@/ffmpeg/builder/filter/vaapi/VaapiFormatFilter.ts';
import { OverlayWatermarkFilter } from '@/ffmpeg/builder/filter/watermark/OverlayWatermarkFilter.ts';
import { WatermarkOpacityFilter } from '@/ffmpeg/builder/filter/watermark/WatermarkOpacityFilter.ts';
import { WatermarkScaleFilter } from '@/ffmpeg/builder/filter/watermark/WatermarkScaleFilter.ts';
import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.ts';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.ts';
import { VaapiDriverEnvironmentVariable } from '@/ffmpeg/builder/options/EnvironmentVariables.ts';
import { VaapiHardwareAccelerationOption } from '@/ffmpeg/builder/options/hardwareAcceleration/VaapiOptions.ts';
import { DoNotIgnoreLoopInputOption } from '@/ffmpeg/builder/options/input/DoNotIgnoreLoopInputOption.ts';
import { InfiniteLoopInputOption } from '@/ffmpeg/builder/options/input/InfiniteLoopInputOption.ts';
import { isVideoPipelineContext } from '@/ffmpeg/builder/pipeline/BasePipelineBuilder.ts';
import { SoftwarePipelineBuilder } from '@/ffmpeg/builder/pipeline/software/SoftwarePipelineBuilder.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { Nullable } from '@/types/util.ts';
import { isDefined, isNonEmptyString } from '@/util/index.ts';
import { every, filter, head, inRange, isUndefined } from 'lodash-es';
import { P, match } from 'ts-pattern';
import {
  H264VaapiEncoder,
  HevcVaapiEncoder,
  Mpeg2VaapiEncoder,
} from '../../encoder/vaapi/VaapiEncoders.ts';
import {
  FfmpegPixelFormats,
  KnownPixelFormats,
  PixelFormatNv12,
  PixelFormatYuva420P,
  PixelFormats,
} from '../../format/PixelFormat.ts';
import {
  NoAutoScaleOutputOption,
  PixelFormatOutputOption,
} from '../../options/OutputOption.ts';
import {
  FrameDataLocation,
  HardwareAccelerationMode,
  RateControlMode,
} from '../../types.ts';

export class VaapiPipelineBuilder extends SoftwarePipelineBuilder {
  constructor(
    private hardwareCapabilities: BaseFfmpegHardwareCapabilities,
    binaryCapabilities: FfmpegCapabilities,
    videoInputFile: Nullable<VideoInputSource>,
    audioInputFile: Nullable<AudioInputSource>,
    watermarkInputSource: Nullable<WatermarkInputSource>,
    concatInputSource: Nullable<ConcatInputSource>,
  ) {
    super(
      videoInputFile,
      audioInputFile,
      watermarkInputSource,
      concatInputSource,
      binaryCapabilities,
    );
  }

  protected override setHardwareAccelState(): void {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    const { videoStream, desiredState, ffmpegState } = this.context;

    const canDecode =
      this.hardwareCapabilities.canDecodeVideoStream(videoStream);
    let canEncode = this.hardwareCapabilities.canEncodeState(desiredState);

    if (ffmpegState.outputFormat.type === OutputFormatTypes.Nut) {
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

    this.context.decoder = decoder;

    return decoder;
  }

  protected setupVideoFilters(): void {
    if (!isVideoPipelineContext(this.context)) {
      return;
    }

    const { desiredState, videoStream, ffmpegState, pipelineSteps, decoder } =
      this.context;

    let currentState = desiredState.update({
      isAnamorphic: videoStream.isAnamorphic,
      scaledSize: videoStream.frameSize,
      paddedSize: videoStream.frameSize,
      pixelFormat: videoStream.pixelFormat,
    });

    currentState = decoder?.nextState(currentState) ?? currentState;

    currentState = this.setDeinterlace(currentState);
    currentState = this.setScale(currentState);
    currentState = this.setPad(currentState);
    this.setStillImageLoop();
    // Set crop

    // TODO: Make vaapi driver a union
    const forceSoftwareOverlay =
      (this.context.hasWatermark && this.context.hasSubtitleOverlay) ||
      ffmpegState.vaapiDriver === 'radeonsi';
    if (
      currentState.frameDataLocation === FrameDataLocation.Software &&
      this.context.hasSubtitleOverlay &&
      !forceSoftwareOverlay
    ) {
      // Hardware upload
    } else if (
      currentState.frameDataLocation === FrameDataLocation.Hardware &&
      (!this.context.hasSubtitleOverlay || forceSoftwareOverlay) &&
      this.context.hasWatermark
    ) {
      // download for watermark (or forced software subtitle)
      const filter = new HardwareDownloadFilter(currentState);
      currentState = filter.nextState(currentState);
      this.videoInputSource.filterSteps.push(filter);
    }

    // TODO Subtitle

    // Watermark
    this.setWatermark(currentState);

    const noEncoderSteps = every(
      filter(
        this.pipelineSteps,
        (step): step is Encoder => step instanceof Encoder,
      ),
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
      const format = this.desiredState.pixelFormat;
      if (format.ffmpegName === FfmpegPixelFormats.NV12) {
        const mappedFormat = KnownPixelFormats.forPixelFormat(format.name);
        if (mappedFormat) {
          pixelFormat = mappedFormat;
        }
      }

      // Color params

      if (this.ffmpegState.encoderHwAccelMode === 'none') {
        // Software encoder
        if (currentState.frameDataLocation === 'hardware') {
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

      if (currentState.pixelFormat?.ffmpegName !== pixelFormat.ffmpegName) {
        // Pixel formats

        if (
          pixelFormat.name === PixelFormats.YUV420P &&
          this.ffmpegState.outputFormat.type !== OutputFormatTypes.Nut
        ) {
          pixelFormat = new PixelFormatNv12(pixelFormat.name);
        }

        if (currentState.frameDataLocation === 'hardware') {
          steps.push(new VaapiFormatFilter(pixelFormat));
        } else {
          if (this.ffmpegState.encoderHwAccelMode === 'vaapi') {
            steps.push(new PixelFormatFilter(pixelFormat));
          } else {
            this.pipelineSteps.push(new PixelFormatOutputOption(pixelFormat));
          }
        }
      }

      if (
        this.ffmpegState.encoderHwAccelMode ===
          HardwareAccelerationMode.Vaapi &&
        currentState.frameDataLocation === FrameDataLocation.Software
      ) {
        // Figure this out... it consistently sets false and doesn't work
        // const setFormat = every(
        //   steps,
        //   (step) =>
        //     !(step instanceof VaapiFormatFilter) &&
        //     !(step instanceof PixelFormatFilter),
        // );
        steps.push(new HardwareUploadVaapiFilter(true, 64));
      }
    }

    this.context.filterChain.pixelFormatFilterSteps = steps;

    return currentState;
  }

  protected setDeinterlace(currentState: FrameState): FrameState {
    let nextState = currentState;
    if (this.context.shouldDeinterlace) {
      const filter =
        this.context.ffmpegState.decoderHwAccelMode === 'vaapi'
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
    // TODO: Watermark, subtitles, interface
    let scaleOption: FilterOption;
    if (
      !currentState.scaledSize.equals(desiredState.scaledSize) &&
      ((ffmpegState.decoderHwAccelMode === 'none' &&
        ffmpegState.encoderHwAccelMode === 'none' &&
        !shouldDeinterlace) ||
        ffmpegState.decoderHwAccelMode !== 'vaapi')
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
            ffmpegState.decoderHwAccelMode === 'cuda' &&
            ffmpegState.encoderHwAccelMode === 'none'
              ? desiredState.pixelFormat
                ? new PixelFormatNv12(desiredState.pixelFormat.name)
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
      const padFilter = new PadFilter(currentState, this.desiredState);
      nextState = padFilter.nextState(currentState);
      this.videoInputSource.filterSteps.push(padFilter);
    }
    return nextState;
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
        new WatermarkOpacityFilter(watermarkInput.watermark),
      );
    }

    watermarkInput.filterSteps.push(
      new PixelFormatFilter(new PixelFormatYuva420P()),
    );

    const fadeConfig = head(watermarkInput.watermark.fadeConfig);
    if (isDefined(fadeConfig)) {
      // Fades
    }

    if (this.desiredState.pixelFormat) {
      let pf = this.desiredState.pixelFormat;
      if (pf.ffmpegName === FfmpegPixelFormats.NV12) {
        const availableFmt = KnownPixelFormats.forPixelFormat(pf.name);
        if (availableFmt) {
          pf = availableFmt;
        }
      }

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
}

type P = ConstructorParameters<typeof HardwareDownloadFilter>;
