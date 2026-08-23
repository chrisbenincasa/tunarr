import type { CondensedChannelProgram, FillerProgram } from '@tunarr/types';
import {
  slotHasFiller,
  type BaseSlot,
  type MidRollConfig,
  type SlotFillerTypes,
} from '@tunarr/types/api';
import { isEmpty, some } from 'lodash-es';
import type { Random } from 'random-js';
import type { Nullable } from '../../types/util.ts';
import type { IterationState, ProgramIterator } from './ProgramIterator.js';

/**
 * A negative or non-finite {@link IterationState#slotDuration} is the caller's
 * way of saying "pick anything" (fallback filler), so only a finite,
 * non-negative budget constrains the pick.
 */
function fillerFitsAvailableTime(
  filler: FillerProgram,
  state: IterationState,
): boolean {
  if (!Number.isFinite(state.slotDuration) || state.slotDuration < 0) {
    return true;
  }
  return filler.duration <= state.slotDuration;
}

export abstract class SlotImpl<
  SlotType extends BaseSlot,
  ProgramT extends CondensedChannelProgram = CondensedChannelProgram,
> {
  protected fillerIteratorsByType: Record<
    SlotFillerTypes,
    ProgramIterator<FillerProgram>[]
  > = {
    head: [],
    post: [],
    pre: [],
    tail: [],
    fallback: [],
    mid: [],
  };

  constructor(
    protected slot: SlotType,
    private iterator: ProgramIterator<ProgramT>,
    private random: Random,
    private fillerIteratorsByListId: Record<
      string,
      ProgramIterator<FillerProgram>
    > = {},
  ) {
    if (slotHasFiller(this.slot) && this.slot.filler) {
      for (const filler of this.slot.filler) {
        const it = this.fillerIteratorsByListId[filler.fillerListId];
        if (!it) {
          continue;
        }

        for (const type of filler.types) {
          if (this.fillerIteratorsByType[type]) {
            this.fillerIteratorsByType[type].push(it);
          } else {
            this.fillerIteratorsByType[type] = [it];
          }
        }
      }
    }
  }

  getNextProgram(state: IterationState): ProgramT | null {
    return this.iterator.current(state);
  }

  advanceIterator(): void {
    return this.iterator.next();
  }

  getFillerOfType(
    type: SlotFillerTypes,
    state: IterationState,
  ): Nullable<FillerProgram> {
    const its = this.fillerIteratorsByType?.[type];
    if (!its || isEmpty(its)) {
      return null;
    }

    // Random pick right now
    const it = this.random.pick(its);
    const filler = it.current(state);
    if (!filler) {
      return null;
    }

    it.next();

    // Not every iterator constrains its picks by the available time (index
    // based orderings such as "uniform" hand back whatever is next in the
    // shuffle). Reject an item that doesn't fit so it can't overflow the slot
    // -- the iterator has already advanced, so a retry gets a new candidate.
    if (!fillerFitsAvailableTime(filler, state)) {
      return null;
    }

    return { ...filler, fillerType: type };
  }

  hasFillerOfType(type: SlotFillerTypes) {
    const its = this.fillerIteratorsByType?.[type];
    return !isEmpty(its);
  }

  hasAnyFillerSettings() {
    return some(this.fillerIteratorsByType, (v) => !isEmpty(v));
  }

  getMidFillerListIds(): string[] {
    if (!slotHasFiller(this.slot) || !this.slot.filler) return [];
    return this.slot.filler
      .filter((f) => f.types.includes('mid'))
      .map((f) => f.fillerListId);
  }

  get midRollConfig(): MidRollConfig | undefined {
    if (slotHasFiller(this.slot)) {
      return this.slot.midRoll;
    }
    return undefined;
  }

  get type() {
    return this.slot.type;
  }
}
