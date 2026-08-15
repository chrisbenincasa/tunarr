import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';

export class WatermarkDurationFilter extends FilterOption {
  constructor(private durationSeconds: number) {
    super();
  }

  get filter() {
    return `trim=duration=${this.durationSeconds},setpts=PTS-STARTPTS`;
  }
}
