import { isNull } from 'lodash-es';
import { Nullable } from '../../../../types/util';
import { isNonEmptyString } from '../../../../util';
import { PixelFormat, PixelFormats } from '../../format/PixelFormat';
import { Filter } from '../FilterBase';
import { FrameState } from '../../state/FrameState';

export class HardwareDownloadCudaFilter extends Filter {
  public affectsFrameState: boolean = true;

  constructor(
    private currentPixelFormat: Nullable<PixelFormat>,
    private targetPixelFormat: Nullable<PixelFormat>,
  ) {
    super();
  }

  get filter() {
    let f = 'hwdownload';
    if (
      !isNull(this.currentPixelFormat) &&
      isNonEmptyString(this.currentPixelFormat.ffmpegName)
    ) {
      f += `,format=${this.currentPixelFormat.ffmpegName}`;
      if (this.currentPixelFormat.name === PixelFormats.NV12) {
        if (!isNull(this.targetPixelFormat)) {
          f += `,format=${this.targetPixelFormat.ffmpegName}`;
        } else {
          // TODO: Handle alt case here...
        }
      }
    }

    return f;
  }

  nextState(currentState: FrameState): FrameState {
    let nextState = currentState.updateFrameLocation('software');
    if (!isNull(this.targetPixelFormat)) {
      return nextState.update({ pixelFormat: this.targetPixelFormat });
    }

    if (!isNull(this.currentPixelFormat)) {
      if (this.currentPixelFormat.name === PixelFormats.NV12) {
        nextState = nextState.update({ pixelFormat: null });
      } else {
        nextState = nextState.update({ pixelFormat: this.currentPixelFormat });
      }
    }

    return nextState;
  }
}
