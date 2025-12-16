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
}

export abstract class BaseProgramIterator<
  ProgramT extends CondensedChannelProgram,
> implements ProgramIterator<ProgramT>
{
  protected mintCache = new Map<string, ProgramT>();

  constructor(protected programs: SlotSchedulerProgram[]) {}

  abstract current(state: IterationState): Nullable<ProgramT>;
  abstract next(): void;
  abstract reset(): void;
  protected abstract mint(program: SlotSchedulerProgram): ProgramT;
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
