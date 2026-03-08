import { ColorFormat } from '../../format/ColorFormat.ts';
import type { FrameState } from '../../state/FrameState.ts';
import { FilterOption } from '../FilterOption.ts';

export class TonemapQsvFilter extends FilterOption {
  get filter() {
    return `vpp_qsv=tonemap=1`;
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.update({
      colorFormat: ColorFormat.bt709,
    });
  }
}
