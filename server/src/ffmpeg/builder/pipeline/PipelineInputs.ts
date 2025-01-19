import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.js';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.js';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.js';
import { Nullable } from '@/types/util.js';

export type PipelineInputs = {
  videoInput: Nullable<VideoInputSource>;
  audioInput: Nullable<AudioInputSource>;
  watermarkInput: Nullable<WatermarkInputSource>;
  concatInput: Nullable<ConcatInputSource>;
};
