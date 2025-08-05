import { seq } from '@tunarr/shared/util';
import type { ChannelProgram } from '@tunarr/types';
import { nth, orderBy } from 'lodash-es';
import type { ProgramIterator } from './ProgramIterator.ts';
import { random } from './RandomSlotsService.ts';

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
