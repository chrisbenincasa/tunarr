import { Filter } from './FilterBase';

export class AudioPadFilter extends Filter {
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
