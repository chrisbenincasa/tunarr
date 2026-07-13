import type { CondensedChannelProgram } from '@tunarr/types';
import type { BaseSlot, FillerProgrammingSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { nth } from 'lodash-es';
import type { Nullable } from '../../types/util.ts';
import type {
  SlotIteratorKey,
  SlotSchedulerProgram,
} from './slotSchedulerUtil.js';

export type IterationState = {
  slotDuration: number; // ms
  timeCursor: number; // ms since epoch
};

export interface ProgramIterator<
  ProgramT extends CondensedChannelProgram = CondensedChannelProgram,
> {
  current(state: IterationState): Nullable<ProgramT>;
  next(): void;
  reset(): void;
  fork(): ProgramIterator<ProgramT>;
}

abstract class BaseProgramIterator<ProgramT extends CondensedChannelProgram>
  implements ProgramIterator<ProgramT>
{
  protected mintCache = new Map<string, ProgramT>();

  constructor(protected programs: SlotSchedulerProgram[]) {}

  abstract current(state: IterationState): Nullable<ProgramT>;
  abstract next(): void;
  abstract reset(): void;
  protected abstract mint(program: SlotSchedulerProgram): ProgramT;

  fork(): ProgramIterator<ProgramT> {
    return this;
  }
}

export abstract class IndexBasedProgramIterator<
  ProgramT extends CondensedChannelProgram,
> extends BaseProgramIterator<ProgramT> {
  protected position: number = 0;

  current(): ProgramT | null {
    const curr = nth(this.programs, this.position);
    if (!curr) {
      return null;
    }
    const cached = this.mintCache.get(curr.uuid);
    if (cached) {
      return cached;
    }
    const minted = this.mint(curr);
    this.mintCache.set(curr.uuid, minted);
    return minted;
  }

  next(): void {
    this.position = (this.position + 1) % this.programs.length;
  }

  reset(): void {
    this.position = 0;
  }
}

export class RerunProgramIterator<
  ProgramT extends CondensedChannelProgram = CondensedChannelProgram,
> implements ProgramIterator<ProgramT>
{
  #consumedCount = 0;

  constructor(
    private inner: ProgramIterator<ProgramT>,
    private groupSize: number,
  ) {}

  current(state: IterationState): ProgramT | null {
    return this.inner.current(state);
  }

  next(): void {
    this.#consumedCount++;
    if (this.#consumedCount >= this.groupSize) {
      this.inner.next();
      this.#consumedCount = 0;
    }
  }

  reset(): void {
    this.#consumedCount = 0;
    this.inner.reset();
  }

  fork(): ProgramIterator<ProgramT> {
    return this;
  }
}

// Dummy state used when calling current() from next() for recording.
// Safe because content iterators (IndexBasedProgramIterator) ignore the state
// param. Only FlexProgramIterator and WeightedFillerProgramIterator use it,
// and neither appears as the main iterator in a linked group.
const DummyIterationState: IterationState = {
  slotDuration: 0,
  timeCursor: 0,
};

/**
 * Wraps a base iterator for "continue" slots in a mixed-mode group.
 * Delegates current()/next() to the inner iterator while recording each
 * consumed program into a per-period buffer that ReplayProgramIterator
 * reads from.
 */
export class RecordingProgramIterator<
  ProgramT extends CondensedChannelProgram = CondensedChannelProgram,
> implements ProgramIterator<ProgramT>
{
  #periodBuffer: ProgramT[] = [];

  constructor(private inner: ProgramIterator<ProgramT>) {}

  current(state: IterationState): ProgramT | null {
    return this.inner.current(state);
  }

  next(): void {
    const curr = this.inner.current(DummyIterationState);
    if (curr !== null) {
      this.#periodBuffer.push(curr);
    }
    this.inner.next();
  }

  reset(): void {
    this.#periodBuffer = [];
    this.inner.reset();
  }

  resetPeriod(): void {
    this.#periodBuffer = [];
  }

  get periodBuffer(): readonly ProgramT[] {
    return this.#periodBuffer;
  }

  fork(): ProgramIterator<ProgramT> {
    return this;
  }
}

/**
 * Used by "rerun" slots in a mixed-mode group. Replays programs from the
 * RecordingProgramIterator's buffer using its own cursor.
 *
 * When the buffer is exhausted:
 * - overflowMode 'flex': returns null (caller fills with flex)
 * - overflowMode 'continue': delegates to the recording iterator,
 *   advancing the shared base iterator
 */
export class ReplayProgramIterator<
  ProgramT extends CondensedChannelProgram = CondensedChannelProgram,
> implements ProgramIterator<ProgramT>
{
  #replayCursor = 0;
  #overflowed = false;

  constructor(
    private recorder: RecordingProgramIterator<ProgramT>,
    private overflowMode: 'flex' | 'continue' = 'flex',
  ) {}

  current(state: IterationState): ProgramT | null {
    const buffer = this.recorder.periodBuffer;
    if (this.#replayCursor < buffer.length) {
      return buffer[this.#replayCursor] ?? null;
    }

    if (this.overflowMode === 'continue') {
      this.#overflowed = true;
      return this.recorder.current(state);
    }

    return null;
  }

  next(): void {
    const buffer = this.recorder.periodBuffer;
    if (this.#replayCursor < buffer.length) {
      this.#replayCursor++;
      return;
    }

    if (this.overflowMode === 'continue' && this.#overflowed) {
      this.recorder.next();
    }
  }

  reset(): void {
    this.#replayCursor = 0;
    this.#overflowed = false;
  }

  resetPeriod(): void {
    this.#replayCursor = 0;
    this.#overflowed = false;
  }

  fork(): ProgramIterator<ProgramT> {
    return this;
  }
}

export type WeightedProgram = {
  program: SlotSchedulerProgram;
  originalWeight: number;
  currentWeight: number;
};

function programOrdererNext(program: SlotSchedulerProgram) {
  switch (program.type) {
    case 'movie':
    case 'music_video':
    case 'other_video':
      return +dayjs(program.originalAirDate);
    case 'episode': {
      // Hacky thing from original code...
      const seasonNumber = program.season?.index ?? program.seasonNumber ?? 1;
      const episodeNumber = program.episode ?? 1;
      return seasonNumber * (1e5 + episodeNumber);
    }
    case 'track':
      // A-z for now
      return program.title;
  }
}

function programOrdererAlpha(program: SlotSchedulerProgram) {
  switch (program.type) {
    case 'movie':
    case 'music_video':
    case 'other_video':
      return program.title;
    case 'episode':
      return `${program.show?.title ?? ''}_${program.title}`;
    case 'track':
      return `${program.artist?.title ?? ''}_${program.title}`;
  }
}

function programOrdererChronological(program: SlotSchedulerProgram) {
  return +dayjs(program.originalAirDate);
}

type ProgramOrderer = (program: SlotSchedulerProgram) => string | number;

export function getProgramOrderer(
  order: 'next' | 'alphanumeric' | 'chronological',
): (program: SlotSchedulerProgram) => string | number {
  let orderer: ProgramOrderer;
  switch (order) {
    case 'next':
      orderer = programOrdererNext;
      break;
    case 'alphanumeric':
      orderer = programOrdererAlpha;
      break;
    case 'chronological':
      orderer = programOrdererChronological;
      break;
  }

  return orderer;
}

// There is probably a way to make this typesafe by asserting the
// programming subtype, but I haven't figured it out yet.
export function slotIteratorKey<T extends BaseSlot>(slot: T): SlotIteratorKey {
  switch (slot.type) {
    case 'movie':
      return `movie_${slot.order}`;
    case 'show':
      return `tv_${slot.showId}_${slot.order}`;
    case 'redirect':
      return `redirect_${slot.channelId}`;
    case 'custom-show':
      return `custom-show_${slot.customShowId}_${slot.order}`;
    case 'filler':
      return `filler_${slot.fillerListId}_${slot.order}`;
    case 'smart-collection':
      return `smart_collection_${slot.smartCollectionId}_${slot.order}`;
    case 'flex':
      return 'flex';
  }
}

export function fillerSlotIteratorKey(
  fillerListId: string,
  order: FillerProgrammingSlot['order'],
): SlotIteratorKey {
  return `filler_${fillerListId}_${order}`;
}
