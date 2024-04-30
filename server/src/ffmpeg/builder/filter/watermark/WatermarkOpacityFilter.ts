import { Watermark } from '@tunarr/types';
import { round } from 'lodash-es';
import { FilterOption } from '../FilterOption.ts';

export class WatermarkOpacityFilter extends FilterOption {
  constructor(private watermark: Watermark) {
    super();
  }

  get filter() {
    const opacity = round(this.watermark.opacity, 2);
    return `format=yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8,colorchannelmixer=aa=${opacity}`;
  }
}
