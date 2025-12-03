import { seq } from '@tunarr/shared/util';
import { ProgramSearchRequest, ProgramSearchResponse } from '@tunarr/types/api';
import { inject } from 'inversify';
import z from 'zod';
import { ApiProgramConverters } from '../api/ApiProgramConverters.ts';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import {
  decodeCaseSensitiveId,
  MeilisearchService,
  ProgramSearchDocument,
} from '../services/MeilisearchService.ts';
import { KEYS } from '../types/inject.ts';
import { Path } from '../types/path.ts';
import { groupByUniq } from '../util/index.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import {
  isProgramGroupingDocument,
  isTerminalProgramDocument,
} from '../util/search.ts';

export class SearchProgramsCommand {
  constructor(
    @inject(MeilisearchService) private searchService: MeilisearchService,
    @inject(KEYS.Logger) private logger: Logger,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
  ) {}

  async execute(
    req: z.infer<typeof ProgramSearchRequest>,
  ): Promise<ProgramSearchResponse> {
    const result = await this.searchService.search('programs', {
      query: req.query.query,
      filter: req.query.filter,
      paging: {
        offset: req.page ?? 1,
        limit: req.limit ?? 20,
      },
      mediaSourceId: req.mediaSourceId,
      libraryId: req.libraryId,
      // TODO not a great cast...
      restrictSearchTo: req.query
        .restrictSearchTo as Path<ProgramSearchDocument>[],
      facets: ['type'],
    });

    const [programIds, groupingIds] = result.hits.reduce(
      (acc, curr) => {
        const [programs, groupings] = acc;
        if (isProgramGroupingDocument(curr)) {
          groupings.push(curr.id);
        } else {
          programs.push(curr.id);
        }
        return acc;
      },
      [[], []] as [string[], string[]],
    );

    const allMediaSources = await this.mediaSourceDB.getAll();
    const allMediaSourcesById = groupByUniq(
      allMediaSources,
      (ms) => ms.uuid as string,
    );
    const allLibrariesById = groupByUniq(
      allMediaSources.flatMap((ms) => ms.libraries),
      (lib) => lib.uuid,
    );

    const [programs, groupings, groupingCounts] = await Promise.all([
      this.programDB
        .getProgramsByIds(programIds)
        .then((res) => groupByUniq(res, (p) => p.uuid)),
      this.programDB.getProgramGroupings(groupingIds),
      this.programDB.getProgramGroupingChildCounts(groupingIds),
    ]);

    const results = seq.collect(result.hits, (searchDoc) => {
      const mediaSourceId = decodeCaseSensitiveId(searchDoc.mediaSourceId);
      const mediaSource = allMediaSourcesById[mediaSourceId];
      if (!mediaSource) {
        this.logger.debug(
          'Could not find media source %s in DB for program ID %s',
          mediaSourceId,
          searchDoc.id,
        );
        return;
      }
      const libraryId = decodeCaseSensitiveId(searchDoc.libraryId);
      const library = allLibrariesById[libraryId];
      if (!library) {
        this.logger.debug(
          'COuld not find media source library %s in DB for program ID %s',
          libraryId,
          searchDoc.id,
        );
        return;
      }

      if (isProgramGroupingDocument(searchDoc)) {
        if (groupings[searchDoc.id]) {
          return ApiProgramConverters.convertProgramGrouping(
            groupings[searchDoc.id],
            searchDoc,
            groupingCounts[searchDoc.id],
            mediaSource,
            library,
          );
        } else {
          this.logger.debug(
            'Could not find program grouping %s in DB, but it exists in search index!',
            searchDoc.id,
          );
        }
      } else if (isTerminalProgramDocument(searchDoc)) {
        if (programs[searchDoc.id]) {
          return ApiProgramConverters.convertProgram(
            programs[searchDoc.id],
            searchDoc,
            mediaSource,
            library,
          );
        } else {
          this.logger.debug(
            'Could not find program %s in DB, but it exists in search index!',
            searchDoc.id,
          );
        }
      }

      return;
    });

    return {
      results,
      page: result.page,
      totalHits: result.totalHits,
      totalPages: result.totalPages,
      facetDistribution: result.facetDistribution,
    };
  }
}
