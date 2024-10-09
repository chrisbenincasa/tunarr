import { Loaded, ref } from '@mikro-orm/better-sqlite';
import { createExternalId } from '@tunarr/shared';
import { JellyfinItem, isJellyfinType } from '@tunarr/types/jellyfin';
import {
  PlexMedia,
  isPlexMusicAlbum,
  isPlexMusicTrack,
  isPlexSeason,
  isPlexShow,
} from '@tunarr/types/plex';
import {
  chunk,
  find,
  flatten,
  forEach,
  isEmpty,
  isUndefined,
  map,
  partition,
} from 'lodash-es';
import { QueryResult } from '../external/BaseApiClient.js';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.js';
import { Maybe } from '../types/util.js';
import { asyncPool } from '../util/asyncPool.js';
import {
  groupByUniqPropAndMap,
  mapAsyncSeq,
  nullToUndefined,
} from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { ProgramExternalIdType } from './custom_types/ProgramExternalIdType.js';
import { getEm } from './dataSource.js';
import { ProgramType } from './entities/Program.js';
import {
  ProgramGrouping,
  programGroupingTypeForJellyfinType,
  programGroupingTypeForString,
} from './entities/ProgramGrouping.js';
import { ProgramGroupingExternalId } from './entities/ProgramGroupingExternalId.js';
import { ProgramDB } from './programDB.js';

export class ProgramGroupingCalculator {
  #logger = LoggerFactory.child({ className: ProgramGroupingCalculator.name });

  constructor(private programDB: ProgramDB = new ProgramDB()) {}

  async createHierarchyForManyFromPlex(
    programType: ProgramType,
    plexServerName: string,
    programIds: { programId: string; plexId: string; parentKey: string }[],
    parentKeys: string[],
    grandparentKey: string,
  ) {
    if (
      programType !== ProgramType.Episode &&
      programType !== ProgramType.Track
    ) {
      return;
    }

    const parentKeyByProgramId = groupByUniqPropAndMap(
      programIds,
      'programId',
      ({ parentKey }) => parentKey,
    );

    const programs = await this.programDB.getProgramsByIds(
      map(programIds, 'programId'),
    );

    const em = getEm();

    const existingParents = flatten(
      await mapAsyncSeq(
        chunk([...parentKeys], 25),
        (chunk) => {
          const ors = map(
            chunk,
            (id) =>
              ({
                sourceType: ProgramExternalIdType.PLEX,
                externalKey: id,
                externalSourceId: plexServerName,
              }) as const,
          );

          return em.find(
            ProgramGrouping,
            {
              externalRefs: {
                $or: ors,
              },
            },
            {
              populate: ['externalRefs'],
              fields: ['uuid', 'type'],
            },
          );
        },
        { parallelism: 2 },
      ),
    );

    const grandparent = await em.findOne(
      ProgramGrouping,
      {
        externalRefs: {
          sourceType: ProgramExternalIdType.PLEX,
          externalKey: grandparentKey,
          externalSourceId: plexServerName,
        },
      },
      {
        populate: [
          'externalRefs',
          'seasons:ref',
          'showEpisodes:ref',
          'albums:ref',
          'albumTracks:ref',
        ],
        fields: ['uuid', 'type'],
      },
    );

    if (isEmpty(programs)) {
      return;
    }

    const [validPrograms, invalidPrograms] = partition(
      programs,
      (p) => p.type === programType,
    );

    if (isEmpty(validPrograms)) {
      return;
    } else if (invalidPrograms.length > 0) {
      this.#logger.debug(
        "Found %d programs that don't have the correct type: %O",
        invalidPrograms.length,
        invalidPrograms,
      );
    }

    const plexApi = await MediaSourceApiFactory().getOrSet(plexServerName);

    if (!plexApi) {
      return;
    }

    const maybeGrandparentAndRef = this.handlePlexGrouping(
      grandparent,
      await plexApi.getItemMetadata(grandparentKey),
      plexServerName,
    );
    let newOrUpdatedGrandparent: Maybe<ProgramGrouping>;
    if (maybeGrandparentAndRef) {
      newOrUpdatedGrandparent = maybeGrandparentAndRef[0];
    }

    const newOrUpdatedParents: ProgramGrouping[] = [];
    const parentGroupingsByRef: Record<string, string> = {};
    for await (const plexResult of asyncPool(
      parentKeys,
      (key) => plexApi.getItemMetadata(key),
      { concurrency: 2 },
    )) {
      if (plexResult.type === 'error') {
        this.#logger.error(
          plexResult.error,
          'Error querying Plex for item: %s',
          plexResult.input,
        );
        continue;
      }

      const existing = find(existingParents, (parent) =>
        parent.externalRefs.exists(
          (ref) =>
            ref.externalKey === plexResult.input &&
            ref.sourceType === ProgramExternalIdType.PLEX &&
            ref.externalSourceId === plexServerName,
        ),
      );
      const daos = this.handlePlexGrouping(
        existing ?? null,
        plexResult.result,
        plexServerName,
      );
      if (daos) {
        const [grouping, ref] = daos;
        newOrUpdatedParents.push(grouping);
        parentGroupingsByRef[ref.toExternalIdString()] = grouping.uuid;
      }
    }

    const entities = [
      ...(newOrUpdatedGrandparent ? [newOrUpdatedGrandparent] : []),
      ...newOrUpdatedParents,
    ];

    await em.transactional((em) =>
      em.upsertMany(ProgramGrouping, entities, {
        batchSize: 50,
        onConflictFields: ['uuid'],
        onConflictAction: 'merge',
        onConflictExcludeFields: ['uuid'],
      }),
    );

    // Create the relations...
    forEach(programs, (program) => {
      switch (program.type) {
        case ProgramType.Movie:
          break;
        case ProgramType.Episode: {
          if (newOrUpdatedGrandparent) {
            program.tvShow = ref(newOrUpdatedGrandparent);
          }
          const parentKey = parentKeyByProgramId[program.uuid];
          if (parentKey) {
            const grouping =
              parentGroupingsByRef[
                createExternalId('plex', plexServerName, parentKey)
              ];
            if (grouping) {
              program.season = ref(em.getReference(ProgramGrouping, grouping));
            }
          }
          break;
        }
        case ProgramType.Track: {
          if (newOrUpdatedGrandparent) {
            program.artist = ref(newOrUpdatedGrandparent);
          }
          const parentKey = parentKeyByProgramId[program.uuid];
          if (parentKey) {
            const grouping =
              parentGroupingsByRef[
                createExternalId('plex', plexServerName, parentKey)
              ];
            if (grouping) {
              program.album = ref(em.getReference(ProgramGrouping, grouping));
            }
          }
          break;
        }
        default:
          break;
      }
    });

    await em.flush();
  }

  async createHierarchyForManyFromJellyfin(
    programType: ProgramType,
    jellyfinServerName: string,
    programIds: {
      programId: string;
      jellyfinItemId: string;
      parentKey: string;
    }[],
    parentKeys: string[],
    grandparentKey: string,
  ) {
    if (
      programType !== ProgramType.Episode &&
      programType !== ProgramType.Track
    ) {
      return;
    }

    const parentKeyByProgramId = groupByUniqPropAndMap(
      programIds,
      'programId',
      ({ parentKey }) => parentKey,
    );

    const programs = await this.programDB.getProgramsByIds(
      map(programIds, 'programId'),
    );

    const em = getEm();

    const existingParents = flatten(
      await mapAsyncSeq(
        chunk(parentKeys, 25),
        (chunk) => {
          const ors = map(
            chunk,
            (id) =>
              ({
                sourceType: ProgramExternalIdType.JELLYFIN,
                externalKey: id,
                externalSourceId: jellyfinServerName,
              }) as const,
          );

          return em.find(
            ProgramGrouping,
            {
              externalRefs: {
                $or: ors,
              },
            },
            {
              populate: ['externalRefs'],
              fields: ['uuid', 'type'],
            },
          );
        },
        { parallelism: 2 },
      ),
    );

    const grandparent = await em.findOne(
      ProgramGrouping,
      {
        externalRefs: {
          sourceType: ProgramExternalIdType.JELLYFIN,
          externalKey: grandparentKey,
          externalSourceId: jellyfinServerName,
        },
      },
      {
        populate: [
          'externalRefs',
          'seasons:ref',
          'showEpisodes:ref',
          'albums:ref',
          'albumTracks:ref',
        ],
        fields: ['uuid', 'type'],
      },
    );

    if (isEmpty(programs)) {
      return;
    }

    const [validPrograms, invalidPrograms] = partition(
      programs,
      (p) => p.type === programType,
    );

    if (isEmpty(validPrograms)) {
      return;
    } else if (invalidPrograms.length > 0) {
      this.#logger.debug(
        "Found %d programs that don't have the correct type: %O",
        invalidPrograms.length,
        invalidPrograms,
      );
    }

    const jellyfinApi =
      await MediaSourceApiFactory().getJellyfinByName(jellyfinServerName);

    if (!jellyfinApi) {
      return;
    }

    const maybeGrandparentAndRef = this.handleJellyfinGrouping(
      grandparent,
      await jellyfinApi.getItem(grandparentKey),
      jellyfinServerName,
    );
    let newOrUpdatedGrandparent: Maybe<ProgramGrouping>;
    if (maybeGrandparentAndRef) {
      newOrUpdatedGrandparent = maybeGrandparentAndRef[0];
    }

    const newOrUpdatedParents: ProgramGrouping[] = [];
    const parentGroupingsByRef: Record<string, string> = {};
    // TODO Jellyfin supports getting items by ID in batch
    for await (const jellyfinResult of asyncPool(
      parentKeys,
      (key) => jellyfinApi.getItem(key),
      { concurrency: 2 },
    )) {
      if (jellyfinResult.type === 'error') {
        this.#logger.error(
          jellyfinResult.error,
          'Error querying Plex for item: %s',
          jellyfinResult.input,
        );
        continue;
      }

      const existing = find(existingParents, (parent) =>
        parent.externalRefs.exists(
          (ref) =>
            ref.externalKey === jellyfinResult.input &&
            ref.sourceType === ProgramExternalIdType.JELLYFIN &&
            ref.externalSourceId === jellyfinServerName,
        ),
      );
      const daos = this.handleJellyfinGrouping(
        existing ?? null,
        jellyfinResult.result,
        jellyfinServerName,
      );
      if (daos) {
        const [grouping, ref] = daos;
        newOrUpdatedParents.push(grouping);
        parentGroupingsByRef[ref.toExternalIdString()] = grouping.uuid;
      }
    }

    const entities = [
      ...(newOrUpdatedGrandparent ? [newOrUpdatedGrandparent] : []),
      ...newOrUpdatedParents,
    ];

    await em.transactional((em) =>
      em.upsertMany(ProgramGrouping, entities, {
        batchSize: 50,
        onConflictFields: ['uuid'],
        onConflictAction: 'merge',
        onConflictExcludeFields: ['uuid'],
      }),
    );

    // Create the relations...
    forEach(programs, (program) => {
      switch (program.type) {
        case ProgramType.Movie:
          break;
        case ProgramType.Episode: {
          if (newOrUpdatedGrandparent) {
            program.tvShow = ref(newOrUpdatedGrandparent);
          }
          const parentKey = parentKeyByProgramId[program.uuid];
          if (parentKey) {
            const grouping =
              parentGroupingsByRef[
                createExternalId('jellyfin', jellyfinServerName, parentKey)
              ];
            if (grouping) {
              program.season = ref(em.getReference(ProgramGrouping, grouping));
            }
          }
          break;
        }
        case ProgramType.Track: {
          if (newOrUpdatedGrandparent) {
            program.artist = ref(newOrUpdatedGrandparent);
          }
          const parentKey = parentKeyByProgramId[program.uuid];
          if (parentKey) {
            const grouping =
              parentGroupingsByRef[
                createExternalId('jellyfin', jellyfinServerName, parentKey)
              ];
            if (grouping) {
              program.album = ref(em.getReference(ProgramGrouping, grouping));
            }
          }
          break;
        }
        default:
          break;
      }
    });

    await em.flush();
  }

  private handlePlexGrouping(
    existing: Loaded<
      ProgramGrouping,
      'externalRefs',
      'uuid' | 'type',
      never
    > | null,
    queryResult: QueryResult<PlexMedia>,
    plexServerName: string,
  ): Maybe<[ProgramGrouping, ProgramGroupingExternalId]> {
    if (queryResult.type === 'error') {
      this.#logger.error(
        'Error requesting item rom Plex: %O %s',
        queryResult.code,
        queryResult.message ?? '<no message>',
      );
      return;
    }

    const item = queryResult.data;
    if (
      !(
        isPlexShow(item) ||
        isPlexSeason(item) ||
        isPlexMusicTrack(item) ||
        isPlexMusicAlbum(item)
      )
    ) {
      this.#logger.error(
        'Requested Plex item was not a valid grouping type. Got: %s for key %s',
        item.type,
        item.ratingKey,
      );
      return;
    }

    if (existing && existing.type.toString() !== item.type) {
      this.#logger.error(
        'Program grouping type mismatch: %s existing and %s incoming. Logic error',
        existing.type,
        item.type,
      );
      return;
    }

    const baseFields: Pick<ProgramGrouping, 'title' | 'summary' | 'icon'> = {
      title: item.title,
      summary: item.summary,
      icon: item.thumb,
    };

    const em = getEm();
    const entity = em.create(
      ProgramGrouping,
      {
        ...baseFields,
        type: programGroupingTypeForString(item.type)!,
        index: item.index,
      },
      { persist: false },
    );

    const ref = em.create(
      ProgramGroupingExternalId,
      {
        externalKey: item.ratingKey,
        externalSourceId: plexServerName,
        sourceType: ProgramExternalIdType.PLEX,
        group: entity,
      },
      { persist: false },
    );

    // grouping.externalRefs.add(ref);

    if (existing) {
      entity.uuid = existing.uuid;
      if (
        !existing.externalRefs.exists(
          (er) =>
            er.externalKey === item.ratingKey &&
            er.externalSourceId === plexServerName &&
            er.sourceType === ProgramExternalIdType.PLEX,
        )
      ) {
        entity.externalRefs.add(ref);
      }
    } else {
      entity.externalRefs.add(ref);
    }

    return [entity, ref] as const;
  }

  private handleJellyfinGrouping(
    existing: Loaded<
      ProgramGrouping,
      'externalRefs',
      'uuid' | 'type',
      never
    > | null,
    queryResult: QueryResult<Maybe<JellyfinItem>>,
    jellyfinServerName: string,
  ): Maybe<[ProgramGrouping, ProgramGroupingExternalId]> {
    if (queryResult.type === 'error') {
      this.#logger.error(
        'Error requesting item from Jellyfin: %O %s',
        queryResult.code,
        queryResult.message ?? '<no message>',
      );
      return;
    } else if (isUndefined(queryResult.data)) {
      this.#logger.error('Item not found in Jellyfin');
    }

    const item = queryResult.data!;
    if (!isJellyfinType(item, ['Audio', 'Season', 'Series', 'MusicAlbum'])) {
      this.#logger.error(
        'Requested Jellyfin item was not a valid grouping type. Got: %s for key %s',
        item.Type,
        item.Id,
      );
      return;
    }

    if (
      existing &&
      existing.type !== programGroupingTypeForJellyfinType(item.Type)
    ) {
      this.#logger.error(
        'Program grouping type mismatch: %s existing and %s incoming. Logic error',
        existing.type,
        item.Type,
      );
      return;
    }

    const baseFields: Pick<ProgramGrouping, 'title' | 'summary' | 'icon'> = {
      title: item.Name ?? '',
      summary: nullToUndefined(item.Overview),
    };

    const em = getEm();
    const entity = em.create(
      ProgramGrouping,
      {
        ...baseFields,
        type: programGroupingTypeForJellyfinType(item.Type)!,
        index: item.IndexNumber,
        year: item.ProductionYear,
      },
      { persist: false },
    );

    const ref = em.create(
      ProgramGroupingExternalId,
      {
        externalKey: item.Id,
        externalSourceId: jellyfinServerName,
        sourceType: ProgramExternalIdType.JELLYFIN,
        group: entity,
      },
      { persist: false },
    );

    if (existing) {
      entity.uuid = existing.uuid;
      if (
        !existing.externalRefs.exists(
          (er) =>
            er.externalKey === item.Id &&
            er.externalSourceId === jellyfinServerName &&
            er.sourceType === ProgramExternalIdType.JELLYFIN,
        )
      ) {
        entity.externalRefs.add(ref);
      }
    } else {
      entity.externalRefs.add(ref);
    }

    return [entity, ref] as const;
  }
}
