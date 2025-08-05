import type { ChannelProgram, FlexProgram } from '@tunarr/types';
import type { IterationState } from './ProgramIterator.ts';
import { StaticProgramIterator } from './StaticProgramIterator.ts';

export class FlexProgramIterator extends StaticProgramIterator {
  constructor(flexProgram: FlexProgram) {
    super(flexProgram);
  }

  current({ slotDuration }: IterationState): ChannelProgram | null {
    return {
      ...this.program,
      duration: slotDuration,
    };
  }
}
