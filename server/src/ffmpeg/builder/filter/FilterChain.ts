import type { HasFilterOption } from '@/ffmpeg/builder/types/PipelineStep.js';
import type { FilterOption } from './FilterOption.ts';

export class FilterChain {
  videoFilterSteps: HasFilterOption[] = [];
  subtitleOverlayFilterSteps: FilterOption[] = [];
  watermarkOverlayFilterSteps: FilterOption[] = [];
  pixelFormatFilterSteps: HasFilterOption[] = [];
}
