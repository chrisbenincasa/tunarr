import type { FlexProgram } from '@tunarr/types';
import type { IterationState } from './ProgramIterator.ts';
import { StaticProgramIterator } from './StaticProgramIterator.ts';

export class FlexProgramIterator extends StaticProgramIterator<FlexProgram> {
  constructor(flexProgram: FlexProgram) {
    super(flexProgram);
  }

  current({ slotDuration }: IterationState): FlexProgram | null {
    return {
      ...this.program,
      duration: slotDuration,
    };
  }
}
