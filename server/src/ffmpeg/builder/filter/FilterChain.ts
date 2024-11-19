import { HasFilterOption } from '@/ffmpeg/builder/types/PipelineStep.ts';
import { FilterOption } from './FilterOption.ts';

export class FilterChain {
  videoFilterSteps: HasFilterOption[] = [];
  watermarkOverlayFilterSteps: FilterOption[] = [];
  pixelFormatFilterSteps: HasFilterOption[] = [];
}
