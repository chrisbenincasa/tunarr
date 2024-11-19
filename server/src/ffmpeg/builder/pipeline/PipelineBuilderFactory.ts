import { SettingsDB, getSettings } from '@/db/SettingsDB.ts';
import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.ts';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.ts';
import { HardwareAccelerationMode } from '@/ffmpeg/builder/types.ts';
import { FFMPEGInfo } from '@/ffmpeg/ffmpegInfo.ts';
import { Nullable } from '@/types/util.ts';
import { FfmpegSettings } from '@tunarr/types';
import { isNull, isUndefined } from 'lodash-es';
import { DeepReadonly } from 'ts-essentials';
import { PipelineBuilder } from './PipelineBuilder.js';
import { NvidiaPipelineBuilder } from './hardware/NvidiaPipelineBuilder.ts';
import { QsvPipelineBuilder } from './hardware/QsvPipelineBuilder.ts';
import { VaapiPipelineBuilder } from './hardware/VaapiPipelineBuilder.ts';
import { SoftwarePipelineBuilder } from './software/SoftwarePipelineBuilder.ts';

export class PipelineBuilderFactory {
  constructor(private settingsDB: SettingsDB = getSettings()) {}

  builder(
    settings: DeepReadonly<FfmpegSettings> = this.settingsDB.ffmpegSettings(),
  ): PipelineBuilderFactory$Builder {
    return new PipelineBuilderFactory$Builder(settings);
  }
}

class PipelineBuilderFactory$Builder {
  private videoInputSource: Nullable<VideoInputSource> = null;
  private audioInputSource: Nullable<AudioInputSource> = null;
  private concatInputSource: Nullable<ConcatInputSource> = null;
  private watermarkInputSource: Nullable<WatermarkInputSource> = null;
  private hardwareAccelerationMode: HardwareAccelerationMode = 'none';

  constructor(private ffmpegSettings: FfmpegSettings) {}

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

    const info = new FFMPEGInfo(this.ffmpegSettings);
    const hardwareCapabilities = await info.getHardwareCapabilities(
      this.hardwareAccelerationMode,
    );
    const binaryCapabilities = await info.getCapabilities();

    if (isNull(this.videoInputSource)) {
      // Audio-only pipeline builder??
      throw new Error('Not yet implemented');
      // return new SoftwarePipelineBuilder()
    }

    switch (this.hardwareAccelerationMode) {
      case 'cuda':
        return new NvidiaPipelineBuilder(
          hardwareCapabilities,
          binaryCapabilities,
          this.videoInputSource,
          this.audioInputSource,
          this.concatInputSource,
          this.watermarkInputSource,
        );
      case 'qsv':
        return new QsvPipelineBuilder(
          this.videoInputSource,
          this.audioInputSource,
          this.watermarkInputSource,
          this.concatInputSource,
          binaryCapabilities,
        );
      case 'vaapi':
        return new VaapiPipelineBuilder(
          hardwareCapabilities,
          binaryCapabilities,
          this.videoInputSource,
          this.audioInputSource,
          this.watermarkInputSource,
          this.concatInputSource,
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
