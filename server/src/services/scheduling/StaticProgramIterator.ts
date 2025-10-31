import type { CondensedChannelProgram } from '@tunarr/types';
import type { IterationState, ProgramIterator } from './ProgramIterator.ts';

/**
 * A {@link ProgramIterator} that returns a single program repeatedly.
 */

export class StaticProgramIterator<ProgramT extends CondensedChannelProgram>
  implements ProgramIterator<ProgramT>
{
  constructor(protected program: ProgramT) {}

  current(_state: IterationState): ProgramT | null {
    return this.program;
  }

  next(): void {}

  reset(): void {}
}
