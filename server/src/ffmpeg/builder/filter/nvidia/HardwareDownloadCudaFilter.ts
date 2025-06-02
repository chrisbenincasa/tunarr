import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.js';
import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import {
  PixelFormatNv12,
  PixelFormats,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import type { Nullable } from '@/types/util.js';
import { isNull } from 'lodash-es';
import { FrameDataLocation } from '../../types.ts';

export class HardwareDownloadCudaFilter extends FilterOption {
  public affectsFrameState: boolean = true;

  constructor(
    private currentPixelFormat: Nullable<PixelFormat>,
    private targetPixelFormat: Nullable<PixelFormat>,
  ) {
    super();
  }

  get filter() {
    let f = 'hwdownload';
    if (this.currentPixelFormat) {
      f += `,format=${this.currentPixelFormat.name}`;
      if (this.currentPixelFormat instanceof PixelFormatNv12) {
        if (!this.targetPixelFormat) {
          const target = this.currentPixelFormat.unwrap();
          if (target) {
            f += `,format=${target.name}`;
          }
        } else {
          f += `,format=${this.targetPixelFormat.name}`;
        }
      }
    }

    return f;
  }

  nextState(currentState: FrameState): FrameState {
    let nextState = currentState.updateFrameLocation(
      FrameDataLocation.Software,
    );

    if (!isNull(this.targetPixelFormat)) {
      return nextState.update({ pixelFormat: this.targetPixelFormat });
    }

    if (!isNull(this.currentPixelFormat)) {
      if (this.currentPixelFormat.name === PixelFormats.NV12) {
        nextState = nextState.update({
          pixelFormat: this.currentPixelFormat.unwrap(),
        });
      } else {
        nextState = nextState.update({ pixelFormat: this.currentPixelFormat });
      }
    }

    return nextState;
  }
}
