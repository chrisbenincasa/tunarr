import { PopulateHint } from '@mikro-orm/core';
import {
  ChannelProgram,
  ContentProgram,
  CustomProgram,
  isContentProgram,
  isCustomProgram,
} from '@tunarr/types';
import {
  PlexLibraryMusic,
  PlexLibraryShows,
  PlexMusicAlbumView,
  PlexSeasonView,
} from '@tunarr/types/plex';
import {
  chain,
  chunk,
  concat,
  filter,
  find,
  flatten,
  groupBy,
  isEmpty,
  isNil,
  isUndefined,
  keys,
  map,
  reduce,
} from 'lodash-es';
import createLogger from '../logger.js';
import { PlexApiFactory } from '../plex.js';
import { mapAsyncSeq, mapAsyncSeq2, mapReduceAsyncSeq2 } from '../util.js';
import { ProgramMinterFactory } from '../util/programMinter.js';
import { ProgramSourceType } from './custom_types/ProgramSourceType.js';
import { getEm } from './dataSource.js';
import { PlexServerSettings } from './entities/PlexServerSettings.js';
import { Program } from './entities/Program.js';
import {
  ProgramGrouping,
  ProgramGroupingType,
} from './entities/ProgramGrouping.js';

const logger = createLogger(import.meta);

type ProgramsBySource = Record<
  NonNullable<ContentProgram['externalSourceType']>,
  Record<string, ContentProgram[]>
>;

function typedKeys<
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
  const programsBySource: ProgramsBySource = chain(contentPrograms)
    .filter((p) => p.subtype === 'episode' || p.subtype === 'track')
    .groupBy((cp) => cp.externalSourceType!)
    .mapValues((programs) => groupBy(programs, (p) => p.externalSourceName!));

  logger.debug('Upserting %d programs', programsToPersist.length);

  return flatten(
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
}

// Consider making the UI pass this information in to make it potentially
// less error-prone. We could also do this asynchronously, but that's kinda
// mess as well
async function findAndUpdateProgramRelations(
  programsBySource: ProgramsBySource,
) {
  for (const source of typedKeys(programsBySource)) {
    switch (source) {
      case 'plex':
        const programsByServer = programsBySource[source];
    }
  }
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

  // Shows
  const grandparentParentPairs = chain(programs)
    .map((p) => p.originalProgram!)
    .map((op) =>
      op.type === 'episode' || op.type === 'track'
        ? ([op.grandparentRatingKey, op.parentKey] as const)
        : null,
    )
    .compact()
    .value();

  const parentIdsByGrandparent = reduce(
    grandparentParentPairs,
    (prev, [grandparent, parent]) => {
      const last = prev[grandparent];
      if (last) {
        return { ...prev, [grandparent]: last.add(parent) };
      } else {
        return { ...prev, [grandparent]: new Set(parent) };
      }
    },
    {} as Record<string, Set<string>>,
  );

  const allIds = chain(parentIdsByGrandparent)
    .map((value, key) => {
      return [...value, key];
    })
    .flattenDeep()
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
            populateWhere: PopulateHint.INFER,
            fields: ['uuid', 'externalRefs.externalKey'],
          },
        );
      },
      { parallelism: 2 },
    ),
  );

  chain(existingGroupings).map(eg => find(
    eg.externalRefs,
    { sourceType: ProgramSourceType.PLEX, externalSourceId: plexServerName }
  ))
  const existingGroupingsByPlexId = keys(groupBy(existingGroupings, (eg) =>
    find(
      eg.externalRefs,
      { sourceType: ProgramSourceType.PLEX, externalSourceId: plexServerName }!
        .externalSourceId,
    ),
  ));

  // TODO:
  // 1. Accumulate different types of groupings
  // 2. Check for dupes
  // 3. Inter-relate them (shows<=>seasons, artist<=>album)
  // 4. Persist them
  // 5. Return mapping of the new or existing IDs to the previous function
  // and update the mappings of the programs...
  const empty: Record<ProgramGroupingType, ProgramGrouping[]> = {
    [ProgramGroupingType.MusicAlbum]: [],
    [ProgramGroupingType.MusicArtist]: [],
    [ProgramGroupingType.TvShow]: [],
    [ProgramGroupingType.TvShowSeason]: [],
  };

  return mapReduceAsyncSeq2(
    reject(allIds, ,
    async (id) => {
      const metadata = await plexApi.doGet<
        | PlexLibraryShows
        | PlexSeasonView
        | PlexLibraryMusic
        | PlexMusicAlbumView
      >(`/library/metadata/${id}`);
      if (!isNil(metadata) && !isEmpty(metadata.Metadata)) {
        const item = metadata.Metadata[0];
        switch (item.type) {
          case 'show':
            return em.create(ProgramGrouping, {});
          case 'season':
            return em.create(ProgramGrouping, {});
          case 'artist':
            return em.create(ProgramGrouping, {});
          case 'album':
            return em.create(ProgramGrouping, {});
        }
        // Common function to mint a ProgramGrouping
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
    empty,
    {
      parallelism: 2,
      ms: 50,
    },
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
