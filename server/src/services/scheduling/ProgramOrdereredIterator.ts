import type {
  CondensedChannelProgram,
  CondensedContentProgram,
} from '@tunarr/types';
import type { CondensedCustomProgram } from '@tunarr/types/schemas';
import { orderBy } from 'lodash-es';
import { IndexBasedProgramIterator } from './ProgramIterator.ts';
import {
  createIndexByIdMap,
  type SlotSchedulerProgram,
} from './slotSchedulerUtil.ts';

/**
 * A {@link ProgramIterator} that handles {@link ContentProgram}s by iterating
 * them in a particular order. By default, the {@link getProgramOrder} ordering
 * is used.
 */

export abstract class ProgramOrdereredIterator<
  ProgramT extends CondensedChannelProgram,
> extends IndexBasedProgramIterator<ProgramT> {
  constructor(
    programs: SlotSchedulerProgram[],
    orderer: (program: SlotSchedulerProgram) => string | number,
    asc: boolean = true,
  ) {
    super(orderBy(programs, orderer, [asc ? 'asc' : 'desc']));
  }
}

export class ContentProgramOrderedIterator extends ProgramOrdereredIterator<CondensedContentProgram> {
  protected mint(program: SlotSchedulerProgram): CondensedContentProgram {
    return {
      type: 'content',
      duration: program.duration,
      persisted: true,
      id: program.uuid,
    };
  }
}

export class CustomProgramOrderedIterator extends ProgramOrdereredIterator<CondensedCustomProgram> {
  private indexById: Record<string, number> = {};
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
