import { isUndefined } from 'lodash-es';
import { Nullable } from '../../../types/util';
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
  static builder(): PipelineBuilderFactory$Builder {
    return new PipelineBuilderFactory$Builder();
  }
}

class PipelineBuilderFactory$Builder {
  private videoInputFile: VideoInputSource;
  private audioInputFile: Nullable<AudioInputSource> = null;
  private watermarkInputFile: Nullable<WatermarkInputSource> = null;
  private hardwareAccelerationMode: HardwareAccelerationMode = 'none';

  setVideoInputSource(
    videoInputSource: VideoInputSource,
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
    watermarkInputSource: WatermarkInputSource,
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

  build(): PipelineBuilder {
    if (isUndefined(this.videoInputFile)) {
      throw new Error();
    }

    switch (this.hardwareAccelerationMode) {
      case 'nvenc':
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
