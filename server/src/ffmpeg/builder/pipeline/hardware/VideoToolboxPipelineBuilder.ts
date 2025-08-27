import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import type { BaseFfmpegHardwareCapabilities } from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.js';
import type { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.js';
import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import type { Decoder } from '@/ffmpeg/builder/decoder/Decoder.js';
import { VideoToolboxDecoder } from '@/ffmpeg/builder/decoder/videotoolbox/VideoToolboxDecoder.js';
import type { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import { VideoToolboxHardwareAccelerationOption } from '@/ffmpeg/builder/filter/videotoolbox/VideoToolboxHardwareAccelerationOption.js';
import type { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.js';
import type { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import type { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.js';
import type { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.js';
import { PixelFormatOutputOption } from '@/ffmpeg/builder/options/OutputOption.js';
import { isVideoPipelineContext } from '@/ffmpeg/builder/pipeline/BasePipelineBuilder.js';
import { SoftwarePipelineBuilder } from '@/ffmpeg/builder/pipeline/software/SoftwarePipelineBuilder.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Nullable } from '@/types/util.js';
import { match } from 'ts-pattern';
import {
  VideoToolboxH264Encoder,
  VideoToolboxHevcEncoder,
} from '../../encoder/videotoolbox/VideoToolboxEncoders.ts';
import type { SubtitlesInputSource } from '../../input/SubtitlesInputSource.ts';

export class VideoToolboxPipelineBuilder extends SoftwarePipelineBuilder {
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

    const canDecode = this.context.pipelineOptions?.disableHardwareDecoding
      ? false
      : this.hardwareCapabilities.canDecodeVideoStream(
          this.context.videoStream,
        );
    const canEncode = this.context.pipelineOptions?.disableHardwareEncoding
      ? false
      : this.hardwareCapabilities.canEncodeState(this.desiredState);

    this.pipelineSteps.push(new VideoToolboxHardwareAccelerationOption());

    this.ffmpegState.decoderHwAccelMode = canDecode
      ? HardwareAccelerationMode.Videotoolbox
      : HardwareAccelerationMode.None;
    this.ffmpegState.encoderHwAccelMode = canEncode
      ? HardwareAccelerationMode.Videotoolbox
      : HardwareAccelerationMode.None;
  }

  protected setupDecoder(): Nullable<Decoder> {
    if (!isVideoPipelineContext(this.context)) {
      return null;
    }

    let decoder: Nullable<Decoder>;
    if (
      this.ffmpegState.decoderHwAccelMode ===
      HardwareAccelerationMode.Videotoolbox
    ) {
      decoder = this.decoder = new VideoToolboxDecoder();
      this.videoInputSource.addOption(decoder);
    } else {
      decoder = super.setupDecoder();
    }

    return decoder;
  }

  protected setupEncoder(currentState: FrameState) {
    if (!isVideoPipelineContext(this.context)) {
      return null;
    }

    return match([
      this.ffmpegState.encoderHwAccelMode,
      this.desiredState.videoFormat,
    ])
      .with(
        [HardwareAccelerationMode.Videotoolbox, VideoFormats.Hevc],
        () => new VideoToolboxHevcEncoder(this.desiredState.bitDepth),
      )
      .with(
        [HardwareAccelerationMode.Videotoolbox, VideoFormats.H264],
        () => new VideoToolboxH264Encoder(this.desiredState.videoProfile),
      )
      .otherwise(() => super.setupEncoder(currentState));
  }

  protected setPixelFormat(currentState: FrameState) {
    const steps: FilterOption[] = [];
    if (this.desiredState.pixelFormat) {
      if (!currentState.pixelFormat?.equals(this.desiredState.pixelFormat)) {
        // This is commented out in ETV code...
      }

      const opt = new PixelFormatOutputOption(this.desiredState.pixelFormat);
      currentState = opt.nextState(currentState);
      this.pipelineSteps.push(opt);
    }

    this.context.filterChain.pixelFormatFilterSteps.push(...steps);

    return currentState;
  }
}
