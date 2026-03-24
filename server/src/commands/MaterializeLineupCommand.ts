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
import { MaterializeProgramsCommand } from './MaterializeProgramsCommand.ts';

type MaterializeLineupCommandRequest = {
  lineup: CondensedChannelProgram[];
};

@injectable()
export class MaterializeLineupCommand {
  constructor(
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(ProgramConverter) private programConverter: ProgramConverter,
    @inject(MaterializeProgramsCommand)
    private materializePrograms: MaterializeProgramsCommand,
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
    const materializedPrograms =
      await this.materializePrograms.execute(dbPrograms);

    return groupByUniq(
      materializedPrograms.map((program) =>
        this.programConverter.materializedProgramToContentProgram(program),
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
        .with({ type: 'content' }, (c) => {
          const program = programsById[c.id ?? ''];
          if (!program) return;
          return {
            ...c,
            ...program,
            // We have to keep the lineup program's duration
            // here and not just override with the whole duration
            duration: c.duration,
          } satisfies ContentProgram;
        })
        .with({ type: 'custom' }, (c) => {
          const program = programsById[c.id ?? ''];
          if (!program) return;
          return { ...c, ...program };
        })
        .with({ type: 'filler' }, (f) => {
          const program = programsById[f.id];
          if (!program) return null;
          return {
            ...f,
            program,
          } satisfies ChannelProgram;
        })
        .with({ type: P._ }, (p) => p)
        .exhaustive();
    });
  }
}
