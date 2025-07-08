import type {
  ISettingsDB,
  ReadableFfmpegSettings,
} from '@/db/interfaces/ISettingsDB.js';
import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import { HardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/HardwareCapabilitiesFactory.js';
import type { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.js';
import type { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import type { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.js';
import type { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.js';
import { FfmpegInfo } from '@/ffmpeg/ffmpegInfo.js';
import type { Nullable } from '@/types/util.js';
import { ContainerModule } from 'inversify';
import { isUndefined } from 'lodash-es';
import { KEYS } from '../../../types/inject.ts';
import { bindFactoryFunc } from '../../../util/inject.ts';
import type { SubtitlesInputSource } from '../input/SubtitlesInputSource.ts';
import type { PipelineBuilder } from './PipelineBuilder.js';
import { QsvPipelineBuilder } from './hardware/QsvPipelineBuilder.ts';
import { VaapiPipelineBuilder } from './hardware/VaapiPipelineBuilder.ts';
import { VideoToolboxPipelineBuilder } from './hardware/VideoToolboxPipelineBuilder.ts';
import { NvidiaPipelineBuilder } from './nvidia/NvidiaPipelineBuilder.ts';
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
  private subtiitleInputSource: Nullable<SubtitlesInputSource> = null;
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

  setSubtitleInputSource(
    subtitleInputSource: Nullable<SubtitlesInputSource>,
  ): PipelineBuilderFactory$Builder {
    this.subtiitleInputSource = subtitleInputSource;
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
          this.subtiitleInputSource,
        );
      case HardwareAccelerationMode.Qsv:
        return new QsvPipelineBuilder(
          hardwareCapabilities,
          binaryCapabilities,
          this.videoInputSource,
          this.audioInputSource,
          this.concatInputSource,
          this.watermarkInputSource,
          this.subtiitleInputSource,
        );
      case HardwareAccelerationMode.Vaapi:
        return new VaapiPipelineBuilder(
          hardwareCapabilities,
          binaryCapabilities,
          this.videoInputSource,
          this.audioInputSource,
          this.watermarkInputSource,
          this.subtiitleInputSource,
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
          this.subtiitleInputSource,
        );
      default:
        return new SoftwarePipelineBuilder(
          this.videoInputSource,
          this.audioInputSource,
          this.watermarkInputSource,
          this.subtiitleInputSource,
          this.concatInputSource,
          binaryCapabilities,
        );
    }
  }
}
