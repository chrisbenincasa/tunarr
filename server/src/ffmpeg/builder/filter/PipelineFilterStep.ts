import { IPipelineStep } from '@/ffmpeg/builder/types/PipelineStep.ts';

export interface PipelineFilterStep extends IPipelineStep {
  filter: string;
}
