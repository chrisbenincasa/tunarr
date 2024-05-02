import { FilterBase } from './FilterBase';

export class AudioPadFilter extends FilterBase {
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
