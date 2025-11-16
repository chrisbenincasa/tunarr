import { FilterOption } from './FilterOption.ts';

export class AudioPadFilter extends FilterOption {
  constructor() {
    super();
  }

  get filter() {
    return 'apad';
  }
}
