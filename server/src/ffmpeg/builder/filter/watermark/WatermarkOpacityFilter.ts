import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import { round } from 'lodash-es';

export class WatermarkOpacityFilter extends FilterOption {
  constructor(
    private opacity: number,
    private between?: { startSeconds: number; endSeconds: number },
  ) {
    super();
  }

  get filter() {
    const opacity =
      this.opacity > 2
        ? round(this.opacity / 100.0, 2)
        : round(this.opacity, 2);
    let enable = '';
    if (this.between) {
      enable = `:enable='between(t,${this.between.startSeconds},${this.between.endSeconds})'`;
    }
    return `format=yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8,colorchannelmixer=aa=${opacity}${enable}`;
  }
}
