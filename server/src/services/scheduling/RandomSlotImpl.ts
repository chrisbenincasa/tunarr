import type { FillerProgram } from '@tunarr/types';
import type { RandomSlot, RandomSlotDurationSpec } from '@tunarr/types/api';
import type { Random } from 'random-js';
import type { ProgramIterator } from './ProgramIterator.js';
import { SlotImpl } from './SlotImpl.js';

export class RandomSlotImpl extends SlotImpl<RandomSlot> {
  constructor(
    slot: RandomSlot,
    iterator: ProgramIterator,
    random: Random,
    fillerIteratorsByListId: Record<
      string,
      ProgramIterator<FillerProgram>
    > = {},
  ) {
    super(slot, iterator, random, fillerIteratorsByListId);
  }

  get cooldownMs() {
    return this.slot.cooldownMs;
  }

  get weight() {
    return this.slot.weight;
  }

  get durationSpec(): RandomSlotDurationSpec {
    return this.slot.durationSpec;
  }

  set durationSpec(spec: RandomSlotDurationSpec) {
    this.slot.durationSpec = spec;
  }

  get durationMs() {
    return this.slot.durationSpec.type === 'fixed'
      ? this.slot.durationSpec.durationMs
      : null;
  }
}
