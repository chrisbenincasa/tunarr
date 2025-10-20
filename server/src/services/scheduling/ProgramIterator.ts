import type {
  ChannelProgram,
  ContentProgram,
  FillerProgram,
} from '@tunarr/types';
import type { BaseSlot, FillerProgrammingSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import type { Nullable } from '../../types/util.ts';
import type { SlotIteratorKey } from './slotSchedulerUtil.js';

export type IterationState = {
  slotDuration: number; // ms
  timeCursor: number; // ms since epoch
};

export interface ProgramIterator<
  ProgramT extends ChannelProgram = ChannelProgram,
> {
  current(state: IterationState): Nullable<ProgramT>;
  next(): void;
  reset(): void;
}

export type WeightedProgram = {
  program: FillerProgram;
  originalWeight: number;
  currentWeight: number;
};

function programOrdererNext(program: ContentProgram) {
  switch (program.subtype) {
    case 'movie':
    case 'music_video':
    case 'other_video':
      return +dayjs(program.date);
    case 'episode':
      // Hacky thing from original code...
      return program.seasonNumber! * 1e5 + program.episodeNumber!;
    case 'track':
      // A-z for now
      return program.title;
  }
}

function programOrdererAlpha(program: ContentProgram) {
  switch (program.subtype) {
    case 'movie':
    case 'music_video':
    case 'other_video':
      return program.title;
    case 'episode':
      return `${program.parent?.title ?? ''}_${program.title}`;
    case 'track':
      return `${program.parent?.title ?? ''}_${program.title}`;
  }
}

function programOrdererChronological(program: ContentProgram) {
  return +dayjs(program.date);
}

type ProgramOrderer = (program: ContentProgram) => string | number;

export function getProgramOrderer(
  order: 'next' | 'alphanumeric' | 'chronological',
): (program: ContentProgram) => string | number {
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
