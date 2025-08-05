import type { ChannelProgram } from '@tunarr/types';
import { nth, orderBy } from 'lodash-es';
import type { ProgramIterator } from './ProgramIterator.ts';

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
