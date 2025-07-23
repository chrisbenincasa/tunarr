import { seq } from '@tunarr/shared/util';
import type {
  ChannelProgram,
  ContentProgram,
  FillerProgram,
  FlexProgram,
} from '@tunarr/types';
import type { BaseSlot, FillerProgrammingSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import {
  findIndex,
  isNil,
  last,
  maxBy,
  nth,
  orderBy,
  shuffle,
  slice,
  sortBy,
  sum,
} from 'lodash-es';
import type { Random } from 'random-js';
import type { NonEmptyArray } from 'ts-essentials';
import { match } from 'ts-pattern';
import { random } from './RandomSlotsService.js';
import type { SlotIteratorKey } from './slotSchedulerUtil.js';

type IterationState = {
  slotDuration: number; // ms
  timeCursor: number; // ms since epoch
};

export interface ProgramIterator {
  current(state: IterationState): ChannelProgram | null;
  next(): void;
  reset(): void;
}

/**
 * A {@link ProgramIterator} that returns a single program repeatedly.
 */
export class StaticProgramIterator implements ProgramIterator {
  constructor(protected program: ChannelProgram) {}

  current(_state: IterationState): ChannelProgram | null {
    return this.program;
  }

  next(): void {}

  reset(): void {}
}

export class FlexProgramIterator extends StaticProgramIterator {
  constructor(flexProgram: FlexProgram) {
    super(flexProgram);
  }

  current({ slotDuration }: IterationState): ChannelProgram | null {
    return {
      ...this.program,
      duration: slotDuration,
    };
  }
}

export class ProgramShuffler implements ProgramIterator {
  #programs: ChannelProgram[];
  #position: number = 0;

  constructor(
    programs: ChannelProgram[],
    private random: Random,
  ) {
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
    this.#programs = this.random.shuffle(this.#programs);
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

type WeightedProgram = {
  program: FillerProgram;
  originalWeight: number;
  currentWeight: number;
};

export class FillerProgramIterator implements ProgramIterator {
  private weightedPrograms: NonEmptyArray<WeightedProgram>;
  private lastSeenTimestampById = new Map<string, number>();
  private weightsById = new Map<string, number>();

  constructor(
    programs: NonEmptyArray<FillerProgram>,
    private slotDef: FillerProgrammingSlot,
    private random: Random,
    private decayFactor: number = slotDef.decayFactor,
    private resetRate: number = slotDef.recoveryFactor,
  ) {
    const maxDuration = maxBy(programs, (p) => p.duration)!.duration;
    const rawWeights = match([
      this.slotDef.order,
      this.slotDef.durationWeighting,
    ])
      .with(['shuffle_prefer_short', 'linear'], () =>
        programs.map((p) => maxDuration - p.duration + 1),
      )
      .with(['shuffle_prefer_short', 'log'], () =>
        programs.map((p) => Math.log(1 / p.duration)),
      )
      .with(['shuffle_prefer_long', 'linear'], () =>
        programs.map((p) => p.duration),
      )
      .with(['shuffle_prefer_long', 'log'], () =>
        programs.map((p) => Math.log(p.duration)),
      )
      .otherwise(() => {
        throw new Error('Invalid slot configuration');
      });

    const weightSum = sum(rawWeights);
    const normalizedWeights = rawWeights.map((weight) => weight / weightSum);
    programs.forEach((p, idx) => {
      this.weightsById.set(p.id, normalizedWeights[idx]);
    });
    // TODO: Precalculate slices because we know all of the relevant
    // slot lengths at creation time. Then we don't have to calculate
    // the correct slices each time.
    this.weightedPrograms = sortBy(programs, (p) => p.duration).map(
      (p, i) =>
        ({
          program: p,
          currentWeight: normalizedWeights[i],
          originalWeight: normalizedWeights[i],
        }) satisfies WeightedProgram,
    ) as NonEmptyArray<WeightedProgram>;
  }

  current(state: IterationState): ChannelProgram | null {
    const idx = findIndex(
      this.weightedPrograms,
      ({ program }) => program.duration > state.slotDuration,
    );
    if (idx === 0) {
      // No programs are the right duration.
      return null;
    }
    const endIdx = idx === -1 ? this.weightedPrograms.length - 1 : idx - 1;

    const programsToConsider = this.weightedPrograms
      .slice(0, endIdx)
      .filter(({ program }) => {
        const lastSeen = this.lastSeenTimestampById.get(program.id);
        if (
          !isNil(lastSeen) &&
          state.timeCursor - lastSeen < state.slotDuration
        ) {
          return false;
        }
        return true;
      });

    let sumWeight = 0;
    const cumulativeWeights: number[] = [];
    for (const { currentWeight } of programsToConsider) {
      sumWeight += currentWeight;
      cumulativeWeights.push(sumWeight);
    }

    const targetWeight = this.random.real(0, sumWeight, false);
    for (let i = 0; i < cumulativeWeights.length; i++) {
      const program = programsToConsider[i];
      if (targetWeight < cumulativeWeights[i]) {
        this.lastSeenTimestampById.set(program.program.id, state.timeCursor);
        program.currentWeight *= this.decayFactor;
        return program.program;
      }
    }

    return last(programsToConsider)?.program ?? null;
  }

  next(): void {
    for (const program of this.weightedPrograms) {
      program.currentWeight = Math.min(
        program.originalWeight,
        program.currentWeight +
          (program.originalWeight - program.currentWeight) * this.resetRate,
      );
    }
  }

  reset(): void {
    for (const program of this.weightedPrograms) {
      program.currentWeight = program.originalWeight;
    }
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
      return `redirect_${slot.channelId}_${slot.order}`;
    case 'custom-show':
      return `custom-show_${slot.customShowId}_${slot.order}`;
    case 'filler':
      return `filler_${slot.fillerListId}_${slot.order}`;
    case 'flex':
      return 'flex';
  }
}

export function getNextProgramForSlot<T extends BaseSlot>(
  slot: T,
  iterators: Record<SlotIteratorKey, ProgramIterator>,
  state: IterationState,
): ChannelProgram | null {
  switch (slot.type) {
    case 'movie':
    case 'show':
    case 'redirect':
    case 'custom-show':
    case 'filler':
    case 'flex':
      return iterators[slotIteratorKey(slot)].current(state);
  }
}

export function advanceIterator<T extends BaseSlot>(
  slot: T,
  iterators: Record<SlotIteratorKey, ProgramIterator>,
) {
  switch (slot.type) {
    case 'movie':
    case 'show':
    case 'redirect':
    case 'custom-show':
    case 'filler':
    case 'flex':
      iterators[slotIteratorKey(slot)].next();
      return;
  }
}
