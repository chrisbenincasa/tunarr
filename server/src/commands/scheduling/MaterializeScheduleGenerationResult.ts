import { isNonEmptyString, seq } from '@tunarr/shared/util';
import { ContentProgram } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { uniq } from 'lodash-es';
import { ProgramConverter } from '../../db/converters/ProgramConverter.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { GenerationResult } from '../../services/scheduling/InfiniteScheduleGenerator.ts';
import { KEYS } from '../../types/inject.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { Command } from '../Command.ts';

type Request = {
  result: GenerationResult;
};

@injectable()
export class MaterializeScheduleGenerationResult
  implements Command<Request, ContentProgram[]>
{
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(ProgramConverter) private programConverter: ProgramConverter,
  ) {}

  async run({ result }: Request): Promise<ContentProgram[]> {
    const programIds = uniq(
      seq.collect(result.items, (item) => {
        const programId = item.programUuid;
        if (!isNonEmptyString(programId)) {
          return;
        }

        return programId;
      }),
    );

    if (programIds.length === 0) {
      return [];
    }

    const programs = await this.programDB.getProgramsByIds(programIds);

    const missingPrograms = new Set(programIds).difference(
      new Set(programs.map((p) => p.uuid)),
    );

    if (missingPrograms.size > 0) {
      this.logger.warn('');
    }

    return seq.collect(programs, (program) => {
      return this.programConverter.programOrmToContentProgram(program);
    });
  }
}
