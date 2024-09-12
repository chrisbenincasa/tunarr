import { FfmpegSettings } from '@tunarr/types';
import { isNull, isUndefined } from 'lodash-es';
import { SettingsDB, getSettings } from '../../../dao/settings';
import { Nullable } from '../../../types/util';
import { FFMPEGInfo } from '../../ffmpegInfo';
import {
  AudioInputSource,
  HardwareAccelerationMode,
  VideoInputSource,
  WatermarkInputSource,
} from '../types';
import { PipelineBuilder } from './PipelineBuilder.js';
import { NvidiaPipelineBuilder } from './hardware/NvidiaPipelineBuilder';
import { QsvPipelineBuilder } from './hardware/QsvPipelineBuilder';
import { SoftwarePipelineBuilder } from './software/SoftwarePipelineBuilder';

export class PipelineBuilderFactory {
  constructor(private settingsDB: SettingsDB = getSettings()) {}

  builder(): PipelineBuilderFactory$Builder {
    return new PipelineBuilderFactory$Builder(this.settingsDB.ffmpegSettings());
  }
}

class PipelineBuilderFactory$Builder {
  private videoInputFile: Nullable<VideoInputSource> = null;
  private audioInputFile: Nullable<AudioInputSource> = null;
  private watermarkInputFile: Nullable<WatermarkInputSource> = null;
  private hardwareAccelerationMode: HardwareAccelerationMode = 'none';

  constructor(private ffmpegSettings: FfmpegSettings) {}

  setVideoInputSource(
    videoInputSource: Nullable<VideoInputSource>,
  ): PipelineBuilderFactory$Builder {
    this.videoInputFile = videoInputSource;
    return this;
  }

  setAudioInputSource(
    audioInputSource: Nullable<AudioInputSource>,
  ): PipelineBuilderFactory$Builder {
    this.audioInputFile = audioInputSource;
    return this;
  }

  setWatermarkInputSource(
    watermarkInputSource: Nullable<WatermarkInputSource>,
  ): PipelineBuilderFactory$Builder {
    this.watermarkInputFile = watermarkInputSource;
    return this;
  }

  setHardwareAccelerationMode(
    hardwareAccelerationMode: HardwareAccelerationMode,
  ): PipelineBuilderFactory$Builder {
    this.hardwareAccelerationMode = hardwareAccelerationMode;
    return this;
  }

  async build(): Promise<PipelineBuilder> {
    if (isUndefined(this.videoInputFile)) {
      throw new Error();
    }

    const info = new FFMPEGInfo(this.ffmpegSettings);
    const hardwareCapabilities = await info.getHardwareCapabilities(
      this.hardwareAccelerationMode,
    );

    console.log(hardwareCapabilities);

    if (isNull(this.videoInputFile)) {
      // Audio-only pipeline builder??
      throw new Error('Not yet implemented');
      // return new SoftwarePipelineBuilder()
    }

    switch (this.hardwareAccelerationMode) {
      case 'cuda':
        return new NvidiaPipelineBuilder(
          this.videoInputFile,
          this.audioInputFile,
          this.watermarkInputFile,
        );
      case 'qsv':
        return new QsvPipelineBuilder(
          this.videoInputFile,
          this.audioInputFile,
          this.watermarkInputFile,
        );
      default:
        return new SoftwarePipelineBuilder(
          this.videoInputFile,
          this.audioInputFile,
          this.watermarkInputFile,
        );
    }
  }
}
