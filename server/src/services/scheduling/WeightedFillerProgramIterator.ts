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
  private weightsById = new Map<string, number>();
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
      this.weightsById.set(p.uuid, normalizedWeights[idx]!);
    });
    // TODO: Precalculate slices because we know all of the relevant
    // slot lengths at creation time. Then we don't have to calculate
    // the correct slices each time.
    this.weightedPrograms = sortBy(programs, (p) => p.duration).map(
      (p, i) =>
        ({
          program: p,
          currentWeight: normalizedWeights[i]!,
          originalWeight: normalizedWeights[i]!,
        }) satisfies WeightedProgram,
    ) as NonEmptyArray<WeightedProgram>;
  }

  current(state: IterationState): Nullable<FillerProgram> {
    let idx = 0;
    if (state.slotDuration > this.maxDuration) {
      idx = this.weightedPrograms.length - 1;
    } else {
      while (idx < this.weightedPrograms.length) {
        if (this.weightedPrograms[idx]!.program.duration > state.slotDuration) {
          break;
        }
        idx++;
      }
    }

    const programsToConsider = this.weightedPrograms
      .slice(0, idx)
      .filter(({ program }) => {
        const lastSeen = this.lastSeenTimestampById.get(program.uuid);
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
      const program = programsToConsider[i]!;
      if (targetWeight < cumulativeWeights[i]!) {
        this.lastSeenTimestampById.set(program.program.uuid, state.timeCursor);
        program.currentWeight *= this.decayFactor;
        return {
          type: 'filler',
          duration: program.program.duration,
          fillerListId: this.slotDef.fillerListId,
          id: program.program.uuid,
          persisted: true,
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
      persisted: true,
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
