import { seq } from '@tunarr/shared/util';
import type {
  CondensedChannelProgram,
  CondensedContentProgram,
} from '@tunarr/types';
import type { CondensedCustomProgram } from '@tunarr/types/schemas';
import { orderBy } from 'lodash-es';
import { IndexBasedProgramIterator } from './ProgramIterator.js';
import { random } from './RandomSlotsService.ts';
import {
  createIndexByIdMap,
  type SlotSchedulerProgram,
} from './slotSchedulerUtil.ts';

export abstract class ProgramChunkedShuffle<
  ProgramT extends CondensedChannelProgram,
> extends IndexBasedProgramIterator<ProgramT> {
  constructor(
    programs: SlotSchedulerProgram[],
    orderer: (program: SlotSchedulerProgram) => string | number,
    asc: boolean = true,
  ) {
    super(
      seq.rotateArray(
        orderBy(programs, orderer, [asc ? 'asc' : 'desc']),
        random.integer(0, programs.length),
      ),
    );
  }
}

export class ContentProgramChunkedShuffle extends ProgramChunkedShuffle<CondensedContentProgram> {
  protected mint(program: SlotSchedulerProgram): CondensedContentProgram {
    return {
      type: 'content',
      duration: program.duration,
      persisted: true,
      id: program.uuid,
    };
  }
}

export class CustomProgramChunkedShuffle extends ProgramChunkedShuffle<CondensedCustomProgram> {
  private indexById!: Record<string, number>;

  constructor(
    private customShowId: string,
    programs: SlotSchedulerProgram[],
    asc: boolean = true,
  ) {
    const indexById = createIndexByIdMap(programs, customShowId);
    super(programs, (program) => indexById[program.uuid] ?? -1, asc);
    this.indexById = indexById;
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
