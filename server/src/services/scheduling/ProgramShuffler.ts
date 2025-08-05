import type { ChannelProgram } from '@tunarr/types';
import { nth, shuffle, slice } from 'lodash-es';
import type { Random } from 'random-js';
import type { ProgramIterator } from './ProgramIterator.ts';

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
