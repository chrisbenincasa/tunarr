import { FilterOption } from './FilterOption.ts';

export class AudioResampleFilter extends FilterOption {
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

export class AudioFirstPtsFilter extends FilterOption {
  constructor(
    private asyncSamples: number = 1,
    private pts: number = 0,
  ) {
    super();
  }

  get filter() {
    return `aresample=${AudioResampleAsyncOption(
      this.asyncSamples,
    )}:${AudioResampleFirstPtsOption(this.pts)}`;
  }
}

export const AudioResampleAsyncOption = (amt: number = 1): string =>
  `async=${amt}`;

export const AudioResampleFirstPtsOption = (v: number = 0): string =>
  `first_pts=${v}`;
