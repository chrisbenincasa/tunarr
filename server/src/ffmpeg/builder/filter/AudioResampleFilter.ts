import { FilterOption } from './FilterOption.ts';

export class AudioResampleFilter extends FilterOption {
  constructor(private asyncSamples: number = 1) {
    super();
  }

  get filter() {
    return `aresample=${AudioResampleAsyncOption(this.asyncSamples)}`;
  }
}

export const AudioResampleAsyncOption = (amt: number = 1): string =>
  `async=${amt}`;

export const AudioResampleFirstPtsOption = (v: number = 0): string =>
  `first_pts=${v}`;
