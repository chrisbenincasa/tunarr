import type { FrameSize } from '../../types.ts';
import { FilterOption } from '../FilterOption.ts';

export class SubtitleScaleNppFilter extends FilterOption {
  constructor(private targetSize: FrameSize) {
    super();
  }

  get filter() {
    return `scale_npp=${this.targetSize.width}:${this.targetSize.height}:force_original_aspect_ratio=1`;
  }
}
