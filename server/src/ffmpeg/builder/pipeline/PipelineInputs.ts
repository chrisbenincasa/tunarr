import type { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.js';
import type { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.js';
import type { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.js';
import type { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.js';
import type { Nullable } from '@/types/util.js';

export type PipelineInputs = {
  videoInput: Nullable<VideoInputSource>;
  audioInput: Nullable<AudioInputSource>;
  watermarkInput: Nullable<WatermarkInputSource>;
  concatInput: Nullable<ConcatInputSource>;
};
