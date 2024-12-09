import { FilterOption } from '@/ffmpeg/builder/filter/FilterOption.ts';
import {
  PixelFormat,
  PixelFormatNv12,
  PixelFormats,
} from '@/ffmpeg/builder/format/PixelFormat.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { Nullable } from '@/types/util.ts';
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
      const fmt =
        this.currentPixelFormat.toHardwareFormat() ?? this.currentPixelFormat;
      f += `,format=${fmt.name}`;
      if (fmt instanceof PixelFormatNv12) {
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
