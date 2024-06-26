import { Loaded, ref } from '@mikro-orm/core';
import { ContentProgram } from '@tunarr/types';
import {
  PlexEpisode,
  PlexLibraryMusic,
  PlexLibraryShows,
  PlexMusicAlbumView,
  PlexMusicTrack,
  PlexSeasonView,
  isPlexEpisode,
  isPlexMusicTrack,
} from '@tunarr/types/plex';
import * as ld from 'lodash-es';
import {
  chunk,
  concat,
  find,
  flatten,
  forEach,
  groupBy,
  has,
  isEmpty,
  isNil,
  isUndefined,
  keys,
  map,
  mapValues,
  reduce,
  reject,
  round,
  values,
} from 'lodash-es';
import { PlexApiFactory } from '../external/PlexApiFactory.js';
import {
  flipMap,
  groupByUniqFunc,
  ifDefined,
  isNonEmptyString,
  mapAsyncSeq,
  mapReduceAsyncSeq,
} from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { timeAsync } from '../util/perf.js';
import { ProgramExternalIdType } from './custom_types/ProgramExternalIdType.js';
import { ProgramSourceType } from './custom_types/ProgramSourceType.js';
import { getEm } from './dataSource.js';
import { PlexServerSettings } from './entities/PlexServerSettings.js';
import { Program, ProgramType } from './entities/Program.js';
import {
  ProgramGrouping,
  ProgramGroupingType,
} from './entities/ProgramGrouping.js';
import { ProgramGroupingExternalId } from './entities/ProgramGroupingExternalId.js';

type ProgramsBySource = Record<
  NonNullable<ContentProgram['externalSourceType']>,
  Record<string, ContentProgram[]>
>;

type GroupingIdAndPlexInfo = {
  uuid: string;
  externalKey: string;
  externalSourceId: string;
};

type ProgramGroupingsByType = Record<
  ProgramGroupingType,
  GroupingIdAndPlexInfo[]
>;

function typedKeys<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<keyof any, unknown>,
  KeyType = T extends Record<infer K, unknown> ? K : never,
>(record: T): KeyType[] {
  return keys(record) as KeyType[];
}

export class LegacyProgramGroupingCalculator {
  private logger = LoggerFactory.child({
    className: LegacyProgramGroupingCalculator.name,
  });

  async calculateGroupings(
    contentPrograms: ContentProgram[],
    upsertedPrograms: Program[],
  ) {
    const em = getEm();

    const programsBySource = ld
      .chain(contentPrograms)
      .filter((p) => p.subtype === 'episode' || p.subtype === 'track')
      // TODO figure out a way to shim in a typed groupBy to lodash-es without
      // breaking the whole world
      .groupBy((cp) => cp.externalSourceType!)
      .mapValues((programs) => groupBy(programs, (p) => p.externalSourceName!))
      .value() as ProgramsBySource;

    // This function potentially does a lot of work
    // but we don't want to accidentally not do an upsert of a program.
    // TODO: Probably want to do this step in the background...
    const programGroupingsBySource = await timeAsync(
      () => this.findAndUpdateProgramRelations(programsBySource),
      {
        onSuccess: (ms) => {
          this.logger.debug(
            'findAndUpdateProgramRelations took %d (success)',
            round(ms, 3),
          );
        },
        onFailure: (ms) => {
          this.logger.debug(
            'findAndUpdateProgramRelations took %d (failure)',
            round(ms, 3),
          );
        },
      },
    );

    forEach(upsertedPrograms, (program) => {
      if (
        program.type !== ProgramType.Episode &&
        program.type !== ProgramType.Track
      ) {
        return;
      }

      const groupings = programGroupingsBySource[program.sourceType];
      if (groupings) {
        switch (program.type) {
          case ProgramType.Episode: {
            if (program.grandparentExternalKey) {
              ifDefined(
                this.findMatchingGrouping(
                  groupings,
                  ProgramGroupingType.TvShow,
                  program.externalSourceId,
                  program.grandparentExternalKey,
                ),
                (show) => {
                  program.tvShow = ref(
                    em.getReference(ProgramGrouping, show.uuid),
                  );
                },
              );
            }

            if (program.parentExternalKey) {
              ifDefined(
                this.findMatchingGrouping(
                  groupings,
                  ProgramGroupingType.TvShowSeason,
                  program.externalSourceId,
                  program.parentExternalKey,
                ),
                (season) => {
                  program.season = ref(
                    em.getReference(ProgramGrouping, season.uuid),
                  );
                },
              );
            }

            break;
          }
          case ProgramType.Track: {
            if (program.grandparentExternalKey) {
              ifDefined(
                this.findMatchingGrouping(
                  groupings,
                  ProgramGroupingType.MusicArtist,
                  program.externalSourceId,
                  program.grandparentExternalKey,
                ),
                (artist) => {
                  program.artist = ref(
                    em.getReference(ProgramGrouping, artist.uuid),
                  );
                },
              );
            }

            if (program.parentExternalKey) {
              ifDefined(
                this.findMatchingGrouping(
                  groupings,
                  ProgramGroupingType.MusicAlbum,
                  program.externalSourceId,
                  program.parentExternalKey,
                ),
                (album) => {
                  program.album = ref(
                    em.getReference(ProgramGrouping, album.uuid),
                  );
                },
              );
            }
            break;
          }
          default:
            return;
        }
      }
    });
  }

  findMatchingGrouping(
    mappings: ProgramGroupingsByType,
    groupType: ProgramGroupingType,
    sourceId: string,
    externalKeyToMatch: string,
  ) {
    return find(
      mappings[groupType],
      (grouping) =>
        grouping.externalSourceId === sourceId &&
        grouping.externalKey === externalKeyToMatch,
    );
  }

  // Consider making the UI pass this information in to make it potentially
  // less error-prone. We could also do this asynchronously, but that's kinda
  // mess as well
  async findAndUpdateProgramRelations(programsBySource: ProgramsBySource) {
    // Plex specific for now...
    const ret: Record<
      ProgramSourceType,
      Record<ProgramGroupingType, GroupingIdAndPlexInfo[]>
    > = {
      plex: makeEmptyGroupMap(),
    };

    for (const source of typedKeys(programsBySource)) {
      switch (source) {
        case 'plex':
          {
            const programsByServer = programsBySource[source];
            for (const server of keys(programsByServer)) {
              const result = await this.findAndUpdatePlexServerPrograms(
                server,
                programsByServer[server],
              );
              if (result) {
                ret[ProgramSourceType.PLEX] = mergeGroupings(
                  ret[ProgramSourceType.PLEX],
                  result,
                );
              }
            }
          }
          break;
      }
    }

    return ret;
  }

  async findAndUpdatePlexServerPrograms(
    plexServerName: string,
    programs: ContentProgram[],
  ) {
    if (programs.length === 0) {
      return;
    }

    const logger = LoggerFactory.root;
    const em = getEm().fork();

    const plexServer = await em.findOne(PlexServerSettings, {
      name: plexServerName,
    });

    if (isNil(plexServer)) {
      // Rate limit this potentially noisy log
      logger.warn(
        'Could not find server %s when attempting to update hierarchy',
        plexServerName,
      );
      return;
    }

    const plexApi = PlexApiFactory().get(plexServer);

    const parentIdsByGrandparent = ld
      .chain(programs)
      .map('originalProgram')
      .compact()
      .map((p) =>
        (p.type === 'episode' || p.type === 'track') &&
        isNonEmptyString(p.grandparentRatingKey) &&
        isNonEmptyString(p.parentRatingKey)
          ? ([p.grandparentRatingKey, p.parentRatingKey] as const)
          : null,
      )
      .compact()
      .reduce(
        (prev, [grandparent, parent]) => {
          const last = prev[grandparent];
          if (last) {
            return { ...prev, [grandparent]: last.add(parent) };
          } else {
            return { ...prev, [grandparent]: new Set([parent]) };
          }
        },
        {} as Record<string, Set<string>>,
      )
      .value();

    const grandparentsByParentId = flipMap(parentIdsByGrandparent);

    const allIds = ld
      .chain(programs)
      .map('originalProgram')
      .filter(
        (p): p is PlexEpisode | PlexMusicTrack =>
          isPlexEpisode(p) || isPlexMusicTrack(p),
      )
      .flatMap((p) => [p.grandparentRatingKey, p.parentRatingKey])
      .uniq()
      .value();

    const existingGroupings = flatten(
      await mapAsyncSeq(
        chunk(allIds, 25),
        (idChunk) => {
          const ors = map(
            idChunk,
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

    const existingGroupingsByType = reduce(
      existingGroupings,
      (prev, curr) => {
        const existing = prev[curr.type] ?? [];
        return {
          ...prev,
          [curr.type]: [...existing, curr],
        };
      },
      makeEmptyGroupMap<
        Loaded<ProgramGrouping, 'externalRefs', 'uuid' | 'type'>
      >(),
    );

    const existingGroupingsByPlexIdByType = mapValues(
      existingGroupingsByType,
      (groupings) =>
        groupByUniqFunc(
          groupings,
          (eg) =>
            // This must exist because we just queried on it above
            eg.externalRefs.find(
              (er) =>
                er.sourceType === ProgramExternalIdType.PLEX &&
                er.externalSourceId === plexServerName,
            )!.externalKey,
        ),
    );

    const existingGroupingsByPlexId = reduce(
      values(existingGroupingsByPlexIdByType),
      (prev, curr) => ({ ...prev, ...curr }),
      {} as Record<
        string,
        Loaded<ProgramGrouping, 'externalRefs', 'uuid' | 'type'>
      >,
    );

    // 1. Accumulate different types of groupings
    // 2. Check for dupes
    // 3. Inter-relate them (shows<=>seasons, artist<=>album)
    // 4. Persist them
    // 5. Return mapping of the new or existing IDs to the previous function
    // and update the mappings of the programs...
    const newGroupings = await mapReduceAsyncSeq(
      reject(allIds, (id) => has(existingGroupingsByPlexId, id) || isEmpty(id)),
      async (id) => {
        const metadata = await plexApi.doGet<
          | PlexLibraryShows
          | PlexSeasonView
          | PlexLibraryMusic
          | PlexMusicAlbumView
        >(`/library/metadata/${id}`);
        if (!isNil(metadata) && !isEmpty(metadata.Metadata)) {
          const item = metadata.Metadata[0];

          let grouping: ProgramGrouping;
          const baseFields: Pick<
            ProgramGrouping,
            'title' | 'summary' | 'icon'
          > = {
            title: item.title,
            summary: item.summary,
            icon: item.thumb,
          };
          switch (item.type) {
            // TODO Common function to mint a ProgramGrouping
            case 'show':
              grouping = em.create(ProgramGrouping, {
                ...baseFields,
                type: ProgramGroupingType.TvShow,
              });
              break;
            case 'season':
              grouping = em.create(ProgramGrouping, {
                ...baseFields,
                type: ProgramGroupingType.TvShowSeason,
                index: item.index,
              });
              break;
            case 'artist':
              grouping = em.create(ProgramGrouping, {
                ...baseFields,
                type: ProgramGroupingType.MusicArtist,
                index: item.index,
              });
              break;
            case 'album':
              grouping = em.create(ProgramGrouping, {
                ...baseFields,
                type: ProgramGroupingType.MusicAlbum,
                index: item.index,
              });
              break;
          }

          if (isUndefined(grouping)) {
            return;
          }

          const ref = em.create(ProgramGroupingExternalId, {
            externalKey: item.ratingKey,
            externalSourceId: plexServerName,
            sourceType: ProgramExternalIdType.PLEX,
            group: grouping,
          });

          grouping.externalRefs.add(ref);
          em.persist([grouping, ref]);

          return grouping;
        }
        return;
      },
      (prev, curr) => {
        if (isUndefined(curr)) {
          return prev;
        }

        return {
          ...prev,
          [curr.type]: concat(prev[curr.type], curr),
        };
      },
      makeEmptyGroupMap<ProgramGrouping>(),
      {
        parallelism: 2,
        ms: 50,
      },
    );

    await em.flush();

    // All new groupings will have exactly one externalRef already initialized
    const newGroupingsByPlexIdByType = mapValues(
      newGroupings,
      (groupingsOfType) =>
        mapValues(
          groupByUniqFunc(
            groupingsOfType,
            (grouping) => grouping.externalRefs[0].externalKey,
          ),
          (group) => group.uuid,
        ),
    );

    function associateNewGroupings(
      parentType: ProgramGroupingType,
      childType: ProgramGroupingType,
      relation: 'seasons' | 'albums',
    ) {
      forEach(newGroupings[parentType], (parentGrouping) => {
        // New groupings will have exactly one externalKey right now
        const plexId = parentGrouping.externalRefs[0].externalKey;
        const parentIds = [...(parentIdsByGrandparent[plexId] ?? new Set())];
        const childGroupIds = map(
          parentIds,
          (id) =>
            existingGroupingsByPlexIdByType[childType][id]?.uuid ??
            newGroupingsByPlexIdByType[childType][id],
        );
        parentGrouping[relation].set(
          map(childGroupIds, (id) => em.getReference(ProgramGrouping, id)),
        );
      });
    }

    function associateExistingGroupings(
      parentType: ProgramGroupingType,
      expectedGrandparent: ProgramGroupingType,
      relation: 'show' | 'artist',
    ) {
      forEach(newGroupings[parentType], (grouping) => {
        const grandparentId =
          grandparentsByParentId[grouping.externalRefs[0].externalKey];
        if (isNonEmptyString(grandparentId)) {
          ifDefined(existingGroupingsByPlexId[grandparentId], (gparent) => {
            // Extra check just in case
            if (gparent.type === expectedGrandparent) {
              grouping[relation] = em.getReference(
                ProgramGrouping,
                gparent.uuid,
              );
            }
          });
        }
      });
    }

    // Associate newly seen shows and artists to their
    // season and album counterparts. We should never have a
    // situation where we are seeing a show for the first time without
    // any associated seasons. The opposite is not true though, we update
    // new seasons/albums to their parents below.
    associateNewGroupings(
      ProgramGroupingType.TvShow,
      ProgramGroupingType.TvShowSeason,
      'seasons',
    );
    associateNewGroupings(
      ProgramGroupingType.MusicArtist,
      ProgramGroupingType.MusicAlbum,
      'albums',
    );

    associateExistingGroupings(
      ProgramGroupingType.TvShowSeason,
      ProgramGroupingType.TvShow,
      'show',
    );
    associateExistingGroupings(
      ProgramGroupingType.MusicAlbum,
      ProgramGroupingType.MusicArtist,
      'artist',
    );

    await em.flush();

    const finalMap: Record<ProgramGroupingType, GroupingIdAndPlexInfo[]> =
      makeEmptyGroupMap();

    forEach(existingGroupings, (grouping) => {
      finalMap[grouping.type] = [
        ...finalMap[grouping.type],
        {
          uuid: grouping.uuid,
          externalKey: grouping.externalRefs[0].externalKey,
          externalSourceId: plexServerName,
        },
      ];
    });

    forEach(newGroupings, (groups, type) => {
      finalMap[type] = [
        ...finalMap[type as ProgramGroupingType],
        ...map(groups, (grouping) => ({
          uuid: grouping.uuid,
          externalKey: grouping.externalRefs[0].externalKey,
          externalSourceId: plexServerName,
        })),
      ];
    });

    return finalMap;
  }
}

function makeEmptyGroupMap<V>(): Record<ProgramGroupingType, V[]> {
  return {
    [ProgramGroupingType.MusicAlbum]: [],
    [ProgramGroupingType.MusicArtist]: [],
    [ProgramGroupingType.TvShow]: [],
    [ProgramGroupingType.TvShowSeason]: [],
  };
}

function mergeGroupings<V>(
  l: Record<ProgramGroupingType, V[]>,
  r: Record<ProgramGroupingType, V[]>,
): Record<ProgramGroupingType, V[]> {
  return reduce(
    r,
    (prev, curr, key) => ({
      ...prev,
      [key]: [...prev[key as ProgramGroupingType], ...curr],
    }),
    l,
  );
}
