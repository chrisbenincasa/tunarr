import { FilterOption } from '../FilterOption.ts';

export class WatermarkFadeFilter extends FilterOption {
  constructor(
    private fadeIn: boolean,
    private startSecondsd: number,
    private enableStart: number,
    private enableEnd: number,
  ) {
    super();
  }

  get filter() {
    const inOut = this.fadeIn ? 'in' : 'out';
    return `fade=${inOut}:st=${this.startSecondsd}:d=1:alpha=1:enable='between(t,${this.enableStart},${this.enableEnd})'`;
  }
}
