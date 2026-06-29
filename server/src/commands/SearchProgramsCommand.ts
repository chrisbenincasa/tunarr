import { seq } from '@tunarr/shared/util';
import type { ProgramSearchRequest, ProgramSearchResponse } from '@tunarr/types/api';
import { inject } from 'inversify';
import { isEmpty } from 'lodash-es';
import { match } from 'ts-pattern';
import type z from 'zod';
import { ApiProgramConverters } from '../api/ApiProgramConverters.ts';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type { ProgramGroupingOrmWithRelations } from '../db/schema/derivedTypes.ts';
import type {
  ProgramSearchDocument} from '../services/MeilisearchService.ts';
import {
  decodeCaseSensitiveId,
  MeilisearchService
} from '../services/MeilisearchService.ts';
import { KEYS } from '../types/inject.ts';
import type { Path } from '../types/path.ts';
import type { Maybe } from '../types/util.ts';
import { groupByUniq } from '../util/index.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import {
  isProgramGroupingDocument,
  isTerminalProgramDocument,
} from '../util/search.ts';

export class SearchProgramsCommand {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(MeilisearchService) private searchService: MeilisearchService,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
  ) {}

  async execute(
    req: z.infer<typeof ProgramSearchRequest>,
  ): Promise<ProgramSearchResponse> {
    const limit = req.limit ?? 20;
    const result = await this.searchService.search('programs', {
      query: req.query.query,
      filter: req.query.filter,
      paging: {
        page: isEmpty(req.query.query) ? (req.page ?? 0) : (req.page ?? 1),
        limit,
      },
      mediaSourceId: req.mediaSourceId,
      libraryId: req.libraryId,
      // TODO not a great cast...
      restrictSearchTo: req.query
        .restrictSearchTo as Path<ProgramSearchDocument>[],
      facets: ['type'],
      sort: req.query.sort ?? undefined,
    });

    const [programIds, groupingIds] = result.results.reduce(
      (acc, curr) => {
        const [programs, groupings] = acc;
        if (isProgramGroupingDocument(curr)) {
          groupings.add(curr.id);
        } else {
          programs.add(curr.id);
          if (curr.parent?.id && req.expandParents) {
            groupings.add(decodeCaseSensitiveId(curr.parent?.id));
          }
          if (curr.grandparent?.id && req.expandParents) {
            groupings.add(decodeCaseSensitiveId(curr.grandparent?.id));
          }
        }
        return acc;
      },
      [new Set<string>(), new Set<string>()],
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
        .getProgramsByIds([...programIds.values()])
        .then((res) => groupByUniq(res, (p) => p.uuid)),
      this.programDB.getProgramGroupings([...groupingIds.values()]),
      this.programDB.getProgramGroupingChildCounts([...groupingIds.values()]),
    ]);

    const results = seq.collect(result.results, (searchDoc) => {
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
            groupings[searchDoc.id]!,
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
          const program = programs[searchDoc.id]!;
          let parent: Maybe<ProgramGroupingOrmWithRelations>;
          let grandparent: Maybe<ProgramGroupingOrmWithRelations>;
          if (req.expandParents) {
            match(program)
              .with({ type: 'episode' }, (ep) => {
                if (ep.seasonUuid) {
                  parent = groupings[ep.seasonUuid];
                }
                if (ep.tvShowUuid) {
                  grandparent = groupings[ep.tvShowUuid];
                }
              })
              .with({ type: 'track' }, (track) => {
                if (track.albumUuid) {
                  parent = groupings[track.albumUuid];
                }
                if (track.artistUuid) {
                  grandparent = groupings[track.artistUuid];
                }
              })
              .otherwise(() => void 0);
          }

          return ApiProgramConverters.convertProgram(
            program,
            searchDoc,
            mediaSource,
            library,
            parent,
            grandparent,
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
      page:
        result.type === 'search'
          ? result.page
          : Math.floor((result.offset ?? 0) / (result.limit ?? 20)),
      totalHits: result.type === 'search' ? result.totalHits : result.total,
      totalPages:
        result.type === 'search'
          ? result.totalPages
          : Math.ceil(result.total / limit),
      facetDistribution:
        result.type === 'search' ? result.facetDistribution : undefined,
    };
  }
}
