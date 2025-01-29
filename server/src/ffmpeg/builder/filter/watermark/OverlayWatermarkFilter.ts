import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { FrameSize } from '@/ffmpeg/builder/types.js';
import type { Watermark } from '@tunarr/types';

export class OverlayWatermarkFilter extends FilterOption {
  public readonly affectsFrameState: boolean = true;
  public filter: string;

  constructor(
    protected watermark: Watermark,
    private resolution: FrameSize,
    // @ts-expect-error - We're going to use this soon
    private squarePixelResolution: FrameSize,
    private outputPixelFormat: PixelFormat,
  ) {
    super();
    this.filter = this.generateFilter();
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation('software');
  }

  protected getPosition() {
    // We only support 'normal' margin mode currently.
    const x = Math.round(
      (this.watermark.horizontalMargin / 100.0) * this.resolution.width,
    );
    const y = Math.round(
      (this.watermark.verticalMargin / 100.0) * this.resolution.height,
    );

    let position: string;
    switch (this.watermark.position) {
      case 'top-left':
        position = `x=${x}:y=${y}`;
        break;
      case 'top-right':
        position = `x=W-w-${x}:y=${y}`;
        break;
      case 'bottom-left':
        position = `x=${x}:y=H-h-${y}`;
        break;
      case 'bottom-right':
        position = `x=W-w-${x}:y=H-h-${y}`;
        break;
    }

    return position;
  }

  private generateFilter() {
    const enablePart =
      this.watermark.duration > 0
        ? `:enable='between(t,0,${this.watermark.duration})'`
        : '';
    const format = this.outputPixelFormat.bitDepth === 10 ? 1 : 0;
    return `overlay=${this.getPosition()}:format=${format}${enablePart}`;
  }
}
