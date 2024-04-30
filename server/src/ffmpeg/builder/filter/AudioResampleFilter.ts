import { Filter } from './FilterBase';

export class AudioResampleFilter extends Filter {
  constructor(
    private sampleRate: number,
    private additionalOptions: string[] = [],
  ) {
    super();
  }

  get filter() {
    let f = `aresample=${this.sampleRate}`;
    if (this.additionalOptions.length > 0) {
      const opts = this.additionalOptions.join(':');
      f = `${f}:${opts}`;
    }
    return f;
  }
}

export const AudioResampleAsyncOption = (amt: number = 1): string =>
  `async=${amt}`;

export const AudioResampleFirstPtsOption = (v: number = 0): string =>
  `first_pts=${v}`;
