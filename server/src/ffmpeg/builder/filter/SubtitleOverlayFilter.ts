import type { PixelFormat } from '../format/PixelFormat.ts';
import { FilterOption } from './FilterOption.ts';

export class SubtitleOverlayFilter extends FilterOption {
  constructor(private desiredPixelFormat: PixelFormat) {
    super();
  }

  get filter() {
    return `overlay=x=(W-w)/2:y=(H-h)/2:format=${this.desiredPixelFormat.bitDepth === 10 ? 1 : 0}`;
  }
}
