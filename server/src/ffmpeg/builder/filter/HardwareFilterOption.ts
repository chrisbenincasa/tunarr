import type { FrameState } from '../state/FrameState.ts';
import { FilterOption } from './FilterOption.ts';

export abstract class HardwareFilterOption extends FilterOption {
  protected preprocessFilters: FilterOption[] = [];
  protected postProcessFilters: FilterOption[] = [];

  constructor(protected currentState: FrameState) {
    super();
  }

  public get filter(): string {
    return '';
  }

  protected abstract filterInternal(): string;
}
