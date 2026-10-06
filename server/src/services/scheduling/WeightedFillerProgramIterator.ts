import type { FillerProgram } from '@tunarr/types';
import type { FillerProgrammingSlot, SlotFillerTypes } from '@tunarr/types/api';
import { isNil, last, maxBy, sortBy, sum } from 'lodash-es';
import type { Random } from 'random-js';
import type { NonEmptyArray } from 'ts-essentials';
import { match } from 'ts-pattern';
import type { Maybe, Nullable } from '../../types/util.ts';
import type {
  IterationState,
  ProgramIterator,
  WeightedProgram,
} from './ProgramIterator.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.ts';

export class WeightedFillerProgramIterator
  implements ProgramIterator<FillerProgram>
{
  private weightedPrograms: NonEmptyArray<WeightedProgram>;
  private lastSeenTimestampById = new Map<string, number>();
  // Optimization to skip the loop below.
  private maxDuration: number;

  constructor(
    programs: NonEmptyArray<SlotSchedulerProgram>,
    private slotDef: FillerProgrammingSlot,
    private random: Random,
    private fillerType: Maybe<SlotFillerTypes> = undefined,
    private decayFactor: number = slotDef.decayFactor,
    private resetRate: number = slotDef.recoveryFactor,
  ) {
    this.maxDuration = maxBy(programs, (p) => p.duration)!.duration;
    const rawWeights = match([
      this.slotDef.order,
      this.slotDef.durationWeighting,
    ])
      .with(['shuffle_prefer_short', 'linear'], () =>
        programs.map((p) => this.maxDuration - p.duration + 1),
      )
      .with(['shuffle_prefer_short', 'log'], () =>
        // log(1 / duration) is negative for every duration in ms, and
        // normalizing by that negative sum ordered the weights by
        // log(duration), which is the prefer_long shape. This keeps them
        // positive and ordered by how much shorter than the longest
        // program each one is.
        programs.map((p) => Math.log(1 + this.maxDuration / p.duration)),
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
    // TODO: Precalculate slices because we know all of the relevant
    // slot lengths at creation time. Then we don't have to calculate
    // the correct slices each time.
    //
    // Sort the programs together with their weights: current() walks this
    // array in duration order for its cutoff, and the weights are computed
    // in the caller's order, so sorting the programs on their own paired
    // them with the wrong weights.
    this.weightedPrograms = sortBy(
      programs.map((p, idx) => ({ p, weight: normalizedWeights[idx]! })),
      (entry) => entry.p.duration,
    ).map(
      ({ p, weight }) =>
        ({
          program: p,
          currentWeight: weight,
          originalWeight: weight,
        }) satisfies WeightedProgram,
    ) as NonEmptyArray<WeightedProgram>;
  }

  private static fromState(
    weightedPrograms: NonEmptyArray<WeightedProgram>,
    lastSeenTimestampById: Map<string, number>,
    maxDuration: number,
    slotDef: FillerProgrammingSlot,
    random: Random,
    fillerType: Maybe<SlotFillerTypes>,
    decayFactor: number,
    resetRate: number,
  ): WeightedFillerProgramIterator {
    const instance = Object.create(
      WeightedFillerProgramIterator.prototype,
    ) as WeightedFillerProgramIterator;
    instance.weightedPrograms = weightedPrograms;
    instance.lastSeenTimestampById = lastSeenTimestampById;
    instance.maxDuration = maxDuration;
    instance.slotDef = slotDef;
    instance.random = random;
    instance.fillerType = fillerType;
    instance.decayFactor = decayFactor;
    instance.resetRate = resetRate;
    return instance;
  }

  fork(): ProgramIterator<FillerProgram> {
    const copiedPrograms = this.weightedPrograms.map((wp) => ({
      program: wp.program,
      currentWeight: wp.currentWeight,
      originalWeight: wp.originalWeight,
    })) as NonEmptyArray<WeightedProgram>;

    return WeightedFillerProgramIterator.fromState(
      copiedPrograms,
      // Forks share this map, so a program aired by any of them is on
      // cooldown for all. Each fork still keeps its own weights.
      this.lastSeenTimestampById,
      this.maxDuration,
      this.slotDef,
      this.random,
      this.fillerType,
      this.decayFactor,
      this.resetRate,
    );
  }

  current(state: IterationState): Nullable<FillerProgram> {
    let idx = 0;
    if (state.slotDuration < 0 || state.slotDuration > this.maxDuration) {
      idx = this.weightedPrograms.length;
    } else {
      while (idx < this.weightedPrograms.length) {
        if (this.weightedPrograms[idx]!.program.duration > state.slotDuration) {
          break;
        }
        idx++;
      }
    }

    const cooldown = state.cooldownMs ?? state.slotDuration;
    const programsToConsider = this.weightedPrograms
      .slice(0, idx)
      .filter(({ program }) => {
        const lastSeen = this.lastSeenTimestampById.get(program.uuid);
        if (!isNil(lastSeen) && state.timeCursor - lastSeen < cooldown) {
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
      const program = programsToConsider[i]!;
      if (targetWeight < cumulativeWeights[i]!) {
        this.lastSeenTimestampById.set(program.program.uuid, state.timeCursor);
        program.currentWeight *= this.decayFactor;
        return {
          type: 'filler',
          duration: program.program.duration,
          fillerListId: this.slotDef.fillerListId,
          id: program.program.uuid,
          fillerType: this.fillerType,
        };
      }
    }

    const p = last(programsToConsider)?.program;
    if (!p) {
      return null;
    }

    return {
      type: 'filler',
      duration: p.duration,
      fillerListId: this.slotDef.fillerListId,
      id: p.uuid,
      fillerType: this.fillerType,
    };
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
