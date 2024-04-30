import { FilterOption } from './FilterOption.ts';

export class AudioPadFilter extends FilterOption {
  constructor(private duration: number) {
    super();
  }

  static create(duration: number) {
    return new AudioPadFilter(duration);
  }

  get filter() {
    return `apad=whole_dur=${this.duration}ms`;
  }
}
