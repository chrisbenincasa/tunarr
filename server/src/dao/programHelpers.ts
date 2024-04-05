import {
  ChannelProgram,
  ContentProgram,
  CustomProgram,
  isContentProgram,
  isCustomProgram,
} from '@tunarr/types';
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
import {
  chain,
  chunk,
  concat,
  filter,
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
  pickBy,
  reduce,
  reject,
} from 'lodash-es';
import createLogger from '../logger.js';
import { PlexApiFactory } from '../plex.js';
import {
  flipMap,
  groupByUniqFunc,
  ifDefined,
  isNonEmptyString,
  mapAsyncSeq,
  mapAsyncSeq2,
  mapReduceAsyncSeq2,
} from '../util.js';
import { ProgramMinterFactory } from '../util/programMinter.js';
import { ProgramSourceType } from './custom_types/ProgramSourceType.js';
import { getEm } from './dataSource.js';
import { PlexServerSettings } from './entities/PlexServerSettings.js';
import { Program, ProgramType } from './entities/Program.js';
import {
  ProgramGrouping,
  ProgramGroupingType,
} from './entities/ProgramGrouping.js';
import { ProgramGroupingExternalId } from './entities/ProgramGroupingExternalId.js';

const logger = createLogger(import.meta);

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

export async function upsertContentPrograms(
  programs: ChannelProgram[],
  batchSize: number = 10,
) {
  const em = getEm();
  const nonPersisted = filter(programs, (p) => !p.persisted);
  const minter = ProgramMinterFactory.create(em);

  const contentPrograms = chain(nonPersisted)
    .filter(isContentProgram)
    .uniqBy((p) => p.uniqueId)
    .filter(
      (p) =>
        !isNil(p.externalSourceType) &&
        !isNil(p.externalSourceName) &&
        !isNil(p.originalProgram),
    )
    .value();

  // TODO handle custom shows
  const programsToPersist = chain(contentPrograms)
    .map((p) => minter.mint(p.externalSourceName!, p.originalProgram!))
    .compact()
    .value();

  // We verified this is not nil above.

  // TODO: Probably want to do this step in the background...
  //
  const programsBySource = chain(contentPrograms)
    .filter((p) => p.subtype === 'episode' || p.subtype === 'track')
    // TODO figure out a way to shim in a typed groupBy to lodash without
    // breaking the whole world
    .groupBy((cp) => cp.externalSourceType!)
    .mapValues((programs) => groupBy(programs, (p) => p.externalSourceName!))
    .value() as ProgramsBySource;

  const programGroupingsBySource =
    await findAndUpdateProgramRelations(programsBySource);

  logger.debug('Upserting %d programs', programsToPersist.length);

  forEach(programsToPersist, (program) => {
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
              findMatchingGrouping(
                groupings,
                ProgramGroupingType.TvShow,
                program.externalSourceId,
                program.grandparentExternalKey,
              ),
              (show) => {
                program.tvShow = em.getReference(ProgramGrouping, show.uuid);
              },
            );
          }

          if (program.parentExternalKey) {
            ifDefined(
              findMatchingGrouping(
                groupings,
                ProgramGroupingType.TvShowSeason,
                program.externalSourceId,
                program.parentExternalKey,
              ),
              (season) => {
                program.season = em.getReference(ProgramGrouping, season.uuid);
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

  const upsertedPrograms = flatten(
    await mapAsyncSeq(
      chunk(programsToPersist, batchSize),
      undefined,
      (programs) =>
        em.upsertMany(Program, programs, {
          onConflictAction: 'merge',
          onConflictFields: ['sourceType', 'externalSourceId', 'externalKey'],
          onConflictExcludeFields: ['uuid'],
        }),
    ),
  );

  return upsertedPrograms;
}

function findMatchingGrouping(
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
async function findAndUpdateProgramRelations(
  programsBySource: ProgramsBySource,
) {
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
            const result = await findAndUpdatePlexServerPrograms(
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

async function findAndUpdatePlexServerPrograms(
  plexServerName: string,
  programs: ContentProgram[],
) {
  if (programs.length === 0) {
    return;
  }

  const em = getEm();

  const plexServer = await getEm().findOne(PlexServerSettings, {
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

  const plexApi = PlexApiFactory.get(plexServer);

  const parentIdsByGrandparent = chain(programs)
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

  const allIds = chain(programs)
    .map('originalProgram')
    .filter(
      (p): p is PlexEpisode | PlexMusicTrack =>
        isPlexEpisode(p) || isPlexMusicTrack(p),
    )
    .flatMap((p) => [p.grandparentRatingKey, p.parentRatingKey])
    .uniq()
    .value();

  const existingGroupings = flatten(
    await mapAsyncSeq2(
      chunk(allIds, 25),
      (chunk) => {
        const ors = map(chunk, (id) => ({
          sourceType: ProgramSourceType.PLEX,
          externalKey: id,
          externalSourceId: plexServerName,
        }));

        return em.find(
          ProgramGrouping,
          {
            externalRefs: {
              $or: ors,
            },
          },
          {
            populate: ['externalRefs.*'],
            fields: ['uuid', 'type'],
          },
        );
      },
      { parallelism: 2 },
    ),
  );

  const existingGroupingsByPlexId = groupByUniqFunc(
    existingGroupings,
    (eg) =>
      // This must exist because we just queried on it above
      eg.externalRefs.find(
        (er) =>
          er.sourceType === ProgramSourceType.PLEX &&
          er.externalSourceId === plexServerName,
      )!.externalKey,
  );

  // 1. Accumulate different types of groupings
  // 2. Check for dupes
  // 3. Inter-relate them (shows<=>seasons, artist<=>album)
  // 4. Persist them
  // 5. Return mapping of the new or existing IDs to the previous function
  // and update the mappings of the programs...
  const newGroupings = await mapReduceAsyncSeq2(
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
        const baseFields: Pick<ProgramGrouping, 'title' | 'summary' | 'icon'> =
          {
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
              type: ProgramGroupingType.MusicArtist,
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
          sourceType: ProgramSourceType.PLEX,
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

  const existingSeasonsByPlexId = mapValues(
    pickBy(
      existingGroupingsByPlexId,
      (value) => value.type === ProgramGroupingType.TvShowSeason,
    ),
    (group) => group.uuid,
  );
  // All new seasons will have exactly one externalRef already initialized
  const newSeasonsByPlexId = mapValues(
    groupByUniqFunc(
      newGroupings[ProgramGroupingType.TvShowSeason],
      (season) => season.externalRefs[0].externalKey,
    ),
    (group) => group.uuid,
  );

  function associateNewGroupings(
    parentType: ProgramGroupingType,
    relation: 'seasons' | 'albums',
  ) {
    forEach(newGroupings[parentType], (show) => {
      // New groupings will have exactly one externalKey right now
      const plexId = show.externalRefs[0].externalKey;
      const parentIds = [...(parentIdsByGrandparent[plexId] ?? new Set())];
      const seasonGroupIds = map(
        parentIds,
        (id) => existingSeasonsByPlexId[id] ?? newSeasonsByPlexId[id],
      );
      show[relation].set(
        map(seasonGroupIds, (id) => em.getReference(ProgramGrouping, id)),
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
            grouping[relation] = em.getReference(ProgramGrouping, gparent.uuid);
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
  associateNewGroupings(ProgramGroupingType.TvShow, 'seasons');
  associateNewGroupings(ProgramGroupingType.MusicArtist, 'albums');

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

// Takes a listing of programs and makes a mapping of a unique identifier,
// which may differ when a program is persisted or not, to the original
// index in the list. This is useful for when the pending list may lose
// its original ordering during processing, bur requires ordering later
// on in processing
export function createPendingProgramIndexMap(
  programs: (ContentProgram | CustomProgram)[],
) {
  let idx = 0;
  return reduce(
    programs,
    (acc, p) => {
      if (p.persisted || isCustomProgram(p)) {
        acc[p.id!] = idx++;
        // TODO handle other types of programs
      } else if (isContentProgram(p)) {
        acc[contentProgramUniqueId(p)] = idx++;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
}

// Creates a unique ID that matches the output of the entity Program#uniqueId
// function. Useful to matching non-persisted API programs with persisted programs
export function contentProgramUniqueId(p: ContentProgram) {
  // ID should always be defined in the persistent case
  if (p.persisted) {
    return p.id!;
  }

  // These should always be defined for the non-persisted case
  return `${p.externalSourceType}|${p.externalSourceName}|${p.originalProgram?.key}`;
}
