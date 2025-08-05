import type { ChannelProgram } from '@tunarr/types';
import type { IterationState, ProgramIterator } from './ProgramIterator.ts';

/**
 * A {@link ProgramIterator} that returns a single program repeatedly.
 */

export class StaticProgramIterator implements ProgramIterator {
  constructor(protected program: ChannelProgram) {}

  current(_state: IterationState): ChannelProgram | null {
    return this.program;
  }

  next(): void {}

  reset(): void {}
}
