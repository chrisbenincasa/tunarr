import { MediaSourceId } from '@tunarr/shared';
import { TerminalProgram, untag } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { NonEmptyArray } from 'ts-essentials';
import { ApiProgramConverters } from '../api/ApiProgramConverters.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { ProgramWithRelationsOrm } from '../db/schema/derivedTypes.ts';
import {
  decodeCaseSensitiveId,
  MeilisearchService,
} from '../services/MeilisearchService.ts';
import { KEYS } from '../types/inject.ts';
import { groupByUniq } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { isTerminalProgramDocument } from '../util/search.ts';

@injectable()
export class MaterializeProgramsCommand {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(MeilisearchService) private searchService: MeilisearchService,
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
    const ids = programs.map((p) => p.uuid);

    const [searchDocs, mediaSources] = await Promise.all([
      this.searchService
        .getPrograms(ids)
        .then((_) => groupByUniq(_, (doc) => doc.id)),
      this.mediaSourceDB
        .getAll()
        .then((_) => groupByUniq(_, (ms) => untag<MediaSourceId>(ms.uuid))),
    ]);

    const apiGroups: TerminalProgram[] = [];
    for (const group of programs) {
      const doc = searchDocs[group.uuid];
      if (!doc || !isTerminalProgramDocument(doc)) continue;
      const maybeId = group.mediaSourceId ? untag(group.mediaSourceId) : null;
      const ms =
        mediaSources[maybeId ?? decodeCaseSensitiveId(doc.mediaSourceId)];
      if (!ms) continue;
      const library = ms.libraries.find(
        (lib) =>
          lib.uuid ===
          (group.libraryId ?? decodeCaseSensitiveId(doc.libraryId)),
      );
      if (!library) continue;
      const apiItem = ApiProgramConverters.convertProgramSearchResult(
        doc,
        group,
        ms,
        library,
      );
      if (!apiItem) {
        this.logger.warn(
          'Unable to convert program grouping %s to API representation',
          group.uuid,
        );
        continue;
      }
      apiGroups.push(apiItem);
    }

    return apiGroups;
  }
}
