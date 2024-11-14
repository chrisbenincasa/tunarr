import { FilterOption } from './FilterOption.ts';

export class SineWaveGeneratorFilter extends FilterOption {
  constructor(private freq: number = 440) {
    super();
  }

  get filter(): string {
    return `sine=f=${this.freq}`;
  }
}
