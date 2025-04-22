import type { FrameSize } from '../../types.ts';
import { FilterOption } from '../FilterOption.ts';

export class SubtitleScaleCudaFilter extends FilterOption {
  constructor(private targetSize: FrameSize) {
    super();
  }

  get filter() {
    return `scale_cuda=${this.targetSize.width}:${this.targetSize.height}:force_original_aspect_ratio=1`;
  }
}
