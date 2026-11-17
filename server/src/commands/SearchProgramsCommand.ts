import { seq } from '@tunarr/shared/util';
import type {
  ProgramSearchRequest,
  ProgramSearchResponse,
} from '@tunarr/types/api';
import { inject } from 'inversify';
import { isEmpty } from 'lodash-es';
import { match } from 'ts-pattern';
import type z from 'zod';
import { ApiProgramConverters } from '../api/ApiProgramConverters.ts';
import type { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type { ProgramStateRepository } from '../db/program/ProgramStateRepository.ts';
import type { ProgramGroupingOrmWithRelations } from '../db/schema/derivedTypes.ts';
import type { ProgramSearchDocument } from '../services/MeilisearchService.ts';
import {
  decodeCaseSensitiveId,
  MeilisearchService,
} from '../services/MeilisearchService.ts';
import { KEYS } from '../types/inject.ts';
import type { Path } from '../types/path.ts';
import type { Maybe } from '../types/util.ts';
import { groupByUniq } from '../util/index.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import {
  findDanglingSearchDocumentIds,
  isProgramGroupingDocument,
  isTerminalProgramDocument,
} from '../util/search.ts';

export class SearchProgramsCommand {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(MeilisearchService) private searchService: MeilisearchService,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(KEYS.ProgramStateRepository)
    private programStateRepo: ProgramStateRepository,
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

    const danglingIds = await this.pruneDanglingDocuments(
      result.results,
      new Set(Object.keys(programs)),
      new Set(Object.keys(groupings)),
    );

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

    const totalHits = Math.max(
      0,
      (result.type === 'search' ? result.totalHits : result.total) -
        danglingIds.length,
    );

    return {
      results,
      page:
        result.type === 'search'
          ? result.page
          : Math.floor((result.offset ?? 0) / (result.limit ?? 20)),
      totalHits,
      totalPages:
        result.type === 'search'
          ? danglingIds.length === 0
            ? result.totalPages
            : Math.ceil(totalHits / result.hitsPerPage)
          : Math.ceil(totalHits / limit),
      facetDistribution:
        result.type === 'search' ? result.facetDistribution : undefined,
    };
  }

  /**
   * Scanners index a row only after writing it, so a hit with no row is stale.
   * Removes those hits from the index and returns their ids.
   *
   * The loaded maps can be partial when a chunked query fails, so each
   * candidate is re-checked with lookups that throw instead. Deleting while
   * the client pages through results shifts later pages, so the next page may
   * skip a few items until the stale documents are gone.
   */
  private async pruneDanglingDocuments(
    docs: readonly ProgramSearchDocument[],
    loadedProgramIds: ReadonlySet<string>,
    loadedGroupingIds: ReadonlySet<string>,
  ): Promise<string[]> {
    const candidateIds = new Set(
      findDanglingSearchDocumentIds(docs, loadedProgramIds, loadedGroupingIds),
    );
    if (candidateIds.size === 0) {
      return [];
    }

    let danglingIds: string[];
    try {
      const ids = [...candidateIds];
      const [programIds, groupingIds] = await Promise.all([
        this.programStateRepo.findExistingProgramIds(ids),
        this.programStateRepo.findExistingGroupingIds(ids),
      ]);
      danglingIds = findDanglingSearchDocumentIds(
        docs.filter((doc) => candidateIds.has(doc.id)),
        programIds,
        groupingIds,
      );
    } catch (e) {
      this.logger.warn(e, 'Could not confirm stale search documents');
      return [];
    }

    if (danglingIds.length === 0) {
      return [];
    }

    this.logger.info(
      'Removing %d search document(s) with no matching DB row',
      danglingIds.length,
    );
    this.searchService
      .deleteByIds(danglingIds)
      .then((task) =>
        task ? this.searchService.monitorTask(task.taskUid) : undefined,
      )
      .catch((e) => {
        this.logger.warn(
          e,
          'Failed to remove %d stale document(s)',
          danglingIds.length,
        );
      });

    return danglingIds;
  }
}
