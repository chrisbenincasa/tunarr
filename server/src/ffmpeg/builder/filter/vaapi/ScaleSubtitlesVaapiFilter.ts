import type { FrameSize } from '../../types.ts';
import { FilterOption } from '../FilterOption.ts';

export class ScaleSubtitlesVaapiFilter extends FilterOption {
  constructor(private size: FrameSize) {
    super();
  }

  get filter() {
    return `scale_vaapi=${this.size.width}:${this.size.height}:force_original_aspect_ratio=decrease`;
  }
}
