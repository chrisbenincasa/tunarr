import { PipelineFilterStep } from './PipelineFilterStep';

export class FilterChain {
  videoFilterSteps: PipelineFilterStep[] = [];
  watermarkOverlayFilterSteps: PipelineFilterStep[] = [];
}
