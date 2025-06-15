import type { ChannelProgram, FillerProgram } from '@tunarr/types';
import type { FillerProgrammingSlot } from '@tunarr/types/api';
import { findIndex, isNil, last, maxBy, sortBy, sum } from 'lodash-es';
import type { Random } from 'random-js';
import type { NonEmptyArray } from 'ts-essentials';
import { match } from 'ts-pattern';
import type {
  IterationState,
  ProgramIterator,
  WeightedProgram,
} from './ProgramIterator.ts';

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
    if (idx === -1) {
      // No programs are the right duration.
      return null;
    }
    const endIdx = idx === 0 ? this.weightedPrograms.length - 1 : idx - 1;

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
