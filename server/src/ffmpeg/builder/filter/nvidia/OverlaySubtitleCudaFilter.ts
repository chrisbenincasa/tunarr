import { FilterOption } from '../FilterOption.ts';

export class OverlaySubtitleCudaFilter extends FilterOption {
  get filter() {
    return `overlay_cuda=x=(W-w)/2:y=(H-h)/2`;
  }
}
