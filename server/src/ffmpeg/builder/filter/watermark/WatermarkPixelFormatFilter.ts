import { isNonEmptyString } from '@/util/index.js';
import type { Watermark } from '@tunarr/types';
import { isEmpty } from 'lodash-es';
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
    let format: string;
    switch (this.ffmpegState.encoderHwAccelMode) {
      case 'cuda':
        format = this.is10BitOutput ? 'nv12' : 'yuva420p';
        break;
      case 'qsv':
        format = 'yuva420p';
        break;
      case 'none':
      case 'vaapi':
      case 'videotoolbox':
      case 'vulkan':
        format =
          this.watermark.opacity !== 100 || hasFade
            ? 'yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8'
            : '';
        break;
    }

    if (isNonEmptyString(format)) {
      return `format=${format}`;
    }

    return '';
  }
}
