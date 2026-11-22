import type {
  CondensedChannelProgram,
  CondensedContentProgram,
} from '@tunarr/types';
import type { CondensedCustomProgram } from '@tunarr/types/schemas';
import { orderBy } from 'lodash-es';
import type { Random } from 'random-js';
import {
  IndexBasedProgramIterator,
  type ProgramIterator,
} from './ProgramIterator.ts';
import type { ProgramIteratorSnapshot } from './slotIteratorState.ts';
import {
  createIndexByIdMap,
  type SlotSchedulerProgram,
} from './slotSchedulerUtil.ts';

export type ShuffleOptions = {
  // Order each pass by a per-iterator seed instead of the shared RNG, so a
  // restored iterator continues the exact order it left.
  stable?: boolean;
};

type StablePass = { seed: number; pass: number };

// A program's place in one pass, in [0, 1). It depends only on the seed, the
// pass and the program, so adding or removing programs leaves the others in
// the same order. 53-bit cyrb53.
function shuffleRank(seed: number, pass: number, programId: string): number {
  const key = `${seed}:${pass}:${programId}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)) / 2 ** 53;
}

// The rest of a stable pass. Unplayed programs ranked after the last one
// played follow in rank order. Programs ranked before it joined the library
// mid-pass, so they play at the end of the pass instead of never.
function stablePassOrder(
  programs: SlotSchedulerProgram[],
  played: ReadonlySet<string>,
  { seed, pass }: StablePass,
): SlotSchedulerProgram[] {
  let cursor = -1;
  for (const programId of played) {
    cursor = Math.max(cursor, shuffleRank(seed, pass, programId));
  }
  return orderBy(
    programs.filter((program) => !played.has(program.uuid)),
    (program) => {
      const rank = shuffleRank(seed, pass, program.uuid);
      return rank > cursor ? rank : rank + 1;
    },
  );
}

abstract class ShuffleProgramIterator<
  ProgramT extends CondensedChannelProgram,
> extends IndexBasedProgramIterator<ProgramT> {
  #allPrograms: SlotSchedulerProgram[];
  // Stable passes keep the IDs of programs that left the library, because
  // they still mark how far the pass has gone.
  #played = new Set<string>();
  // True while the first pass holds only the programs a resumed pass had
  // not played yet.
  #partialPass: boolean;
  #stable: StablePass | undefined;

  constructor(
    programs: SlotSchedulerProgram[],
    protected random: Random,
    resume?: ProgramIteratorSnapshot,
    options: ShuffleOptions = {},
  ) {
    const played = new Set(resume?.type === 'shuffle' ? resume.playedIds : []);

    if (options.stable) {
      const stable = {
        seed:
          resume?.type === 'shuffle' && resume.seed !== undefined
            ? resume.seed
            : random.uint32(),
        pass: resume?.type === 'shuffle' ? (resume.pass ?? 0) : 0,
      };
      let order = stablePassOrder(programs, played, stable);
      if (order.length === 0 && programs.length > 0) {
        played.clear();
        stable.pass += 1;
        order = stablePassOrder(programs, played, stable);
      }
      super(order);
      this.#allPrograms = programs;
      this.#partialPass = false;
      this.#stable = stable;
      this.#played = played;
      return;
    }

    const unplayed = programs.filter((program) => !played.has(program.uuid));
    const partialPass =
      unplayed.length > 0 && unplayed.length < programs.length;

    // A full pass shuffles `programs` in place. Callers share these arrays
    // between iterators, so changing that would change existing schedules.
    super(random.shuffle(partialPass ? unplayed : programs));
    this.#allPrograms = programs;
    this.#partialPass = partialPass;
    if (partialPass) {
      for (const program of programs) {
        if (played.has(program.uuid)) {
          this.#played.add(program.uuid);
        }
      }
    }
  }

  protected allPrograms(): SlotSchedulerProgram[] {
    return this.#allPrograms;
  }

  next() {
    const curr = this.programs[this.position];
    if (curr) {
      this.#played.add(curr.uuid);
    }
    super.next();
    // IndexBasedProgramIterator#next wraps the position modulo the list
    // length, so position === 0 means we just completed a full pass.
    // Reshuffle so the next pass isn't a replay of the previous one.
    if (this.position === 0 && this.#stable) {
      this.#startStablePass(this.#stable);
    } else if (this.position === 0) {
      this.#played.clear();
      this.programs = this.random.shuffle([
        ...(this.#partialPass ? this.#allPrograms : this.programs),
      ]);
      this.#partialPass = false;
    }
  }

  #startStablePass(stable: StablePass) {
    this.#played.clear();
    stable.pass += 1;
    this.programs = stablePassOrder(this.#allPrograms, this.#played, stable);
    this.position = 0;
  }

  reset(): void {
    if (this.#stable) {
      this.#startStablePass(this.#stable);
      this.lastPlayedId = undefined;
      return;
    }
    this.programs = this.random.shuffle(
      this.#partialPass ? [...this.#allPrograms] : this.programs,
    );
    this.position = 0;
    this.lastPlayedId = undefined;
    this.#played.clear();
    this.#partialPass = false;
  }

  snapshot(): ProgramIteratorSnapshot | undefined {
    if (this.#stable) {
      return {
        type: 'shuffle',
        playedIds: [...this.#played],
        seed: this.#stable.seed,
        pass: this.#stable.pass,
      };
    }
    if (this.#played.size === 0) {
      return;
    }
    return { type: 'shuffle', playedIds: [...this.#played] };
  }
}

export class ContentProgramShuffleIterator extends ShuffleProgramIterator<CondensedContentProgram> {
  protected mint(program: SlotSchedulerProgram): CondensedContentProgram {
    return {
      type: 'content',
      duration: program.duration,
      id: program.uuid,
    };
  }
}

export class ProgramShuffleIteratorImpl<
  ProgramT extends CondensedChannelProgram,
> extends ShuffleProgramIterator<ProgramT> {
  constructor(
    programs: SlotSchedulerProgram[],
    random: Random,
    private minterFunc: (program: SlotSchedulerProgram) => ProgramT,
  ) {
    super(programs, random);
  }

  protected mint(program: SlotSchedulerProgram): ProgramT {
    return this.minterFunc(program);
  }

  fork(): ProgramIterator<ProgramT> {
    const forked = new ProgramShuffleIteratorImpl(
      [...this.programs],
      this.random,
      this.minterFunc,
    );
    return forked;
  }
}

export class CustomProgramShuffleIterator extends ShuffleProgramIterator<CondensedCustomProgram> {
  private indexById!: Record<string, number>;

  constructor(
    private customShowId: string,
    programs: SlotSchedulerProgram[],
    random: Random,
    resume?: ProgramIteratorSnapshot,
    options?: ShuffleOptions,
  ) {
    super(programs, random, resume, options);
    this.indexById = createIndexByIdMap(programs, customShowId);
  }

  protected mint(program: SlotSchedulerProgram): CondensedCustomProgram {
    return {
      customShowId: this.customShowId,
      duration: program.duration,
      id: program.uuid,
      index: this.indexById[program.uuid]!,
      type: 'custom',
    };
  }
}
