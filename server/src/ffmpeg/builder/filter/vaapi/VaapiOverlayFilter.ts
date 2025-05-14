import { FilterOption } from '../FilterOption.ts';

export class VaapiOverlayFilter extends FilterOption {
  get filter() {
    return `overlay_vaapi=x=(W-w)/2:y=(H-h)/2`;
  }
}
