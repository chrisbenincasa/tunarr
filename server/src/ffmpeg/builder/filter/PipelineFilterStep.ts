import { IPipelineStep } from '../types/PipelineStep.ts';

export interface PipelineFilterStep extends IPipelineStep {
  filter: string;
}
