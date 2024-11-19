import { AudioInputSource } from '@/ffmpeg/builder/input/AudioInputSource.ts';
import { ConcatInputSource } from '@/ffmpeg/builder/input/ConcatInputSource.ts';
import { VideoInputSource } from '@/ffmpeg/builder/input/VideoInputSource.ts';
import { WatermarkInputSource } from '@/ffmpeg/builder/input/WatermarkInputSource.ts';
import { Nullable } from '@/types/util.ts';

export type PipelineInputs = {
  videoInput: Nullable<VideoInputSource>;
  audioInput: Nullable<AudioInputSource>;
  watermarkInput: Nullable<WatermarkInputSource>;
  concatInput: Nullable<ConcatInputSource>;
};
