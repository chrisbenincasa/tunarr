import { FilterOption } from '../FilterOption.ts';

type Enable = {
  start: number;
  end: number;
};
export class WatermarkFadeFilter extends FilterOption {
  private constructor(
    private fadeIn: boolean,
    private startSeconds: number,
    private enable?: Enable,
  ) {
    super();
  }

  static fadeIn(startSeconds: number, enable?: Enable) {
    return new WatermarkFadeFilter(true, startSeconds, enable);
  }

  static fadeOut(startSeconds: number, enable?: Enable) {
    return new WatermarkFadeFilter(false, startSeconds, enable);
  }

  get filter() {
    const inOut = this.fadeIn ? 'in' : 'out';
    let f = `fade=${inOut}:st=${this.startSeconds}:d=1:alpha=1`;
    if (this.enable) {
      f += `:enable='between(t,${this.enable.start},${this.enable.end})'`;
    }
    return f;
  }
}
