import { seq } from '@tunarr/shared/util';
import {
  ChannelProgram,
  CondensedChannelProgram,
  ContentProgram,
} from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { match, P } from 'ts-pattern';
import { ProgramConverter } from '../db/converters/ProgramConverter.ts';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { KEYS } from '../types/inject.ts';
import { groupByUniq } from '../util/index.ts';

type MaterializeLineupCommandRequest = {
  lineup: CondensedChannelProgram[];
};

@injectable()
export class MaterializeLineupCommand {
  constructor(
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(ProgramConverter) private programConverter: ProgramConverter,
  ) {}

  async execute(
    request: MaterializeLineupCommandRequest,
  ): Promise<Record<string, ContentProgram>> {
    const programIds = new Set(
      seq.collect(request.lineup, (p) => {
        return match(p)
          .with({ type: 'content', id: P.nonNullable }, (c) => c.id ?? null)
          .with({ type: 'custom' }, (c) => c.id)
          .with({ type: 'filler' }, (f) => f.id)
          .with({ type: P._ }, () => null)
          .exhaustive();
      }),
    );

    const dbPrograms = await this.programDB.getProgramsByIds([...programIds]);
    return groupByUniq(
      seq.collect(dbPrograms, (p) =>
        this.programConverter.programOrmToContentProgram(p),
      ),
      (p) => p.id,
    );
  }

  static expandLineup(
    lineup: CondensedChannelProgram[],
    programsById: Record<string, ContentProgram>,
  ): ChannelProgram[] {
    return seq.collect(lineup, (lineupItem) => {
      return match(lineupItem)
        .with(
          { type: P.union('content', 'custom', 'filler') },
          (c) => programsById[c.id ?? ''],
        )
        .with({ type: P._ }, (p) => p)
        .exhaustive();
    });
  }
}
