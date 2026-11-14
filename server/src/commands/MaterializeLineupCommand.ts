import { seq } from '@tunarr/shared/util';
import type {
  ChannelProgram,
  CondensedChannelProgram,
  ContentProgram,
  CustomProgram,
} from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { ProgramConverter } from '../db/converters/ProgramConverter.ts';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
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
        switch (p.type) {
          case 'content':
            return p.id ?? null;
          case 'custom':
            return p.id;
          case 'filler':
            return p.id;
          case 'redirect':
          case 'flex':
            return null;
        }
      }),
    );

    const dbPrograms = await this.programDB.getLineupProgramsByIds([
      ...programIds,
    ]);
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
      switch (lineupItem.type) {
        case 'content': {
          const program = programsById[lineupItem.id ?? ''];
          if (!program) return;
          return {
            ...lineupItem,
            ...program,
            // We have to keep the lineup program's duration
            // here and not just override with the whole duration
            duration: lineupItem.duration,
          } satisfies ContentProgram;
        }
        case 'custom': {
          const program = programsById[lineupItem.id ?? ''];
          if (!program) return;

          // Nest the program instead of spreading it. A spread would replace a
          // mid-roll segment's duration with the full program duration and
          // turn the item into plain content, dropping its custom show.
          return { ...lineupItem, program } satisfies CustomProgram;
        }
        case 'filler': {
          const program = programsById[lineupItem.id];
          if (!program) return null;
          return {
            ...lineupItem,
            program,
          } satisfies ChannelProgram;
        }
        case 'redirect':
        case 'flex':
          return lineupItem;
      }
    });
  }
}
