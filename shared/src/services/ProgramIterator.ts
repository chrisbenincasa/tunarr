import { ChannelProgram, ContentProgram } from '@tunarr/types';
import { BaseSlot } from '@tunarr/types/api';
import { nth, shuffle, slice, sortBy } from 'lodash-es';
import { seq } from '../util/index.js';
import { random } from './randomSlotsService.js';

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
  ) {
    this.#programs = seq.rotateArray(
      sortBy(programs, orderer),
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
  ) {
    this.#programs = sortBy(programs, orderer);
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

export function getProgramOrder(program: ContentProgram): string | number {
  switch (program.subtype) {
    case 'movie':
      // A-z for now
      return program.title;
    case 'episode':
      // Hacky thing from original code...
      return program.seasonNumber! * 1e5 + program.episodeNumber!;
    case 'track':
      // A-z for now
      return program.title;
  }
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
