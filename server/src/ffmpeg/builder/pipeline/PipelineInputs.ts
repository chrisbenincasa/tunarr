import { Nullable } from '../../../types/util.ts';
import { AudioInputSource } from '../input/AudioInputSource.ts';
import { ConcatInputSource } from '../input/ConcatInputSource.ts';
import { VideoInputSource } from '../input/VideoInputSource.ts';
import { WatermarkInputSource } from '../input/WatermarkInputSource.ts';

export type PipelineInputs = {
  videoInput: Nullable<VideoInputSource>;
  audioInput: Nullable<AudioInputSource>;
  watermarkInput: Nullable<WatermarkInputSource>;
  concatInput: Nullable<ConcatInputSource>;
};
