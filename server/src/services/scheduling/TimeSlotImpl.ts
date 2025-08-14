import type { FillerProgram } from '@tunarr/types';
import type { TimeSlot } from '@tunarr/types/api';
import type { Random } from 'random-js';
import type { ProgramIterator } from './ProgramIterator.js';
import { SlotImpl } from './SlotImpl.js';

export class TimeSlotImpl extends SlotImpl<TimeSlot> {
  constructor(
    slot: TimeSlot,
    iterator: ProgramIterator,
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
