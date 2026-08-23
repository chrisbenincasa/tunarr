import { MersenneTwister19937, Random } from 'random-js';
import { describe, expect, test } from 'vitest';
import { createFakeProgramOrm } from '../../testing/fakes/entityCreators.ts';
import { ContentProgramShuffleIterator } from './ShuffleProgramIterator.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.ts';

function makePrograms(count: number): SlotSchedulerProgram[] {
  return Array.from({ length: count }, (_, i) => ({
    ...createFakeProgramOrm({
      uuid: `p${i}`,
      title: `Program ${i}`,
      type: 'movie',
      duration: 30_000,
    }),
    parentFillerLists: [],
    parentCustomShows: [],
    parentSmartCollections: [],
  }));
}

describe('ShuffleProgramIterator', () => {
  function collect(count: number, seed: number = 42): string[] {
    const iterator = new ContentProgramShuffleIterator(
      makePrograms(8),
      new Random(MersenneTwister19937.seed(seed)),
    );
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const program = iterator.current();
      expect(program).not.toBeNull();
      out.push(program!.id);
      iterator.next();
    }
    return out;
  }

  test('reshuffles on wrap instead of replaying the same order', () => {
    const picks = collect(24);
    const [first, second, third] = [
      picks.slice(0, 8),
      picks.slice(8, 16),
      picks.slice(16, 24),
    ];

    // Every pass is a full permutation of the list — no program is
    // dropped or repeated within a pass.
    for (const pass of [first, second, third]) {
      expect(new Set(pass).size).toBe(8);
    }

    // ...but the passes are not the same order. Prior to the fix the
    // reshuffle branch was unreachable (IndexBasedProgramIterator#next
    // already wraps modulo length), so the iterator looped one fixed
    // permutation forever.
    expect(second).not.toEqual(first);
    expect(third).not.toEqual(second);
  });
});
