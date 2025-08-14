import type { ChannelProgram, FillerProgram } from '@tunarr/types';
import type { BaseSlot, SlotFillerTypes } from '@tunarr/types/api';
import { isEmpty, some } from 'lodash-es';
import type { Random } from 'random-js';
import type { Nullable } from '../../types/util.ts';
import type { IterationState, ProgramIterator } from './ProgramIterator.js';
import { slotMayHaveFiller } from './slotSchedulerUtil.js';

export abstract class SlotImpl<SlotType extends BaseSlot> {
  protected fillerIteratorsByType: Record<
    SlotFillerTypes,
    ProgramIterator<FillerProgram>[]
  > = {
    head: [],
    post: [],
    pre: [],
    tail: [],
    fallback: [],
  };

  constructor(
    protected slot: SlotType,
    private iterator: ProgramIterator,
    private random: Random,
    private fillerIteratorsByListId: Record<
      string,
      ProgramIterator<FillerProgram>
    > = {},
  ) {
    if (slotMayHaveFiller(this.slot) && this.slot.filler) {
      for (const filler of this.slot.filler) {
        if (!this.fillerIteratorsByListId[filler.fillerListId]) {
          continue;
        }

        const it = this.fillerIteratorsByListId[filler.fillerListId];

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

  getNextProgram(state: IterationState): ChannelProgram | null {
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
    if (filler) {
      it.next();
    }
    return filler;
  }

  hasFillerOfType(type: SlotFillerTypes) {
    const its = this.fillerIteratorsByType?.[type];
    return !isEmpty(its);
  }

  hasAnyFillerSettings() {
    return some(this.fillerIteratorsByType, (v) => !isEmpty(v));
  }

  get type() {
    return this.slot.type;
  }
}
