import { isNonEmptyString, seq } from '@tunarr/shared/util';
import { Collection, isGroupingItemType, ProgramLike } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import {
  chunk,
  compact,
  difference,
  differenceWith,
  groupBy,
  isEmpty,
  isUndefined,
  partition,
  uniq,
} from 'lodash-es';
import { v4 } from 'uuid';
import { ExternalCollectionRepo } from '../../db/ExternalCollectionRepo.ts';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type {
  MediaSourceWithRelations,
  ProgramGroupingOrmWithRelations,
  ProgramWithRelationsOrm,
} from '../../db/schema/derivedTypes.ts';
import { ExternalCollection } from '../../db/schema/ExternalCollection.ts';
import { MediaSourceOrm } from '../../db/schema/MediaSource.ts';
import { MediaSourceLibraryOrm } from '../../db/schema/MediaSourceLibrary.ts';
import { ProgramGroupingType } from '../../db/schema/ProgramGrouping.ts';
import { Tag } from '../../db/schema/Tag.ts';
import { TagRepo } from '../../db/TagRepo.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import type { PlexApiClient } from '../../external/plex/PlexApiClient.ts';
import { KEYS } from '../../types/inject.ts';
import { Result } from '../../types/result.ts';
import { groupByTyped, groupByUniq } from '../../util/index.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import {
  MeilisearchService,
  ProgramIndexPartialUpdate,
} from '../MeilisearchService.ts';
import {
  ExternalCollectionLibraryScanRequest,
  ExternalCollectionScanner,
  ExternalCollectionScanRequest,
} from './ExternalCollectionScanner.ts';

type Context = {
  mediaSource: MediaSourceOrm;
  library: MediaSourceLibraryOrm;
  apiClient: PlexApiClient;
};

// Update the tags field of the item directly.
type SearchUpdate = {
  type: 'direct' | 'parent' | 'grandparent';
  id: string;
  collectionName: string;
  opType: 'add' | 'del';
};

@injectable()
export class PlexCollectionScanner extends ExternalCollectionScanner<PlexApiClient> {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(MediaSourceApiFactory)
    private mediaSourceApiFactory: MediaSourceApiFactory,
    @inject(ExternalCollectionRepo)
    private externalCollectionsRepo: ExternalCollectionRepo,
    @inject(MeilisearchService)
    private searchService: MeilisearchService,
    @inject(KEYS.ProgramDB)
    private programDB: IProgramDB,
    @inject(TagRepo)
    private tagRepo: TagRepo,
  ) {
    super();
  }

  async scan(req: ExternalCollectionScanRequest): Promise<void> {
    const mediaSource = await this.mediaSourceDB.getById(req.mediaSourceId);
    if (!mediaSource) {
      throw new Error(
        `Could not find media source with ID ${req.mediaSourceId}`,
      );
    }
    this.logger.debug(
      'Scanning Plex media source (ID = %s) for collections',
      mediaSource.uuid,
    );

    const enabledLibraries = mediaSource.libraries.filter((lib) => lib.enabled);

    if (enabledLibraries.length === 0) {
      this.logger.debug(
        'Plex media source (ID = %s) has no enabled libraries. Skipping collections scan',
        mediaSource.uuid,
      );
      return;
    }

    const apiClient = await this.getApiClient(mediaSource);

    for (const library of enabledLibraries) {
      const result = await Result.attemptAsync(() =>
        this.scanLibraryInternal({
          mediaSource,
          library,
          apiClient,
        }),
      );
      if (result.isFailure()) {
        this.logger.warn(
          result.error,
          'Failure while scanning Plex library (%s) for collections',
          library.name,
        );
      }
    }
  }

  async scanLibrary(req: ExternalCollectionLibraryScanRequest): Promise<void> {
    const library = await this.mediaSourceDB.getLibrary(req.libraryId);
    if (!library) {
      throw new Error(
        `Could not find media source library with ID ${req.libraryId}`,
      );
    }

    this.logger.debug('Scanning Plex collections for library %s', library.name);

    if (!library.enabled) {
      this.logger.debug(
        'Skipping Plex collection scan for library %s because it is disabled',
        req.libraryId,
      );
      return;
    }

    if (library.mediaSource.type !== 'plex') {
      throw new Error(
        `Tried to scan library ID ${req.libraryId} but it belongs to a non-Plex media source (actual type = ${library.mediaSource.type})`,
      );
    }

    const apiClient = await this.getApiClient({
      ...library.mediaSource,
      libraries: [library],
    });

    await this.scanLibraryInternal({
      apiClient,
      library,
      mediaSource: library.mediaSource,
    });
  }

  private async scanLibraryInternal(ctx: Context) {
    await this.searchService.waitForPendingIndexTasks();
    this.logger.debug(
      'Scanning Plex library "%s" for collections',
      ctx.library.name,
    );
    const existingCollections = groupByUniq(
      await this.externalCollectionsRepo.getByLibraryId(ctx.library.uuid),
      (coll) => coll.externalKey,
    );
    const existingCollectionExternalIds = new Set(
      Object.keys(existingCollections),
    );
    const seenIds = new Set<string>();
    const searchUpdates: SearchUpdate[] = [];
    for await (const collection of ctx.apiClient.getAllLibraryCollections(
      ctx.library.externalKey,
    )) {
      seenIds.add(collection.externalId);
      // Upsert a tag for this collection name
      const tag = await this.tagRepo.upsertTag(collection.title);
      // Check if collection is new
      let existingCollection = existingCollections[collection.externalId];
      if (!existingCollection) {
        existingCollection = {
          uuid: v4(),
          externalKey: collection.externalId,
          libraryId: ctx.library.uuid,
          mediaSourceId: ctx.mediaSource.uuid,
          sourceType: 'plex',
          title: collection.title,
        };

        await this.externalCollectionsRepo.insertCollection(existingCollection);
      }

      searchUpdates.push(
        ...(await this.enumerateCollection(
          existingCollection,
          collection,
          tag,
          ctx,
        )),
      );
    }

    const missingIds = existingCollectionExternalIds.difference(seenIds);
    const missingCollections = seq.collect(
      [...missingIds.values()],
      (id) => existingCollections[id],
    );

    for (const missingCollection of missingCollections) {
      const collection = await this.externalCollectionsRepo.getById(
        missingCollection.uuid,
      );
      if (!collection) {
        continue;
      }

      const relatedGroupings = seq.collect(collection.groupings, (g) =>
        g.grouping?.uuid ? ([g.grouping.uuid, g.grouping.type] as const) : null,
      );
      const allRelatedIds = relatedGroupings
        .map(([id]) => id)
        .concat(seq.collect(collection.programs, (p) => p.program?.uuid));
      const relatedDescendants = await this.getAllDescendents(
        relatedGroupings.map(([id, type]) => ({ uuid: id, type })),
      );

      for (const id of allRelatedIds) {
        searchUpdates.push({
          type: 'direct',
          collectionName: collection.title,
          id,
          opType: 'del',
        });
      }

      for (const [id, type] of relatedDescendants) {
        searchUpdates.push({
          type: isGroupingItemType(type) ? 'parent' : 'grandparent',
          collectionName: collection.title,
          id,
          opType: 'del',
        });
      }

      await this.externalCollectionsRepo.deleteCollection(collection.uuid);
    }

    // Search indexes must be updated once to avoid the select + update flow
    // given that index requests are async, this avoids the race:
    // 1. Doc with tags: [A, B, C]
    // 2. Add collection D -> send index request with tags [A, B, C, D]
    // 3. Index request is queued, next collection, E, processed
    // 4. Select document, get tags [A, B, C]. Send index request for [A, B, C, E]
    // 5. Request from 2 processed, then clobbered by request from 4.
    // Now we have to collect all search updates and apply them at once to avoid the race.
    // This involves getting all of the documents current tags
    const updatesById = groupBy(searchUpdates, (update) => update.id);
    for (const updateChunk of chunk(Object.entries(updatesById), 100)) {
      const ids = updateChunk.map(([id]) => id);
      const searchDocs = await this.searchService.getPrograms(ids);
      // Apply the updates to each doc
      const partialPrograms: ProgramIndexPartialUpdate[] = [];
      for (const doc of searchDocs) {
        const updates = updatesById[doc.id];
        if (!updates) continue;
        const currentTags = new Set(doc.tags);
        const updatesByType = groupByTyped(updates, (up) => up.type);
        const [directAdds, directDels] = partition(
          updatesByType.direct,
          (up) => up.opType === 'add',
        );
        const newTags = currentTags
          .union(
            new Set(directAdds.map(({ collectionName }) => collectionName)),
          )
          .difference(
            new Set(directDels.map(({ collectionName }) => collectionName)),
          );
        const partialUpdate: ProgramIndexPartialUpdate = {
          id: doc.id,
          tags: isEmpty(updatesByType.direct)
            ? undefined
            : [...newTags.values()],
        };

        if (doc.parent && !isEmpty(updatesByType.parent)) {
          const currentParentTags = new Set(doc.parent.tags);
          const [parentAdds, parentDels] = partition(
            updatesByType.parent,
            (up) => up.opType === 'add',
          );
          const newTags = currentParentTags
            .union(
              new Set(parentAdds.map(({ collectionName }) => collectionName)),
            )
            .difference(
              new Set(parentDels.map(({ collectionName }) => collectionName)),
            );
          partialUpdate.parent = {
            ...doc.parent,
            tags: [...newTags.values()],
          };
        }

        if (doc.grandparent && !isEmpty(updatesByType.grandparent)) {
          const currentGrandparentTags = new Set(doc.grandparent.tags);
          const [adds, dels] = partition(
            updatesByType.grandparent,
            (up) => up.opType === 'add',
          );
          const newTags = currentGrandparentTags
            .union(new Set(adds.map(({ collectionName }) => collectionName)))
            .difference(
              new Set(dels.map(({ collectionName }) => collectionName)),
            );
          partialUpdate.grandparent = {
            ...doc.grandparent,
            tags: [...newTags.values()],
          };
        }

        if (
          !isUndefined(partialUpdate.tags) ||
          !isUndefined(partialUpdate.parent?.tags) ||
          !isUndefined(partialUpdate.grandparent?.tags)
        ) {
          partialPrograms.push(partialUpdate);
        }
      }

      this.logger.debug(
        'Sending %d Plex collection tag updates to search server',
        partialPrograms.length,
      );

      await this.searchService.updatePrograms(partialPrograms);
    }
  }

  private async enumerateCollection(
    collectionDao: ExternalCollection,
    collection: Collection,
    tag: Tag,
    context: Context,
  ): Promise<SearchUpdate[]> {
    this.logger.debug('Scanning collection "%s"', collection.title);
    const it = context.apiClient.getCollectionItems(
      context.library.uuid,
      collection.externalId,
    );
    const seenIds = new Set<string>();
    const isGroupingCollectionType =
      collection.childType === 'show' || collection.childType === 'artist';

    const existingCollectionProgramsByExternalId =
      await (isGroupingCollectionType
        ? this.externalCollectionsRepo
            .getCollectionProgramGroupings(collectionDao.uuid)
            .then((groupings) => ({
              type: 'groupings' as const,
              groupings: groupBy(
                compact(groupings).filter((grouping) =>
                  isNonEmptyString(grouping.externalKey),
                ),
                (grouping) => grouping.externalKey!,
              ),
            }))
        : this.externalCollectionsRepo
            .getCollectionPrograms(collectionDao.uuid)
            .then((programs) => ({
              type: 'programs' as const,
              programs: groupBy(
                compact(programs).filter((program) =>
                  isNonEmptyString(program.externalKey),
                ),
                (program) => program.externalKey,
              ),
            })));

    for await (const item of it) {
      seenIds.add(item.externalId);
    }

    let newKeys: Set<string>;
    if (existingCollectionProgramsByExternalId.type === 'groupings') {
      newKeys = seenIds.difference(
        new Set(Object.keys(existingCollectionProgramsByExternalId.groupings)),
      );
    } else {
      newKeys = seenIds.difference(
        new Set(Object.keys(existingCollectionProgramsByExternalId.programs)),
      );
    }

    this.logger.debug(
      'Adding %d tag associtions for collection "%s" from %s',
      newKeys.size,
      collection.title,
      existingCollectionProgramsByExternalId.type,
    );

    const searchUpdates: SearchUpdate[] = [];
    for (const newKeyChunk of chunk([...newKeys], 100)) {
      if (isGroupingCollectionType) {
        const groupings = await this.getProgramGroupingsAndSearchDocuments(
          context,
          newKeyChunk,
        );
        searchUpdates.push(
          ...groupings.daos.map(
            ({ uuid }) =>
              ({
                id: uuid,
                type: 'direct',
                collectionName: collection.title,
                opType: 'add',
              }) satisfies SearchUpdate,
          ),
        );
        await this.tagRepo.tagProgramGroupings(
          tag.uuid,
          groupings.daos.map((dao) => dao.uuid),
        );
        // For groupings, we also need to expand the hierarchy so we can update nested
        // documents in the search index.
        const allDescendentIds = await this.getAllDescendents(groupings.daos);

        for (const [typ, id] of allDescendentIds) {
          if (typ === 'album' || typ === 'season') {
            searchUpdates.push({
              type: 'parent',
              id,
              collectionName: collection.title,
              opType: 'add',
            });
          } else if (typ === 'episode' || typ === 'track') {
            searchUpdates.push({
              type: 'grandparent',
              id,
              collectionName: collection.title,
              opType: 'add',
            });
          }
        }

        // childSearchDocs.push(
        //   ...(await this.searchService.getPrograms(allDescendentIds)),
        // );
      } else {
        const programs = await this.getProgramsAndSearchDocuments(
          context,
          newKeyChunk,
        );
        searchUpdates.push(
          ...programs.daos.map(
            ({ uuid }) =>
              ({
                type: 'direct',
                id: uuid,
                collectionName: collection.title,
                opType: 'add',
              }) satisfies SearchUpdate,
          ),
        );
        await this.tagRepo.tagPrograms(
          tag.uuid,
          programs.daos.map((dao) => dao.uuid),
        );
      }
    }

    // Removed keys
    let removedKeys: Set<string>;
    if (existingCollectionProgramsByExternalId.type === 'groupings') {
      removedKeys = new Set(
        Object.keys(existingCollectionProgramsByExternalId.groupings),
      ).difference(seenIds);

      const groupingIds = uniq(
        [...removedKeys].flatMap((key) =>
          (existingCollectionProgramsByExternalId.groupings[key] ?? []).map(
            (x) => [x.uuid, x.type] as const,
          ),
        ),
      );

      await this.tagRepo.untagProgramGroupings(tag.uuid, [
        ...groupingIds.map(([id]) => id),
      ]);

      searchUpdates.push(
        ...groupingIds.map(
          ([id]) =>
            ({
              id,
              type: 'direct',
              opType: 'del',
              collectionName: collection.title,
            }) satisfies SearchUpdate,
        ),
      );

      const allDescendentIds = await this.getAllDescendents(
        groupingIds.map(([id, type]) => ({ uuid: id, type })),
      );
      for (const [typ, id] of allDescendentIds) {
        searchUpdates.push({
          collectionName: collection.title,
          id,
          type: isGroupingItemType(typ) ? 'parent' : 'grandparent',
          opType: 'del',
        });
      }
    } else {
      removedKeys = new Set(
        Object.keys(existingCollectionProgramsByExternalId.programs),
      ).difference(seenIds);

      const programIds = uniq(
        [...removedKeys].flatMap((key) =>
          (existingCollectionProgramsByExternalId.programs[key] ?? []).map(
            (x) => x.uuid,
          ),
        ),
      );

      await this.tagRepo.untagPrograms(tag.uuid, programIds);

      searchUpdates.push(
        ...programIds.map(
          (id) =>
            ({
              id,
              type: 'direct',
              opType: 'del',
              collectionName: collection.title,
            }) satisfies SearchUpdate,
        ),
      );
    }

    this.logger.debug(
      'Removing %d tag associations for collection "%s" from %s',
      removedKeys.size,
      collection.title,
      existingCollectionProgramsByExternalId.type,
    );

    return searchUpdates;
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<PlexApiClient> {
    return this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
      mediaSource,
    );
  }

  private async getAllDescendents(
    groupings: { uuid: string; type: ProgramGroupingType }[],
  ): Promise<Array<readonly [ProgramLike['type'], string]>> {
    return uniq(
      (
        await Promise.all(
          groupings.map(({ type, uuid }) => {
            return Promise.all([
              this.programDB
                .getChildren(uuid, type)
                .then((_) =>
                  _.results.map(
                    (
                      p:
                        | ProgramGroupingOrmWithRelations
                        | ProgramWithRelationsOrm,
                    ) => [p.type, p.uuid] as const,
                  ),
                ),
              this.programDB
                .getProgramGroupingDescendants(uuid, type)
                .then((_) => _.map((p) => [p.type, p.uuid] as const)),
            ]).then((_) => uniq(_.flat()));
          }),
        )
      ).flat(),
    );
  }

  private async getProgramsAndSearchDocuments(
    ctx: Context,
    externalKeys: string[],
  ) {
    const externalIds = new Set(
      externalKeys.map((id) => ['plex', ctx.mediaSource.uuid, id] as const),
    );

    const programs = await this.programDB.lookupByExternalIds(externalIds);
    const plexIds = programs
      .flatMap((program) => program.externalIds)
      .filter((eid) => eid.sourceType === 'plex')
      .map((eid) => eid.externalKey);
    const missingIds = difference(externalKeys, plexIds);
    if (missingIds.length > 0) {
      this.logger.warn(
        'Could not resolve programs for %d Plex IDs. IDs: %O',
        missingIds.length,
        missingIds,
      );
    }

    const daoIds = programs.map((group) => group.uuid);

    const docs = await this.searchService.getPrograms(daoIds);
    if (daoIds.length > docs.length) {
      const missingIds = differenceWith(
        daoIds,
        docs,
        (id, doc) => id === doc.id,
      );
      this.logger.warn(
        'Could not find %d documents in the search index. IDs: %O',
        missingIds.length,
        missingIds,
      );
    }

    return {
      daos: programs.map((group) => ({
        uuid: group.uuid,
        type: group.type,
      })),
      searchDocs: docs,
    };
  }

  private async getProgramGroupingsAndSearchDocuments(
    ctx: Context,
    externalKeys: string[],
  ) {
    const externalIds = new Set(
      externalKeys.map((id) => ['plex', ctx.mediaSource.uuid, id] as const),
    );

    const groups =
      await this.programDB.getProgramGroupingsByExternalIds(externalIds);
    const plexIds = groups
      .flatMap((group) => group.externalIds)
      .filter((eid) => eid.sourceType === 'plex')
      .map((eid) => eid.externalKey);
    const missingIds = difference(externalKeys, plexIds);
    if (missingIds.length > 0) {
      this.logger.warn(
        'Could not resolve programs for %d Plex IDs. IDs: %O',
        missingIds.length,
        missingIds,
      );
    }

    const daoIds = groups.map((group) => group.uuid);

    const docs = await this.searchService.getPrograms(daoIds);
    if (daoIds.length > docs.length) {
      const missingIds = differenceWith(
        daoIds,
        docs,
        (id, doc) => id === doc.id,
      );
      this.logger.warn(
        'Could not find %d documents in the search index. IDs: %O',
        missingIds.length,
        missingIds,
      );
    }

    return {
      daos: groups.map((group) => ({
        uuid: group.uuid,
        type: group.type,
      })),
      searchDocs: docs,
    };
  }
}
