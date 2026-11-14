import type { MediaSourceId } from '@tunarr/shared';
import { isNonEmptyString, seq } from '@tunarr/shared/util';
import {
  type Collection,
  isGroupingItemType,
  type ProgramLike,
  type ProgramOrFolder,
} from '@tunarr/types';
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
import type { ExternalCollectionRepo } from '../../db/ExternalCollectionRepo.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { RemoteSourceType } from '../../db/schema/base.ts';
import type {
  ProgramGroupingOrmWithRelations,
  ProgramWithRelationsOrm,
} from '../../db/schema/derivedTypes.ts';
import type { ExternalCollection } from '../../db/schema/ExternalCollection.ts';
import type { MediaSourceOrm } from '../../db/schema/MediaSource.ts';
import type { MediaSourceLibrary } from '../../db/schema/MediaSourceLibrary.ts';
import type { ProgramGroupingType } from '../../db/schema/ProgramGrouping.ts';
import type { Tag } from '../../db/schema/Tag.ts';
import type { TagRepo } from '../../db/TagRepo.ts';
import type { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { Result } from '../../types/result.ts';
import { groupByTyped } from '../../util/index.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type {
  MeilisearchService,
  ProgramIndexPartialUpdate,
} from '../MeilisearchService.ts';
import { BaseMediaSourceScanner } from './MediaSourceScanner.ts';

export type ExternalCollectionScanRequest = {
  mediaSourceId: MediaSourceId;
  force?: boolean;
};

export type ExternalCollectionLibraryScanRequest = {
  libraryId: string;
  force?: boolean;
};

type Context<ApiClientT> = {
  mediaSource: MediaSourceOrm;
  library: MediaSourceLibrary;
  apiClient: ApiClientT;
};

// Update the tags field of the item directly.
type SearchUpdate = {
  type: 'direct' | 'parent' | 'grandparent';
  id: string;
  collectionName: string;
  opType: 'add' | 'del';
};

export abstract class ExternalCollectionScanner<
  ApiClientT,
> extends BaseMediaSourceScanner<ApiClientT, ExternalCollectionScanRequest> {
  abstract get sourceType(): RemoteSourceType;

  abstract getAllLibraryCollections(
    apiClient: ApiClientT,
    libraryExternalKey: string,
  ): AsyncIterable<Collection>;

  abstract getCollectionItems(
    apiClient: ApiClientT,
    libraryId: string,
    collectionId: string,
  ): AsyncIterable<ProgramOrFolder>;

  protected abstract logger: Logger;

  constructor(
    protected mediaSourceDB: MediaSourceDB,
    protected mediaSourceApiFactory: MediaSourceApiFactory,
    protected externalCollectionsRepo: ExternalCollectionRepo,
    protected searchService: MeilisearchService,
    protected programDB: IProgramDB,
    protected tagRepo: TagRepo,
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
      'Scanning %s media source (ID = %s) for collections',
      this.sourceType,
      mediaSource.uuid,
    );

    const enabledLibraries = mediaSource.libraries.filter((lib) => lib.enabled);

    if (enabledLibraries.length === 0) {
      this.logger.debug(
        '%s media source (ID = %s) has no enabled libraries. Skipping collections scan',
        this.sourceType,
        mediaSource.uuid,
      );
      return;
    }

    const apiClient = await this.getApiClient(mediaSource);
    const existingCollections = await this.getCollectionsByExternalKey(
      mediaSource.uuid,
    );
    const seenIds = new Set<string>();
    let anyLibraryFailed = false;

    for (const library of enabledLibraries) {
      const result = await Result.attemptAsync(() =>
        this.scanLibraryInternal(
          {
            mediaSource,
            library,
            apiClient,
          },
          existingCollections,
          seenIds,
        ),
      );
      if (result.isFailure()) {
        anyLibraryFailed = true;
        this.logger.warn(
          result.error,
          'Failure while scanning %s library (%s) for collections',
          this.sourceType,
          library.name,
        );
        continue;
      }

      // Only a library that finished adds its IDs. A failed library never
      // sent its search updates, so later libraries redo its collections.
      for (const id of result.getOrThrow()) {
        seenIds.add(id);
      }
    }

    // A failed library may still return collections that no other library
    // does, so deleting now could drop collections that still exist.
    if (anyLibraryFailed) {
      this.logger.debug(
        'Skipping removal of missing %s collections because a library scan failed',
        this.sourceType,
      );
      return;
    }

    // A BoxSet can come back through several libraries, so a collection is
    // gone only when no library returned it.
    const enabledLibraryIds = new Set(enabledLibraries.map((lib) => lib.uuid));
    const missingCollections = [...existingCollections.values()].filter(
      (coll) =>
        enabledLibraryIds.has(coll.libraryId) && !seenIds.has(coll.externalKey),
    );

    if (missingCollections.length > 0) {
      await this.searchService.waitForPendingIndexTasks();
      await this.applySearchUpdates(
        await this.deleteCollections(missingCollections),
      );
    }
  }

  /**
   * Adds and updates the collections that one library returns. It never
   * deletes collections, because another library of the same media source
   * may still return them. {@link scan} removes missing collections.
   */
  async scanLibrary(req: ExternalCollectionLibraryScanRequest): Promise<void> {
    const library = await this.mediaSourceDB.getLibrary(req.libraryId);
    if (!library) {
      throw new Error(
        `Could not find media source library with ID ${req.libraryId}`,
      );
    }

    this.logger.debug(
      'Scanning %s collections for library %s',
      this.sourceType,
      library.name,
    );

    if (!library.enabled) {
      this.logger.debug(
        'Skipping %s collection scan for library %s because it is disabled',
        this.sourceType,
        req.libraryId,
      );
      return;
    }

    if (library.mediaSource.type !== this.sourceType) {
      throw new Error(
        `Tried to scan library ID ${req.libraryId} but it belongs to a non-${this.sourceType} media source (actual type = ${library.mediaSource.type})`,
      );
    }

    const apiClient = await this.getApiClient({
      ...library.mediaSource,
      libraries: [library],
    });

    await this.scanLibraryInternal(
      {
        apiClient,
        library,
        mediaSource: library.mediaSource,
      },
      await this.getCollectionsByExternalKey(library.mediaSource.uuid),
      new Set(),
    );
  }

  private async getCollectionsByExternalKey(mediaSourceId: MediaSourceId) {
    const collections =
      await this.externalCollectionsRepo.getByMediaSourceId(mediaSourceId);
    return new Map(collections.map((coll) => [coll.externalKey, coll]));
  }

  /**
   * Collection rows are unique per media source, not per library, so
   * `existingCollections` holds every row of the media source. Rows this
   * scan inserts are added to it.
   *
   * `scannedIds` holds collections that earlier libraries in the same scan
   * already handled. A Jellyfin or Emby BoxSet lists the same items through
   * every library, so they are skipped. Plex collections belong to a single
   * library and never repeat.
   *
   * @returns the external IDs of the collections the library returned
   */
  private async scanLibraryInternal(
    ctx: Context<ApiClientT>,
    existingCollections: Map<string, ExternalCollection>,
    scannedIds: ReadonlySet<string>,
  ): Promise<Set<string>> {
    await this.searchService.waitForPendingIndexTasks();
    this.logger.debug(
      'Scanning %s library "%s" for collections',
      this.sourceType,
      ctx.library.name,
    );
    const seenIds = new Set<string>();
    const searchUpdates: SearchUpdate[] = [];
    for await (const collection of this.getAllLibraryCollections(
      ctx.apiClient,
      ctx.library.externalKey,
    )) {
      if (
        seenIds.has(collection.externalId) ||
        scannedIds.has(collection.externalId)
      ) {
        continue;
      }
      seenIds.add(collection.externalId);
      // Upsert a tag for this collection name
      const tag = await this.tagRepo.upsertTag(collection.title);

      let existingCollection = existingCollections.get(collection.externalId);
      if (!existingCollection) {
        existingCollection = {
          uuid: v4(),
          externalKey: collection.externalId,
          libraryId: ctx.library.uuid,
          mediaSourceId: ctx.mediaSource.uuid,
          sourceType: this.sourceType,
          title: collection.title,
        };

        await this.externalCollectionsRepo.insertCollection(existingCollection);
        existingCollections.set(collection.externalId, existingCollection);
      } else if (existingCollection.title !== collection.title) {
        existingCollection = { ...existingCollection, title: collection.title };
        await this.externalCollectionsRepo.updateCollectionTitle(
          existingCollection.uuid,
          collection.title,
        );
        existingCollections.set(collection.externalId, existingCollection);
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

    await this.applySearchUpdates(searchUpdates);

    return seenIds;
  }

  private async deleteCollections(
    missingCollections: ExternalCollection[],
  ): Promise<SearchUpdate[]> {
    const searchUpdates: SearchUpdate[] = [];
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
    return searchUpdates;
  }

  private async applySearchUpdates(searchUpdates: SearchUpdate[]) {
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
          updatesByType.get('direct') ?? [],
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
          tags: isEmpty(updatesByType.get('direct') ?? [])
            ? undefined
            : [...newTags.values()],
        };

        if (doc.parent && !isEmpty(updatesByType.get('parent') ?? [])) {
          const currentParentTags = new Set(doc.parent.tags);
          const [parentAdds, parentDels] = partition(
            updatesByType.get('parent') ?? [],
            (up) => up.opType === 'add',
          );
          const newParentTags = currentParentTags
            .union(
              new Set(parentAdds.map(({ collectionName }) => collectionName)),
            )
            .difference(
              new Set(parentDels.map(({ collectionName }) => collectionName)),
            );
          partialUpdate.parent = {
            ...doc.parent,
            tags: [...newParentTags.values()],
          };
        }

        if (
          doc.grandparent &&
          !isEmpty(updatesByType.get('grandparent') ?? [])
        ) {
          const currentGrandparentTags = new Set(doc.grandparent.tags);
          const [adds, dels] = partition(
            updatesByType.get('grandparent') ?? [],
            (up) => up.opType === 'add',
          );
          const newGrandparentTags = currentGrandparentTags
            .union(new Set(adds.map(({ collectionName }) => collectionName)))
            .difference(
              new Set(dels.map(({ collectionName }) => collectionName)),
            );
          partialUpdate.grandparent = {
            ...doc.grandparent,
            tags: [...newGrandparentTags.values()],
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
        'Sending %d %s collection tag updates to search server',
        partialPrograms.length,
        this.sourceType,
      );

      await this.searchService.updatePrograms(partialPrograms);
    }
  }

  private async enumerateCollection(
    collectionDao: ExternalCollection,
    collection: Collection,
    tag: Tag,
    context: Context<ApiClientT>,
  ): Promise<SearchUpdate[]> {
    this.logger.debug('Scanning collection "%s"', collection.title);
    const it = this.getCollectionItems(
      context.apiClient,
      context.library.uuid,
      collection.externalId,
    );

    // Fetch existing associations for both groupings and programs
    const [existingGroupingsByExternalId, existingProgramsByExternalId] =
      await Promise.all([
        this.externalCollectionsRepo
          .getCollectionProgramGroupings(collectionDao.uuid)
          .then((groupings) =>
            groupBy(
              compact(groupings).filter((g) => isNonEmptyString(g.externalKey)),
              (g) => g.externalKey!,
            ),
          ),
        this.externalCollectionsRepo
          .getCollectionPrograms(collectionDao.uuid)
          .then((programs) =>
            groupBy(
              compact(programs).filter((p) => isNonEmptyString(p.externalKey)),
              (p) => p.externalKey,
            ),
          ),
      ]);

    // Partition items by type: groupings (shows/seasons/artists/albums) vs
    // terminal programs (movies/episodes/tracks/etc.). JF/Emby BoxSets can be
    // mixed, so we partition rather than relying on a collection-level childType.
    const seenGroupingIds = new Set<string>();
    const seenProgramIds = new Set<string>();

    for await (const item of it) {
      if (isGroupingItemType(item.type)) {
        seenGroupingIds.add(item.externalId);
      } else {
        seenProgramIds.add(item.externalId);
      }
    }

    const newGroupingKeys = seenGroupingIds.difference(
      new Set(Object.keys(existingGroupingsByExternalId)),
    );
    const newProgramKeys = seenProgramIds.difference(
      new Set(Object.keys(existingProgramsByExternalId)),
    );

    this.logger.debug(
      'Adding %d grouping and %d program tag associations for collection "%s"',
      newGroupingKeys.size,
      newProgramKeys.size,
      collection.title,
    );

    const searchUpdates: SearchUpdate[] = [];

    // Process new groupings
    for (const newKeyChunk of chunk([...newGroupingKeys], 100)) {
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
    }

    // Process new programs
    for (const newKeyChunk of chunk([...newProgramKeys], 100)) {
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

    // Process removed groupings
    const removedGroupingKeys = new Set(
      Object.keys(existingGroupingsByExternalId),
    ).difference(seenGroupingIds);

    const groupingIds = uniq(
      [...removedGroupingKeys].flatMap((key) =>
        (existingGroupingsByExternalId[key] ?? []).map(
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

    const groupingDescendantIds = await this.getAllDescendents(
      groupingIds.map(([id, type]) => ({ uuid: id, type })),
    );
    for (const [typ, id] of groupingDescendantIds) {
      searchUpdates.push({
        collectionName: collection.title,
        id,
        type: isGroupingItemType(typ) ? 'parent' : 'grandparent',
        opType: 'del',
      });
    }

    // Process removed programs
    const removedProgramKeys = new Set(
      Object.keys(existingProgramsByExternalId),
    ).difference(seenProgramIds);

    const programIds = uniq(
      [...removedProgramKeys].flatMap((key) =>
        (existingProgramsByExternalId[key] ?? []).map((x) => x.uuid),
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

    this.logger.debug(
      'Removing %d grouping and %d program tag associations for collection "%s"',
      removedGroupingKeys.size,
      removedProgramKeys.size,
      collection.title,
    );

    return searchUpdates;
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
    ctx: Context<ApiClientT>,
    externalKeys: string[],
  ) {
    const externalIds = new Set(
      externalKeys.map(
        (id) => [this.sourceType, ctx.mediaSource.uuid, id] as const,
      ),
    );

    const programs = await this.programDB.lookupByExternalIds(externalIds);
    const foundIds = programs
      .flatMap((program) => program.externalIds)
      .filter((eid) => eid.sourceType === this.sourceType)
      .map((eid) => eid.externalKey);
    const missingIds = difference(externalKeys, foundIds);
    if (missingIds.length > 0) {
      this.logger.warn(
        'Could not resolve programs for %d %s IDs. IDs: %O',
        missingIds.length,
        this.sourceType,
        missingIds,
      );
    }

    const daoIds = programs.map((group) => group.uuid);

    const docs = await this.searchService.getPrograms(daoIds);
    if (daoIds.length > docs.length) {
      const missingDocIds = differenceWith(
        daoIds,
        docs,
        (id, doc) => id === doc.id,
      );
      this.logger.warn(
        'Could not find %d documents in the search index. IDs: %O',
        missingDocIds.length,
        missingDocIds,
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
    ctx: Context<ApiClientT>,
    externalKeys: string[],
  ) {
    const externalIds = new Set(
      externalKeys.map(
        (id) => [this.sourceType, ctx.mediaSource.uuid, id] as const,
      ),
    );

    const groups =
      await this.programDB.getProgramGroupingsByExternalIds(externalIds);
    const foundIds = groups
      .flatMap((group) => group.externalIds)
      .filter((eid) => eid.sourceType === this.sourceType)
      .map((eid) => eid.externalKey);
    const missingIds = difference(externalKeys, foundIds);
    if (missingIds.length > 0) {
      this.logger.warn(
        'Could not resolve program groupings for %d %s IDs. IDs: %O',
        missingIds.length,
        this.sourceType,
        missingIds,
      );
    }

    const daoIds = groups.map((group) => group.uuid);

    const docs = await this.searchService.getPrograms(daoIds);
    if (daoIds.length > docs.length) {
      const missingDocIds = differenceWith(
        daoIds,
        docs,
        (id, doc) => id === doc.id,
      );
      this.logger.warn(
        'Could not find %d documents in the search index. IDs: %O',
        missingDocIds.length,
        missingDocIds,
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

export type GenericExternalCollectionScanner =
  ExternalCollectionScanner<unknown>;
