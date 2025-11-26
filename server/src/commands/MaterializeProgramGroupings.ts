import { MediaSourceId } from '@tunarr/shared';
import { ProgramGrouping, untag } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { NonEmptyArray } from 'ts-essentials';
import { ApiProgramConverters } from '../api/ApiProgramConverters.ts';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import { ProgramGroupingOrmWithRelations } from '../db/schema/derivedTypes.ts';
import {
  decodeCaseSensitiveId,
  MeilisearchService,
} from '../services/MeilisearchService.ts';
import { KEYS } from '../types/inject.ts';
import { groupByUniq } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { isProgramGroupingDocument } from '../util/search.ts';

@injectable()
export class MaterializeProgramGroupings {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(MeilisearchService) private searchService: MeilisearchService,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
  ) {}

  async execute(
    groupings: NonEmptyArray<ProgramGroupingOrmWithRelations>,
  ): Promise<NonEmptyArray<ProgramGrouping>>;
  async execute(
    groupings: ProgramGroupingOrmWithRelations[],
  ): Promise<ProgramGrouping[]>;
  async execute(
    groupings:
      | ProgramGroupingOrmWithRelations[]
      | NonEmptyArray<ProgramGroupingOrmWithRelations>,
  ): Promise<ProgramGrouping[] | NonEmptyArray<ProgramGrouping>> {
    const ids = groupings.map((group) => group.uuid);

    const [searchDocs, mediaSources, groupingCounts] = await Promise.all([
      this.searchService
        .getPrograms(ids)
        .then((_) => groupByUniq(_, (doc) => doc.id)),
      this.mediaSourceDB
        .getAll()
        .then((_) => groupByUniq(_, (ms) => untag<MediaSourceId>(ms.uuid))),
      this.programDB.getProgramGroupingChildCounts(ids),
    ]);

    const apiGroups: ProgramGrouping[] = [];
    for (const group of groupings) {
      const doc = searchDocs[group.uuid];
      if (!doc || !isProgramGroupingDocument(doc)) continue;
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
      const counts = groupingCounts[group.uuid];
      const apiItem = ApiProgramConverters.convertProgramGroupingSearchResult(
        doc,
        group,
        counts,
        ms,
        library,
      );
      if (!apiItem) {
        this.logger.warn(
          'Unable to convert grouping %s to API representation',
          group.uuid,
        );
        continue;
      }
      apiGroups.push(apiItem);
    }

    return apiGroups;
  }
}
