import { FilterOption } from './FilterOption.ts';

export class TrimFilter extends FilterOption {
  constructor(
    private startSeconds: number,
    private endSeconds: number,
  ) {
    super();
  }

  get filter() {
    return `trim=${this.startSeconds}:${this.endSeconds}`;
  }
}
