import type { CondensedChannelProgram, FillerProgram } from '@tunarr/types';
import type { TimeSlot } from '@tunarr/types/api';
import type { Random } from 'random-js';
import type { ProgramIterator } from './ProgramIterator.js';
import { SlotImpl } from './SlotImpl.js';

export class TimeSlotImpl<
  ProgramT extends CondensedChannelProgram,
> extends SlotImpl<TimeSlot, ProgramT> {
  constructor(
    slot: TimeSlot,
    iterator: ProgramIterator<ProgramT>,
    random: Random,
    fillerIteratorsByListId: Record<
      string,
      ProgramIterator<FillerProgram>
    > = {},
  ) {
    super(slot, iterator, random, fillerIteratorsByListId);
  }

  get startTime() {
    return this.slot.startTime;
  }
}
