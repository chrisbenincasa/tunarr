import { MediaSourceId } from '@tunarr/shared';
import { TerminalProgram, untag } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { NonEmptyArray } from 'ts-essentials';
import { ApiProgramConverters } from '../api/ApiProgramConverters.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { ProgramWithRelationsOrm } from '../db/schema/derivedTypes.ts';
import { KEYS } from '../types/inject.ts';
import { groupByUniq } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';

@injectable()
export class MaterializeProgramsCommand {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
  ) {}

  async execute(
    programs: NonEmptyArray<ProgramWithRelationsOrm>,
  ): Promise<NonEmptyArray<TerminalProgram>>;
  async execute(
    programs: ProgramWithRelationsOrm[],
  ): Promise<TerminalProgram[]>;
  async execute(
    programs:
      | ProgramWithRelationsOrm[]
      | NonEmptyArray<ProgramWithRelationsOrm>,
  ): Promise<TerminalProgram[] | NonEmptyArray<TerminalProgram>> {
    if (programs.length === 0) {
      return [];
    }
    const mediaSources = await this.mediaSourceDB
      .getAll()
      .then((_) => groupByUniq(_, (ms) => untag<MediaSourceId>(ms.uuid)));

    const apiGroups: TerminalProgram[] = [];
    for (const program of programs) {
      // const doc = searchDocs[group.uuid];
      // if (!doc || !isTerminalProgramDocument(doc)) continue;
      const maybeId = program.mediaSourceId
        ? untag(program.mediaSourceId)
        : null;

      if (!maybeId) {
        this.logger.warn(
          'Program (type %s) %s missing media_source_id. Try scanning',
          program.type,
          program.uuid,
        );
        continue;
      }

      const ms = mediaSources[maybeId];

      if (!ms) {
        this.logger.warn(
          `Program (type = %s) %s has media source ID that doesn't exist in DB`,
          program.type,
          program.uuid,
        );
        continue;
      }

      const library = ms.libraries.find(
        (lib) => lib.uuid === program.libraryId,
      );

      if (!library) {
        if (!program.libraryId) {
          this.logger.warn(
            'Program (type %s) %s does not have a library_id',
            program.type,
            program.uuid,
          );
        } else {
          this.logger.warn(
            `Program (type %s) %s has a library_id that is not associated with it's media source id (ID = %s)`,
            program.type,
            program.uuid,
            ms.uuid,
          );
        }
        continue;
      }

      // Specifically passing undefined for search doc now to avoid reliance on
      // search
      const apiItem = ApiProgramConverters.convertProgram(
        program,
        undefined,
        ms,
        library,
      );

      if (!apiItem) {
        this.logger.warn(
          'Unable to convert program grouping %s to API representation',
          program.uuid,
        );
        continue;
      }
      apiGroups.push(apiItem);
    }

    return apiGroups;
  }
}
