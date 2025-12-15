import type {
  CondensedChannelProgram,
  CondensedContentProgram,
} from '@tunarr/types';
import type { CondensedCustomProgram } from '@tunarr/types/schemas';
import { slice } from 'lodash-es';
import type { Random } from 'random-js';
import { IndexBasedProgramIterator } from './ProgramIterator.ts';
import {
  createIndexByIdMap,
  type SlotSchedulerProgram,
} from './slotSchedulerUtil.ts';

export abstract class ShuffleProgramIterator<
  ProgramT extends CondensedChannelProgram,
> extends IndexBasedProgramIterator<ProgramT> {
  constructor(
    programs: SlotSchedulerProgram[],
    private random: Random,
  ) {
    super(random.shuffle(programs));
  }

  next() {
    super.next();
    if (this.position >= this.programs.length) {
      const mid = Math.floor(this.programs.length / 2);
      this.programs = [
        ...slice(this.programs, 0, mid),
        ...slice(this.programs, mid),
      ];
      this.position = 0;
    }
  }

  reset(): void {
    this.programs = this.random.shuffle(this.programs);
    this.position = 0;
  }
}

export class ContentProgramShuffleIterator extends ShuffleProgramIterator<CondensedContentProgram> {
  protected mint(program: SlotSchedulerProgram): CondensedContentProgram {
    return {
      type: 'content',
      duration: program.duration,
      persisted: true,
      id: program.uuid,
    };
  }
}

export class ProgramShuffleIteratorImpl<
  ProgramT extends CondensedChannelProgram,
> extends ShuffleProgramIterator<ProgramT> {
  constructor(
    programs: SlotSchedulerProgram[],
    random: Random,
    private minterFunc: (program: SlotSchedulerProgram) => ProgramT,
  ) {
    super(programs, random);
  }

  protected mint(program: SlotSchedulerProgram): ProgramT {
    return this.minterFunc(program);
  }
}

export class CustomProgramShuffleIterator extends ShuffleProgramIterator<CondensedCustomProgram> {
  private indexById!: Record<string, number>;

  constructor(
    private customShowId: string,
    programs: SlotSchedulerProgram[],
    random: Random,
  ) {
    super(programs, random);
    this.indexById = createIndexByIdMap(programs, customShowId);
  }

  protected mint(program: SlotSchedulerProgram): CondensedCustomProgram {
    return {
      customShowId: this.customShowId,
      duration: program.duration,
      id: program.uuid,
      index: this.indexById[program.uuid]!,
      persisted: true,
      type: 'custom',
    };
  }
}
