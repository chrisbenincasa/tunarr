import { SettingsDB, getSettings } from '@/db/SettingsDB.ts';
import { TranscodeConfig } from '@/db/schema/TranscodeConfig.ts';
import { HardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/HardwareCapabilitiesFactory.ts';
import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.ts';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.ts';
import { HardwareAccelerationMode } from '@/ffmpeg/builder/types.ts';
import { FfmpegInfo } from '@/ffmpeg/ffmpegInfo.ts';
import { Nullable } from '@/types/util.ts';
import { FfmpegSettings } from '@tunarr/types';
import { isUndefined } from 'lodash-es';
import { PipelineBuilder } from './PipelineBuilder.js';
import { NvidiaPipelineBuilder } from './hardware/NvidiaPipelineBuilder.ts';
import { QsvPipelineBuilder } from './hardware/QsvPipelineBuilder.ts';
import { VaapiPipelineBuilder } from './hardware/VaapiPipelineBuilder.ts';
import { VideoToolboxPipelineBuilder } from './hardware/VideoToolboxPipelineBuilder.ts';
import { SoftwarePipelineBuilder } from './software/SoftwarePipelineBuilder.ts';

export class PipelineBuilderFactory {
  constructor(private settingsDB: SettingsDB = getSettings()) {}

  builder(transcodeConfig: TranscodeConfig): PipelineBuilderFactory$Builder {
    return new PipelineBuilderFactory$Builder(
      this.settingsDB.ffmpegSettings(),
      transcodeConfig,
    );
  }
}

class PipelineBuilderFactory$Builder {
  private videoInputSource: Nullable<VideoInputSource> = null;
  private audioInputSource: Nullable<AudioInputSource> = null;
  private concatInputSource: Nullable<ConcatInputSource> = null;
  private watermarkInputSource: Nullable<WatermarkInputSource> = null;
  private hardwareAccelerationMode: HardwareAccelerationMode =
    HardwareAccelerationMode.None;

  constructor(
    private ffmpegSettings: FfmpegSettings,
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

    const info = new FfmpegInfo(this.ffmpegSettings);
    const [hardwareCapabilities, binaryCapabilities] = await Promise.all([
      new HardwareCapabilitiesFactory(
        this.ffmpegSettings,
        this.transcodeConfig,
      ).getCapabilities(),
      info.getCapabilities(),
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
