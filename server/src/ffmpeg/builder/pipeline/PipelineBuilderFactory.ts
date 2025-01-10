import {
  ISettingsDB,
  ReadableFfmpegSettings,
} from '@/db/interfaces/ISettingsDB.js';
import {
  HardwareAccelerationMode,
  TranscodeConfig,
} from '@/db/schema/TranscodeConfig.js';
import { HardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/HardwareCapabilitiesFactory.js';
import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.js';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.js';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.js';
import { FfmpegInfo } from '@/ffmpeg/ffmpegInfo.js';
import { Nullable } from '@/types/util.js';
import { ContainerModule } from 'inversify';
import { isUndefined } from 'lodash-es';
import { KEYS } from '../../../types/inject.ts';
import { bindFactoryFunc } from '../../../util/inject.ts';
import { PipelineBuilder } from './PipelineBuilder.js';
import { NvidiaPipelineBuilder } from './hardware/NvidiaPipelineBuilder.ts';
import { QsvPipelineBuilder } from './hardware/QsvPipelineBuilder.ts';
import { VaapiPipelineBuilder } from './hardware/VaapiPipelineBuilder.ts';
import { VideoToolboxPipelineBuilder } from './hardware/VideoToolboxPipelineBuilder.ts';
import { SoftwarePipelineBuilder } from './software/SoftwarePipelineBuilder.ts';

export type PipelineBuilderFactory = (
  transcodeConfig: TranscodeConfig,
) => PipelineBuilderFactory$Builder;

export const FfmpegPipelineBuilderModule = new ContainerModule((bind) => {
  bindFactoryFunc<PipelineBuilderFactory>(
    bind,
    KEYS.PipelineBuilderFactory,
    (ctx) => {
      const settingsDB = ctx.container.get<ISettingsDB>(KEYS.SettingsDB);
      const ffmpegInfo = ctx.container.get(FfmpegInfo);
      return (config) =>
        new PipelineBuilderFactory$Builder(
          settingsDB.ffmpegSettings(),
          ffmpegInfo,
          config,
        );
    },
  );
});

class PipelineBuilderFactory$Builder {
  private videoInputSource: Nullable<VideoInputSource> = null;
  private audioInputSource: Nullable<AudioInputSource> = null;
  private concatInputSource: Nullable<ConcatInputSource> = null;
  private watermarkInputSource: Nullable<WatermarkInputSource> = null;
  private hardwareAccelerationMode: HardwareAccelerationMode =
    HardwareAccelerationMode.None;

  constructor(
    private ffmpegSettings: ReadableFfmpegSettings,
    private ffmpegInfo: FfmpegInfo,
    private transcodeConfig: TranscodeConfig,
  ) {}

  setVideoInputSource(
    videoInputSource: Nullable<VideoInputSource>,
  ): PipelineBuilderFactory$Builder {
    this.videoInputSource = videoInputSource;
    return this;
  }

  setAudioInputSource(
    audioInputSource: Nullable<AudioInputSource>,
  ): PipelineBuilderFactory$Builder {
    this.audioInputSource = audioInputSource;
    return this;
  }

  setConcatInputSource(concatInputSource: ConcatInputSource): this {
    this.concatInputSource = concatInputSource;
    return this;
  }

  setWatermarkInputSource(
    watermarkInputSource: Nullable<WatermarkInputSource>,
  ): PipelineBuilderFactory$Builder {
    this.watermarkInputSource = watermarkInputSource;
    return this;
  }

  setHardwareAccelerationMode(
    hardwareAccelerationMode: HardwareAccelerationMode,
  ): PipelineBuilderFactory$Builder {
    this.hardwareAccelerationMode = hardwareAccelerationMode;
    return this;
  }

  async build(): Promise<PipelineBuilder> {
    if (isUndefined(this.videoInputSource)) {
      throw new Error();
    }

    const [hardwareCapabilities, binaryCapabilities] = await Promise.all([
      new HardwareCapabilitiesFactory(
        this.ffmpegSettings,
        this.transcodeConfig,
      ).getCapabilities(),
      this.ffmpegInfo.getCapabilities(),
    ]);

    switch (this.hardwareAccelerationMode) {
      case HardwareAccelerationMode.Cuda:
        return new NvidiaPipelineBuilder(
          hardwareCapabilities,
          binaryCapabilities,
          this.videoInputSource,
          this.audioInputSource,
          this.concatInputSource,
          this.watermarkInputSource,
        );
      case HardwareAccelerationMode.Qsv:
        return new QsvPipelineBuilder(
          hardwareCapabilities,
          binaryCapabilities,
          this.videoInputSource,
          this.audioInputSource,
          this.concatInputSource,
          this.watermarkInputSource,
        );
      case HardwareAccelerationMode.Vaapi:
        return new VaapiPipelineBuilder(
          hardwareCapabilities,
          binaryCapabilities,
          this.videoInputSource,
          this.audioInputSource,
          this.watermarkInputSource,
          this.concatInputSource,
        );
      case HardwareAccelerationMode.Videotoolbox:
        return new VideoToolboxPipelineBuilder(
          hardwareCapabilities,
          binaryCapabilities,
          this.videoInputSource,
          this.audioInputSource,
          this.concatInputSource,
          this.watermarkInputSource,
        );
      default:
        return new SoftwarePipelineBuilder(
          this.videoInputSource,
          this.audioInputSource,
          this.watermarkInputSource,
          this.concatInputSource,
          binaryCapabilities,
        );
    }
  }
}
