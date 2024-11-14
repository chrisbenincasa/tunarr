import { Watermark } from '@tunarr/types';
import { FrameSize } from '../../types.ts';
import { FilterOption } from '../FilterOption.ts';

export class WatermarkScaleFilter extends FilterOption {
  constructor(
    private resolution: FrameSize,
    private watermark: Watermark,
  ) {
    super();
  }

  public get filter(): string {
    const width = Math.round(
      (this.watermark.width / 100) * this.resolution.width,
    );
    return `scale=${width}:-1`;
  }
}
