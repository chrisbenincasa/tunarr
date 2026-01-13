import { FilterOption } from './FilterOption.ts';

export class AudioVolumeFilter extends FilterOption {
  constructor(private volume: number) {
    super();
  }

  get filter() {
    return `volume=${(this.volume / 100.0).toFixed(3)}`;
  }
}
