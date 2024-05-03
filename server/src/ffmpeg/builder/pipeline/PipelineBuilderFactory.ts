import { Nullable } from '../../../types/util';
import {
  AudioInputSource,
  HardwareAccelerationMode,
  VideoInputSource,
} from '../types';
import { NvidiaPipelineBuilder } from './hardware/NvidiaPipelineBuilder';
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
        throw new Error('not yet implemented');
      default:
        return new SoftwarePipelineBuilder(videoInputFile, audioInputFile);
    }
  }
}
