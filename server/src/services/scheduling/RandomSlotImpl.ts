import type { CondensedChannelProgram, FillerProgram } from '@tunarr/types';
import type { RandomSlot, RandomSlotDurationSpec } from '@tunarr/types/api';
import type { Random } from 'random-js';
import type { ProgramIterator } from './ProgramIterator.js';
import { SlotImpl } from './SlotImpl.js';

export class RandomSlotImpl<
  ProgramT extends CondensedChannelProgram = CondensedChannelProgram,
> extends SlotImpl<RandomSlot, ProgramT> {
  constructor(
    slot: RandomSlot,
    iterator: ProgramIterator<ProgramT>,
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
