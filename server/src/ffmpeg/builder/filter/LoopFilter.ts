import { FilterOption } from './FilterOption.ts';

export class LoopFilter extends FilterOption {
  constructor(
    private count: number = -1,
    private maxFrames: number = 1,
  ) {
    super();
  }

  get filter(): string {
    return `loop=${this.count}:${this.maxFrames}`;
  }
}
