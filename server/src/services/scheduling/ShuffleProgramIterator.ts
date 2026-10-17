import type {
  CondensedChannelProgram,
  CondensedContentProgram,
} from '@tunarr/types';
import type { CondensedCustomProgram } from '@tunarr/types/schemas';
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

abstract class ShuffleProgramIterator<
  ProgramT extends CondensedChannelProgram,
> extends IndexBasedProgramIterator<ProgramT> {
  #allPrograms: SlotSchedulerProgram[];
  #played = new Set<string>();
  // True while the first pass holds only the programs a resumed pass had
  // not played yet.
  #partialPass: boolean;

  constructor(
    programs: SlotSchedulerProgram[],
    protected random: Random,
    resume?: ProgramIteratorSnapshot,
  ) {
    const played = new Set(resume?.type === 'shuffle' ? resume.playedIds : []);
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

  next() {
    const curr = this.programs[this.position];
    if (curr) {
      this.#played.add(curr.uuid);
    }
    super.next();
    // IndexBasedProgramIterator#next wraps the position modulo the list
    // length, so position === 0 means we just completed a full pass.
    // Reshuffle so the next pass isn't a replay of the previous one.
    if (this.position === 0) {
      this.#played.clear();
      this.programs = this.random.shuffle([
        ...(this.#partialPass ? this.#allPrograms : this.programs),
      ]);
      this.#partialPass = false;
    }
  }

  reset(): void {
    this.programs = this.random.shuffle(
      this.#partialPass ? [...this.#allPrograms] : this.programs,
    );
    this.position = 0;
    this.lastPlayedId = undefined;
    this.#played.clear();
    this.#partialPass = false;
  }

  snapshot(): ProgramIteratorSnapshot | undefined {
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
  ) {
    super(programs, random, resume);
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
