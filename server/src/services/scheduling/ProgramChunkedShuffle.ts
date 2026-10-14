import { seq } from '@tunarr/shared/util';
import type {
  CondensedChannelProgram,
  CondensedContentProgram,
} from '@tunarr/types';
import type { CondensedCustomProgram } from '@tunarr/types/schemas';
import { orderBy } from 'lodash-es';
import type { Random } from 'random-js';
import { IndexBasedProgramIterator } from './ProgramIterator.js';
import type { ProgramIteratorSnapshot } from './slotIteratorState.ts';
import {
  createIndexByIdMap,
  type SlotSchedulerProgram,
} from './slotSchedulerUtil.ts';

abstract class ProgramChunkedShuffle<
  ProgramT extends CondensedChannelProgram,
> extends IndexBasedProgramIterator<ProgramT> {
  constructor(
    programs: SlotSchedulerProgram[],
    orderer: (program: SlotSchedulerProgram) => string | number,
    random: Random,
    asc: boolean = true,
    resume?: ProgramIteratorSnapshot,
  ) {
    const sorted = orderBy(programs, orderer, [asc ? 'asc' : 'desc']);

    // Resuming keeps the sorted order and skips the random rotation, since a
    // rotation does not change which program follows which.
    const canResume =
      resume?.type === 'ordered' &&
      sorted.some((program) => program.uuid === resume.lastProgramId);
    super(
      canResume
        ? sorted
        : seq.rotateArray(sorted, random.integer(0, programs.length)),
    );
    if (canResume) {
      this.resumeAfter(resume.lastProgramId);
    }
  }
}

export class ContentProgramChunkedShuffle extends ProgramChunkedShuffle<CondensedContentProgram> {
  protected mint(program: SlotSchedulerProgram): CondensedContentProgram {
    return {
      type: 'content',
      duration: program.duration,
      id: program.uuid,
    };
  }
}

export class CustomProgramChunkedShuffle extends ProgramChunkedShuffle<CondensedCustomProgram> {
  private indexById!: Record<string, number>;

  constructor(
    private customShowId: string,
    programs: SlotSchedulerProgram[],
    random: Random,
    asc: boolean = true,
    resume?: ProgramIteratorSnapshot,
  ) {
    const indexById = createIndexByIdMap(programs, customShowId);
    super(
      programs,
      (program) => indexById[program.uuid] ?? -1,
      random,
      asc,
      resume,
    );
    this.indexById = indexById;
  }

  protected mint(program: SlotSchedulerProgram): CondensedCustomProgram {
    return {
      customShowId: this.customShowId,
      duration: program.duration,
      id: program.uuid,
      index: this.indexById[program.uuid]!,
      type: 'custom',
    };
  }
}
