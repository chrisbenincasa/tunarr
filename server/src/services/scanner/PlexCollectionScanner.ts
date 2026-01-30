import { isNonEmptyString, seq } from '@tunarr/shared/util';
import { Collection } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import {
  chunk,
  compact,
  difference,
  differenceWith,
  groupBy,
  reject,
  uniq,
} from 'lodash-es';
import { match, P } from 'ts-pattern';
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
import { Tag } from '../../db/schema/Tag.ts';
import { TagRepo } from '../../db/TagRepo.ts';
import { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import type { PlexApiClient } from '../../external/plex/PlexApiClient.ts';
import { KEYS } from '../../types/inject.ts';
import { Result } from '../../types/result.ts';
import { groupByUniq } from '../../util/index.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import {
  MeilisearchService,
  ProgramIndexPartialUpdate,
  ProgramSearchDocument,
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

      await this.enumerateCollection(existingCollection, collection, tag, ctx);
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

      const allRelatedIds = seq
        .collect(collection.groupings, (g) => g.grouping?.uuid)
        .concat(seq.collect(collection.programs, (p) => p.program?.uuid));
      const documents = await this.searchService.getPrograms(allRelatedIds);

      const updates = documents.map(
        (doc) =>
          ({
            id: doc.id,
            tags: reject(doc.tags, (tag) => tag === collection.title),
          }) satisfies ProgramIndexPartialUpdate,
      );

      await this.searchService.updatePrograms(updates);
      await this.externalCollectionsRepo.deleteCollection(collection.uuid);
    }
  }

  private async enumerateCollection(
    collectionDao: ExternalCollection,
    collection: Collection,
    tag: Tag,
    context: Context,
  ) {
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

    for (const newKeyChunk of chunk([...newKeys], 100)) {
      let searchDocs: ProgramSearchDocument[];
      const childSearchDocs: ProgramSearchDocument[] = [];
      if (isGroupingCollectionType) {
        const groupings = await this.getProgramGroupingsAndSearchDocuments(
          context,
          newKeyChunk,
        );
        searchDocs = groupings.searchDocs;
        await this.tagRepo.tagProgramGroupings(
          tag.uuid,
          groupings.daos.map((dao) => dao.uuid),
        );
        // For groupings, we also need to expand the hierarchy so we can update nested
        // documents in the search index.
        const allDescendentIds = uniq(
          (
            await Promise.all(
              groupings.daos.map(({ type, uuid }) => {
                return Promise.all([
                  this.programDB
                    .getChildren(uuid, type)
                    .then((_) =>
                      _.results.map(
                        (
                          p:
                            | ProgramGroupingOrmWithRelations
                            | ProgramWithRelationsOrm,
                        ) => p.uuid,
                      ),
                    ),
                  this.programDB
                    .getProgramGroupingDescendants(uuid, type)
                    .then((_) => _.map((p) => p.uuid)),
                ]).then((_) => uniq(_.flat()));
              }),
            )
          ).flat(),
        );
        childSearchDocs.push(
          ...(await this.searchService.getPrograms(allDescendentIds)),
        );
      } else {
        const programs = await this.getProgramsAndSearchDocuments(
          context,
          newKeyChunk,
        );
        searchDocs = programs.searchDocs;
        await this.tagRepo.tagPrograms(
          tag.uuid,
          programs.daos.map((dao) => dao.uuid),
        );
      }

      const updates: ProgramIndexPartialUpdate[] = searchDocs.map((doc) => {
        return {
          id: doc.id,
          tags: uniq(doc.tags.concat(collection.title)),
        };
      });

      // Update any children we have too.
      const childUpdates: ProgramIndexPartialUpdate[] = seq.collect(
        childSearchDocs,
        (doc) => {
          return match(doc)
            .with(
              { type: P.union('episode', 'track'), grandparent: P.nonNullable },
              (doc) => {
                return {
                  id: doc.id,
                  grandparent: {
                    ...doc.grandparent,
                    tags: uniq(doc.grandparent.tags.concat(collection.title)),
                  },
                } satisfies ProgramIndexPartialUpdate;
              },
            )
            .with(
              { type: P.union('album', 'season'), parent: P.nonNullable },
              (doc) => {
                return {
                  id: doc.id,
                  parent: {
                    ...doc.parent,
                    tags: uniq(doc.parent.tags.concat(collection.title)),
                  },
                } satisfies ProgramIndexPartialUpdate;
              },
            )
            .otherwise(() => null);
        },
      );

      await this.searchService.updatePrograms(updates.concat(childUpdates));
    }

    // Removed keys
    let removedKeys: Set<string>;
    if (existingCollectionProgramsByExternalId.type === 'groupings') {
      removedKeys = new Set(
        Object.keys(existingCollectionProgramsByExternalId.groupings),
      ).difference(seenIds);

      await this.tagRepo.untagProgramGroupings(tag.uuid, [
        ...removedKeys.values(),
      ]);
    } else {
      removedKeys = new Set(
        Object.keys(existingCollectionProgramsByExternalId.programs),
      ).difference(seenIds);

      await this.tagRepo.untagPrograms(tag.uuid, [...removedKeys.values()]);
    }

    this.logger.debug(
      'Removing %d tag associtions for collection "%s" from %s',
      removedKeys.size,
      collection.title,
      existingCollectionProgramsByExternalId.type,
    );

    for (const removedKeyChunk of chunk([...removedKeys.values()], 100)) {
      let daoIds: string[];
      if (existingCollectionProgramsByExternalId.type === 'groupings') {
        daoIds = seq
          .collect(
            removedKeyChunk,
            (key) => existingCollectionProgramsByExternalId.groupings[key],
          )
          .flatMap((groups) => groups.map((group) => group.uuid));
      } else {
        daoIds = seq
          .collect(
            removedKeyChunk,
            (key) => existingCollectionProgramsByExternalId.programs[key],
          )
          .flatMap((programs) => programs.map((program) => program.uuid));
      }
      const searchDocs = await this.searchService.getPrograms(daoIds);
      const updates = searchDocs.map(
        (doc) =>
          ({
            id: doc.id,
            tags: reject(doc.tags, (tag) => tag === collection.title),
          }) satisfies ProgramIndexPartialUpdate,
      );
      await this.searchService.updatePrograms(updates);
    }
  }

  protected getApiClient(
    mediaSource: MediaSourceWithRelations,
  ): Promise<PlexApiClient> {
    return this.mediaSourceApiFactory.getPlexApiClientForMediaSource(
      mediaSource,
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
