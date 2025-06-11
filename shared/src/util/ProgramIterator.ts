import type { ChannelProgram, ContentProgram } from '@tunarr/types';
import type { BaseSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { nth, orderBy, shuffle, slice } from 'lodash-es';
import type { StrictExclude } from 'ts-essentials';
import { random } from '../services/RandomSlotsService.js';
import { seq } from './index.js';

export interface ProgramIterator {
  current(): ChannelProgram | null;
  next(): void;
  reset(): void;
}

/**
 * A {@link ProgramIterator} that returns a single program repeatedly.
 */
export class StaticProgramIterator implements ProgramIterator {
  #program: ChannelProgram;

  constructor(program: ChannelProgram) {
    this.#program = program;
  }

  current(): ChannelProgram | null {
    return this.#program;
  }

  next(): void {}

  reset(): void {}
}

export class ProgramShuffler implements ProgramIterator {
  #programs: ChannelProgram[];
  #position: number = 0;

  constructor(programs: ChannelProgram[]) {
    this.#programs = shuffle(programs);
  }

  current() {
    return nth(this.#programs, this.#position) ?? null;
  }

  next() {
    this.#position++;
    if (this.#position >= this.#programs.length) {
      const mid = Math.floor(this.#programs.length / 2);
      this.#programs = [
        ...slice(this.#programs, 0, mid),
        ...slice(this.#programs, mid),
      ];
      this.#position = 0;
    }
  }

  reset(): void {
    this.#programs = shuffle(this.#programs);
    this.#position = 0;
  }
}

export class ProgramChunkedShuffle<ProgramType extends ChannelProgram>
  implements ProgramIterator
{
  #programs: ProgramType[];
  #position: number = 0;

  constructor(
    programs: ProgramType[],
    orderer: (program: ProgramType) => string | number,
    asc: boolean = true,
  ) {
    this.#programs = seq.rotateArray(
      orderBy(programs, orderer, [asc ? 'asc' : 'desc']),
      random.integer(0, programs.length),
    );
  }

  current(): ProgramType | null {
    return nth(this.#programs, this.#position) ?? null;
  }

  next(): void {
    this.#position = (this.#position + 1) % this.#programs.length;
  }

  reset(): void {
    this.#position = 0;
  }
}

/**
 * A {@link ProgramIterator} that handles {@link ContentProgram}s by iterating
 * them in a particular order. By default, the {@link getProgramOrder} ordering
 * is used.
 */
export class ProgramOrdereredIterator<ProgramType extends ChannelProgram>
  implements ProgramIterator
{
  #programs: ProgramType[];
  #position: number = 0;

  constructor(
    programs: ProgramType[],
    orderer: (program: ProgramType) => string | number,
    asc: boolean = true,
  ) {
    this.#programs = orderBy(programs, orderer, [asc ? 'asc' : 'desc']);
  }

  current(): ChannelProgram | null {
    return nth(this.#programs, this.#position) ?? null;
  }

  next(): void {
    this.#position = (this.#position + 1) % this.#programs.length;
  }

  reset(): void {
    this.#position = 0;
  }
}

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
  order: StrictExclude<BaseSlot['order'], 'shuffle' | 'ordered_shuffle'>,
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
export function slotIteratorKey<T extends BaseSlot>(slot: T) {
  switch (slot.programming.type) {
    case 'movie':
      return `movie_${slot.order}`;
    case 'show':
      return `tv_${slot.programming.showId}_${slot.order}`;
    case 'redirect':
      return `redirect_${slot.programming.channelId}_${slot.order}`;
    case 'custom-show':
      return `custom-show_${slot.programming.customShowId}_${slot.order}`;
    case 'flex':
      return null;
  }
}

export function getNextProgramForSlot<T extends BaseSlot>(
  slot: T,
  iterators: Record<string, ProgramIterator>,
  duration: number,
): ChannelProgram | null {
  switch (slot.programming.type) {
    case 'movie':
    case 'show':
    case 'redirect':
    case 'custom-show':
      return iterators[slotIteratorKey(slot)!].current();
    case 'flex':
      return {
        type: 'flex',
        duration,
        persisted: false,
      };
  }
}

export function advanceIterator<T extends BaseSlot>(
  slot: T,
  iterators: Record<string, ProgramIterator>,
) {
  switch (slot.programming.type) {
    case 'movie':
    case 'show':
    case 'redirect':
    case 'custom-show':
      iterators[slotIteratorKey(slot)!].next();
      return;
    case 'flex':
      return;
  }
}
