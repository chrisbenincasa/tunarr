import { match } from 'ts-pattern';
import { Nullable } from '../../../../types/util.ts';
import { BaseFfmpegHardwareCapabilities } from '../../capabilities/BaseFfmpegHardwareCapabilities.ts';
import { FfmpegCapabilities } from '../../capabilities/FfmpegCapabilities.ts';
import { VideoFormats } from '../../constants.ts';
import { Decoder } from '../../decoder/Decoder.ts';
import { VideoToolboxDecoder } from '../../decoder/videotoolbox/VideoToolboxDecoder.ts';
import {
  VideoToolboxH264Encoder,
  VideoToolboxHevcEncoder,
} from '../../encoder/videotoolbox/VideoToolboxEncoders.ts';
import { FilterOption } from '../../filter/FilterOption.ts';
import { VideoToolboxHardwareAccelerationOption } from '../../filter/videotoolbox/VideoToolboxHardwareAccelerationOption.ts';
import { AudioInputSource } from '../../input/AudioInputSource.ts';
import { ConcatInputSource } from '../../input/ConcatInputSource.ts';
import { VideoInputSource } from '../../input/VideoInputSource.ts';
import { WatermarkInputSource } from '../../input/WatermarkInputSource.ts';
import { PixelFormatOutputOption } from '../../options/OutputOption.ts';
import { FrameState } from '../../state/FrameState.ts';
import { HardwareAccelerationMode } from '../../types.ts';
import { isVideoPipelineContext } from '../BasePipelineBuilder.ts';
import { SoftwarePipelineBuilder } from '../software/SoftwarePipelineBuilder.ts';

export class VideoToolboxPipelineBuilder extends SoftwarePipelineBuilder {
  constructor(
    private hardwareCapabilities: BaseFfmpegHardwareCapabilities,
    binaryCapabilities: FfmpegCapabilities,
    videoInputFile: VideoInputSource,
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
      if (
        currentState.pixelFormat?.ffmpegName !==
        this.desiredState.pixelFormat.ffmpegName
      ) {
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
