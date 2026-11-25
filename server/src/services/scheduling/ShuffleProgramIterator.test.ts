import { MersenneTwister19937, Random } from 'random-js';
import { describe, expect, test } from 'vitest';
import { createFakeProgramOrm } from '../../testing/fakes/entityCreators.ts';
import { ContentProgramShuffleIterator } from './ShuffleProgramIterator.ts';
import type { ProgramIteratorSnapshot } from './slotIteratorState.ts';
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

describe('stable shuffle', () => {
  const stable = { stable: true };

  function walk(
    iterator: ContentProgramShuffleIterator,
    count: number,
  ): string[] {
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      const program = iterator.current();
      if (!program) {
        throw new Error('expected a program');
      }
      out.push(program.id);
      iterator.next();
    }
    return out;
  }

  function create(
    programs: SlotSchedulerProgram[],
    resume?: ProgramIteratorSnapshot,
    seed = 42,
  ) {
    return new ContentProgramShuffleIterator(
      programs,
      new Random(MersenneTwister19937.seed(seed)),
      resume,
      stable,
    );
  }

  test('plays every program once per pass and reorders each pass', () => {
    const picks = walk(create(makePrograms(8)), 24);
    const passes = [picks.slice(0, 8), picks.slice(8, 16), picks.slice(16)];

    for (const pass of passes) {
      expect(new Set(pass).size).toBe(8);
    }
    expect(passes[1]).not.toEqual(passes[0]);
    expect(passes[2]).not.toEqual(passes[1]);
  });

  test.each([0, 3, 7, 8, 13])(
    'a restore after %d programs continues the same order',
    (played) => {
      const programs = makePrograms(8);
      const expected = walk(create(programs), 30);

      const first = create(programs);
      walk(first, played);
      const snapshot = first.snapshot();

      // A different shared RNG proves the order no longer depends on it.
      const resumed = create(programs, snapshot, 999);
      expect(walk(resumed, 30 - played)).toEqual(expected.slice(played));
    },
  );

  test('a snapshot carries its seed and pass even before anything plays', () => {
    const snapshot = create(makePrograms(4)).snapshot();
    expect(snapshot).toMatchObject({ type: 'shuffle', playedIds: [], pass: 0 });
    expect(snapshot?.type === 'shuffle' && snapshot.seed).toBeTypeOf('number');
  });

  test('a removed program drops out and the rest keep their order', () => {
    const programs = makePrograms(8);
    const first = create(programs);
    const head = walk(first, 3);
    const rest = walk(create(programs, first.snapshot()), 5);

    const removed = rest[2];
    const resumed = create(
      programs.filter((program) => program.uuid !== removed),
      first.snapshot(),
    );
    expect(walk(resumed, 4)).toEqual(rest.filter((id) => id !== removed));
    expect(head).not.toContain(removed);
  });

  test('a program added mid-pass plays in this pass without moving the rest', () => {
    const programs = makePrograms(8);
    const first = create(programs);
    walk(first, 4);
    const snapshot = first.snapshot();
    const rest = walk(create(programs, snapshot), 4);

    const added = makePrograms(9).slice(8);
    const resumed = create([...programs, ...added], snapshot);
    const pass = walk(resumed, 5);

    expect(pass).toContain('p8');
    expect(pass.filter((id) => id !== 'p8')).toEqual(rest);
  });

  test('a stored order survives a full pass played across restores', () => {
    const programs = makePrograms(5);
    const expected = walk(create(programs), 15);

    const out: string[] = [];
    let snapshot: ProgramIteratorSnapshot | undefined;
    for (let i = 0; i < 15; i++) {
      const iterator = create(programs, snapshot, snapshot ? 1000 + i : 42);
      out.push(...walk(iterator, 1));
      snapshot = iterator.snapshot();
    }
    expect(out).toEqual(expected);
  });
});
