import { PipelineStep } from '../types';

export interface PipelineFilterStep extends PipelineStep {
  filter: string;
}
