import { FilterOption } from '../FilterOption.ts';

export class VaapiSubtitlePixelFormatFilter extends FilterOption {
  get filter() {
    return 'format=vaapi|yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8';
  }
}
