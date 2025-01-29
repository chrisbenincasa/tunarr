import type { IPipelineStep } from '@/ffmpeg/builder/types/PipelineStep.js';

export interface PipelineFilterStep extends IPipelineStep {
  filter: string;
}
