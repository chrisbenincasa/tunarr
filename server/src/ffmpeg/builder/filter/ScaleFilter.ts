import { PipelineFunctionArgs } from '../pipeline/BasePIpelineBuilder';
import { FrameState } from '../state/FrameState';
import { FilterBase } from './FilterBase';

export class ScaleFilter extends FilterBase {
  filter: string;
  private constructor(args: PipelineFunctionArgs) {
    super();
    this.filter = ScaleFilter.generateFilter(args);
  }

  static create(currentState: FrameState, args: PipelineFunctionArgs) {
    const filter = new ScaleFilter(args);
    return {
      nextState: filter.nextState(currentState),
      filter,
    };
  }

  static generateFilter(args: PipelineFunctionArgs): string {
    return '';
  }
}
