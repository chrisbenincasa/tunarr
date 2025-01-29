import { isNonEmptyString } from '@/util/index.js';
import type { Watermark } from '@tunarr/types';
import { isEmpty } from 'lodash-es';
import { match } from 'ts-pattern';
import type { FfmpegState } from '../../state/FfmpegState.ts';
import { FilterOption } from '../FilterOption.ts';

export class WatermarkPixelFormatFilter extends FilterOption {
  constructor(
    private watermark: Watermark,
    private ffmpegState: FfmpegState,
    private is10BitOutput: boolean,
  ) {
    super();
  }

  get filter() {
    const hasFade = !isEmpty(this.watermark.fadeConfig);
    const format = match(this.ffmpegState.encoderHwAccelMode)
      .with('cuda', () => (this.is10BitOutput ? 'nv12' : 'yuva420p'))
      .with('qsv', () => 'yuva420p')
      .otherwise(() => {
        if (this.watermark.opacity !== 100 || hasFade) {
          return 'yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8';
        }

        return '';
      });

    if (isNonEmptyString(format)) {
      return `format=${format}`;
    }

    return '';
  }
}
