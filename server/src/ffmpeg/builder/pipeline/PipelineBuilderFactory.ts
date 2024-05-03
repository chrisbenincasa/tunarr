import { Nullable } from '../../../types/util';
import {
  AudioInputSource,
  HardwareAccelerationMode,
  VideoInputSource,
} from '../types';
import { NvidiaPipelineBuilder } from './hardware/NvidiaPipelineBuilder';
import { QsvPipelineBuilder } from './hardware/QsvPipelineBuilder';
import { SoftwarePipelineBuilder } from './software/SoftwarePipelineBuilder';

export class PipelineBuilderFactory {
  static getBuilder(
    hardwareAccelerationMode: HardwareAccelerationMode,
    videoInputFile: VideoInputSource,
    audioInputFile: Nullable<AudioInputSource>,
  ) {
    switch (hardwareAccelerationMode) {
      case 'nvenc':
        return new NvidiaPipelineBuilder(videoInputFile, audioInputFile);
      case 'qsv':
        return new QsvPipelineBuilder(videoInputFile, audioInputFile);
      default:
        return new SoftwarePipelineBuilder(videoInputFile, audioInputFile);
    }
  }
}
