import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import type { Watermark } from '@tunarr/types';

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
