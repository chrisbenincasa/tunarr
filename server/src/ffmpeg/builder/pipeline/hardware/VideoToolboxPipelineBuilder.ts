import { BaseFfmpegHardwareCapabilities } from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.ts';
import { FfmpegCapabilities } from '@/ffmpeg/builder/capabilities/FfmpegCapabilities.ts';
import { VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { Decoder } from '@/ffmpeg/builder/decoder/Decoder.ts';
import { VideoToolboxDecoder } from '@/ffmpeg/builder/decoder/videotoolbox/VideoToolboxDecoder.ts';
import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import { VideoToolboxHardwareAccelerationOption } from '@/ffmpeg/builder/filter/videotoolbox/VideoToolboxHardwareAccelerationOption.ts';
import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.ts';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.ts';
import { PixelFormatOutputOption } from '@/ffmpeg/builder/options/OutputOption.ts';
import { isVideoPipelineContext } from '@/ffmpeg/builder/pipeline/BasePipelineBuilder.ts';
import { SoftwarePipelineBuilder } from '@/ffmpeg/builder/pipeline/software/SoftwarePipelineBuilder.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { HardwareAccelerationMode } from '@/ffmpeg/builder/types.ts';
import { Nullable } from '@/types/util.ts';
import { match } from 'ts-pattern';
import {
  VideoToolboxH264Encoder,
  VideoToolboxHevcEncoder,
} from '../../encoder/videotoolbox/VideoToolboxEncoders.ts';

export class VideoToolboxPipelineBuilder extends SoftwarePipelineBuilder {
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

    const canDecode = this.hardwareCapabilities.canDecodeVideoStream(
      this.context.videoStream,
    );
    const canEncode = this.hardwareCapabilities.canEncodeState(
      this.desiredState,
    );

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
