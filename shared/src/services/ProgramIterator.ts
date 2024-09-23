import { ChannelProgram, ContentProgram, CustomProgram } from '@tunarr/types';
import { nth, shuffle, slice, sortBy } from 'lodash-es';
import { SlotLike } from './slotSchedulerUtil.js';

export interface ProgramIterator {
  current(): ChannelProgram | null;
  next(): void;
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
}

/**
 * A {@link ProgramIterator} that handles {@link ContentProgram}s by iterating
 * them in a particular order. By default, the {@link getProgramOrder} ordering
 * is used.
 */
export class ProgramOrderer implements ProgramIterator {
  #programs: ContentProgram[];
  #position: number = 0;

  constructor(
    programs: ContentProgram[],
    orderer: (program: ContentProgram) => string | number = getProgramOrder,
  ) {
    this.#programs = sortBy(programs, orderer);
  }

  current(): ChannelProgram | null {
    return nth(this.#programs, this.#position) ?? null;
  }
  next(): void {
    this.#position = (this.#position + 1) % this.#programs.length;
  }
}

export class CustomProgramOrderer implements ProgramIterator {
  #position: number = 0;

  constructor(private programs: CustomProgram[]) {
    this.programs = sortBy(programs, (p) => p.index);
  }

  current(): ChannelProgram | null {
    return nth(this.programs, this.#position) ?? null;
  }

  next(): void {
    this.#position = (this.#position + 1) % this.programs.length;
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
export function slotIteratorKey(slot: SlotLike) {
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

export function getNextProgramForSlot(
  slot: SlotLike,
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

export function advanceIterator(
  slot: SlotLike,
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
