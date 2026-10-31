import type { FrameSize } from '@/ffmpeg/builder/types.js';
import { FilterOption } from './FilterOption.ts';

/** Long enough to carry a real message, short enough to stay on screen. */
const MaxTextLength = 120;

/**
 * Text sits inside single quotes in a `drawtext` value, and inside those quotes
 * only `'` can end the quoting and let crafted text append its own filters. So
 * quotes and backslashes are dropped, `%` goes with them, and control
 * characters become spaces. Everything else stays literal because the quoting
 * holds.
 */
function sanitizeDrawText(raw: string): string {
  return raw
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/['\\%]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MaxTextLength);
}

/**
 * Draws a centered title with a smaller subtitle under it, white on whatever
 * the input is.
 *
 * `expansion=none` keeps `%{...}` in the text from reaching drawtext's
 * expression evaluator.
 */
export function titleTextFilter(
  heightPx: number,
  title: string,
  subtitle: string = '',
): string {
  const subtitleSize = Math.ceil(heightPx / 33);
  const titleSize = Math.ceil((subtitleSize * 3) / 2);
  const gap = 2 * subtitleSize;
  const draw = (size: number, y: string, text: string) =>
    `drawtext=expansion=none:fontsize=${size}:fontcolor=white:x=(w-text_w)/2:y=${y}:text='${sanitizeDrawText(text)}'`;

  return [
    draw(titleSize, '(h-text_h)/2', title),
    draw(subtitleSize, `(h+text_h+${gap})/2`, subtitle),
  ].join(',');
}

export class TitleTextFilter extends FilterOption {
  constructor(
    private size: FrameSize,
    private title: string,
    private subtitle?: string,
  ) {
    super();
  }

  get filter() {
    return titleTextFilter(this.size.height, this.title, this.subtitle);
  }
}
