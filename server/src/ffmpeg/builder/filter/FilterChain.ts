import { HasFilterOption } from '../types/PipelineStep.ts';
import { FilterOption } from './FilterOption.ts';

export class FilterChain {
  videoFilterSteps: HasFilterOption[] = [];
  watermarkOverlayFilterSteps: FilterOption[] = [];
  pixelFormatFilterSteps: HasFilterOption[] = [];
}
