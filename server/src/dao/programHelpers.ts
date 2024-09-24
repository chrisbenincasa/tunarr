import { ref } from '@mikro-orm/core';
import { createExternalId } from '@tunarr/shared';
import { seq } from '@tunarr/shared/util';
import {
  ChannelProgram,
  ContentProgram,
  CustomProgram,
  isContentProgram,
  isCustomProgram,
} from '@tunarr/types';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import { PlexEpisode, PlexMusicTrack } from '@tunarr/types/plex';
import { ContentProgramOriginalProgram } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import ld, {
  compact,
  filter,
  find,
  forEach,
  isNil,
  isUndefined,
  map,
  partition,
  reduce,
  round,
} from 'lodash-es';
import { performance } from 'perf_hooks';
import { GlobalScheduler } from '../services/scheduler.js';
import { ReconcileProgramDurationsTask } from '../tasks/ReconcileProgramDurationsTask.js';
import { JellyfinTaskQueue, PlexTaskQueue } from '../tasks/TaskQueue.js';
import { SaveJellyfinProgramExternalIdsTask } from '../tasks/jellyfin/SaveJellyfinProgramExternalIdsTask.js';
import { SaveJellyfinProgramGroupingsTask } from '../tasks/jellyfin/SaveJellyfinProgramGroupingsTask.js';
import { SavePlexProgramExternalIdsTask } from '../tasks/plex/SavePlexProgramExternalIdsTask.js';
import { SavePlexProgramGroupingsTask } from '../tasks/plex/SavePlexProgramGroupingsTask.js';
import { ProgramMinterFactory } from '../util/ProgramMinter.js';
import { groupByUniqFunc, isNonEmptyString } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { time, timeNamedAsync } from '../util/perf.js';
import { ProgramExternalIdType } from './custom_types/ProgramExternalIdType.js';
import { ProgramSourceType } from './custom_types/ProgramSourceType.js';
import { getEm } from './dataSource.js';
import {
  Program,
  programTypeFromJellyfinType,
  programTypeFromString,
} from './entities/Program.js';
import { ProgramExternalId } from './entities/ProgramExternalId.js';
import { upsertProgramExternalIds_deprecated } from './programExternalIdHelpers.js';

export async function upsertContentPrograms(
  programs: ChannelProgram[],
  batchSize: number = 10,
) {
  const start = performance.now();
  // TODO: Wrap all of this stuff in a class and use its own logger
  const logger = LoggerFactory.root;
  const em = getEm();
  const [, nonPersisted] = partition(programs, (p) => p.persisted);
  const minter = ProgramMinterFactory.createPlexMinter(em);

  const contentPrograms = ld
    .chain(nonPersisted)
    .filter(isContentProgram)
    .uniqBy((p) => p.uniqueId)
    .filter(
      (p) =>
        !isNil(p.externalSourceType) &&
        !isNil(p.externalSourceName) &&
        !isNil(p.originalProgram),
    )
    .value();

  // This code dedupes incoming programs using their external (IMDB, TMDB, etc) IDs.
  // Eventually, it could be used to save source-agnostic programs, but it's unclear
  // if that gives us benefit yet.
  // const pMap = reduce(
  //   contentPrograms,
  //   (acc, program) => {
  //     const externalIds: {
  //       type: ProgramExternalIdType;
  //       id: string;
  //       program: ContentProgram;
  //     }[] = [];
  //     switch (program.originalProgram!.sourceType) {
  //       case 'plex': {
  //         const x = ld
  //           .chain(program.originalProgram!.program.Guid ?? [])
  //           .map((guid) => parsePlexExternalGuid(guid.id))
  //           .thru(removeErrors)
  //           .map((eid) => ({
  //             type: eid.sourceType,
  //             id: eid.externalKey,
  //             program,
  //           }))
  //           .value();
  //         externalIds.push(...x);
  //         break;
  //       }
  //       case 'jellyfin': {
  //         const p = compact(
  //           map(program.originalProgram!.program.ProviderIds, (value, key) => {
  //             const typ = programExternalIdTypeFromString(key.toLowerCase());
  //             return isNil(value) || isUndefined(typ)
  //               ? null
  //               : { type: typ, id: value, program };
  //           }),
  //         );
  //         externalIds.push(...p);
  //         break;
  //       }
  //     }

  //     forEach(externalIds, ({ type, id, program }) => {
  //       if (!isValidSingleExternalIdType(type)) {
  //         return;
  //       }

  //       const key = createGlobalExternalIdString(type, id);
  //       const last = acc[key];
  //       if (last) {
  //         acc[key] = { type, id, programs: [...last.programs, program] };
  //       } else {
  //         acc[key] = { type, id, programs: [program] };
  //       }
  //     });

  //     return acc;
  //   },
  //   {} as Record<
  //     `${string}|${string}`,
  //     {
  //       type: ProgramExternalIdType;
  //       id: string;
  //       programs: ContentProgram[];
  //     }
  //   >,
  // );

  // const existingPrograms = flatten(
  //   await mapAsyncSeq(chunk(values(pMap), 500), (items) => {
  //     return directDbAccess()
  //       .selectFrom('programExternalId')
  //       .where(({ or, eb }) => {
  //         const clauses = map(items, (item) =>
  //           eb('programExternalId.sourceType', '=', item.type).and(
  //             'programExternalId.externalKey',
  //             '=',
  //             item.id,
  //           ),
  //         );
  //         return or(clauses);
  //       })
  //       .selectAll('programExternalId')
  //       .select((eb) =>
  //         jsonArrayFrom(
  //           eb
  //             .selectFrom('program')
  //             .whereRef('programExternalId.programUuid', '=', 'program.uuid')
  //             .select(AllProgramFields),
  //         ).as('program'),
  //       )
  //       .groupBy('programExternalId.programUuid')
  //       .execute();
  //   }),
  // );
  // console.log('results!!!!', existingPrograms);

  // TODO: handle custom shows
  const programsToPersist = ld
    .chain(contentPrograms)
    .map((p) => {
      const program = minter.mint(p.externalSourceName!, p.originalProgram!);
      const externalIds = minter.mintExternalIds(
        p.externalSourceName!,
        program,
        p.originalProgram!,
      );
      return { program, externalIds, apiProgram: p };
    })
    .value();

  const programInfoByUniqueId = groupByUniqFunc(
    programsToPersist,
    ({ program }) => program.uniqueId(),
  );

  logger.debug('Upserting %d programs', programsToPersist.length);

  // NOTE: upsert will not handle any relations. That's why we need to do
  // these manually below. Relations all have IDs generated application side
  // so we can't get proper diffing on 1:M Program:X, etc.
  // TODO: The way we deal with uniqueness right now makes a Program entity
  // exist 1:1 with its "external" entity, i.e. the same logical movie will
  // have duplicate entries in the DB across different servers and sources.
  // This isn't ideal.
  const upsertedPrograms = await timeNamedAsync(
    'upsertProgramsDB',
    logger,
    () =>
      em.transactional((em) =>
        em.upsertMany(Program, map(programsToPersist, 'program'), {
          onConflictAction: 'merge',
          onConflictFields: ['sourceType', 'externalSourceId', 'externalKey'],
          onConflictExcludeFields: ['uuid'],
          batchSize,
        }),
      ),
  );

  const programExternalIds = ld
    .chain(upsertedPrograms)
    .flatMap((program) => {
      const eids = programInfoByUniqueId[program.uniqueId()]?.externalIds ?? [];
      forEach(eids, (eid) => {
        eid.program = ref(program);
      });
      return eids;
    })
    .value();

  const sourceExternalIdToOriginalProgram: Record<
    string,
    ContentProgramOriginalProgram
  > = ld
    .chain(programsToPersist)
    .reduce((acc, { apiProgram, externalIds }) => {
      if (isUndefined(apiProgram.originalProgram)) {
        return acc;
      }

      const itemId = find(
        externalIds,
        (eid) =>
          eid.sourceType === apiProgram.originalProgram!.sourceType &&
          eid.externalSourceId === apiProgram.externalSourceName!,
      );

      if (!itemId) {
        return acc;
      }

      return {
        ...acc,
        [itemId.toExternalIdString()]: apiProgram.originalProgram,
      };
    }, {})
    .value();

  schedulePlexProgramGroupingTasks(
    programExternalIds,
    sourceExternalIdToOriginalProgram,
  );

  scheduleJellyfinProgramGroupingTasks(
    programExternalIds,
    sourceExternalIdToOriginalProgram,
  );

  const [requiredExternalIds, backgroundExternalIds] = partition(
    programExternalIds,
    (p) =>
      p.sourceType === ProgramExternalIdType.PLEX ||
      p.sourceType === ProgramExternalIdType.PLEX_GUID ||
      p.sourceType === ProgramExternalIdType.JELLYFIN,
  );

  // Fail hard on not saving Plex external IDs. We need them for streaming
  // TODO: We could optimize further here by only saving IDs necessary for streaming
  await timeNamedAsync('upsert external ids', logger, () =>
    upsertProgramExternalIds_deprecated(requiredExternalIds),
  );

  setImmediate(() => {
    upsertProgramExternalIds_deprecated(backgroundExternalIds).catch((e) => {
      logger.error(
        e,
        'Error saving non-essential external IDs. A fixer will run for these',
      );
    });
  });

  await em.flush();

  schedulePlexExternalIdsTask(upsertedPrograms);
  scheduleJellyfinExternalIdsTask(upsertedPrograms);

  setImmediate(() => {
    GlobalScheduler.scheduleOneOffTask(
      ReconcileProgramDurationsTask.name,
      dayjs().add(500, 'ms'),
      new ReconcileProgramDurationsTask(),
    );
    PlexTaskQueue.resume();
    JellyfinTaskQueue.resume();
  });

  const end = performance.now();
  logger.debug(
    'upsertContentPrograms to %d millis. %d upsertedPrograms',
    round(end - start, 3),
    upsertedPrograms.length,
  );

  return upsertedPrograms;
}

function schedulePlexProgramGroupingTasks(
  programExternalIds: ProgramExternalId[],
  sourceExternalIdToOriginalProgram: Record<
    string,
    ContentProgramOriginalProgram
  >,
) {
  const plexExternalIdsByGrandparentId = ld
    .chain(programExternalIds)
    .map((externalId) => {
      const media =
        sourceExternalIdToOriginalProgram[externalId.toExternalIdString()];

      if (
        media &&
        media.sourceType === 'plex' &&
        (media.program.type === 'track' || media.program.type === 'episode')
      ) {
        return {
          externalId,
          plexMedia: media.program,
        };
      }

      return;
    })
    .compact()
    .reduce(
      (acc, { plexMedia, externalId }) => {
        const grandparentKey = plexMedia.grandparentRatingKey;
        if (isNonEmptyString(grandparentKey)) {
          const existing = acc[grandparentKey] ?? [];
          return {
            ...acc,
            [grandparentKey]: [...existing, { externalId, plexMedia }],
          };
        }
        return acc;
      },
      {} as Record<
        string,
        {
          externalId: ProgramExternalId;
          plexMedia: PlexEpisode | PlexMusicTrack;
        }[]
      >,
    )
    .value();

  // TODO Need to implement this for Jellyfin
  setImmediate(() => {
    forEach(plexExternalIdsByGrandparentId, (externalIds, grandparentId) => {
      const parentIds = map(
        externalIds,
        (eid) => eid.plexMedia.parentRatingKey,
      );
      const programAndPlexIds = map(externalIds, (eid) => ({
        plexId: eid.plexMedia.ratingKey,
        programId: eid.externalId.program.uuid,
        parentKey: eid.plexMedia.parentRatingKey,
      }));

      PlexTaskQueue.add(
        new SavePlexProgramGroupingsTask({
          grandparentKey: grandparentId,
          parentKeys: compact(parentIds),
          programAndPlexIds,
          programType: programTypeFromString(externalIds[0].plexMedia.type)!,
          plexServerName: externalIds[0].externalId.externalSourceId!,
        }),
      ).catch((e) => console.error(e));
    });
  });
}

function scheduleJellyfinProgramGroupingTasks(
  programExternalIds: ProgramExternalId[],
  sourceExternalIdToOriginalProgram: Record<
    string,
    ContentProgramOriginalProgram
  >,
) {
  const externalIdsByGrandparentId = ld
    .chain(programExternalIds)
    .map((externalId) => {
      const media =
        sourceExternalIdToOriginalProgram[externalId.toExternalIdString()];

      if (
        media &&
        media.sourceType === 'jellyfin' &&
        (media.program.Type === 'Audio' || media.program.Type === 'Episode')
      ) {
        return {
          externalId,
          item: media.program,
        };
      }

      return;
    })
    .compact()
    .reduce(
      (acc, { item, externalId }) => {
        const grandparentKey = item.SeriesId ?? item.AlbumArtist;
        if (isNonEmptyString(grandparentKey)) {
          const existing = acc[grandparentKey] ?? [];
          return {
            ...acc,
            [grandparentKey]: [...existing, { externalId, item }],
          };
        }
        return acc;
      },
      {} as Record<
        string,
        {
          externalId: ProgramExternalId;
          item: JellyfinItem;
        }[]
      >,
    )
    .value();

  setImmediate(() => {
    forEach(externalIdsByGrandparentId, (externalIds, grandparentId) => {
      const parentIds = compact(
        map(externalIds, ({ item }) =>
          item.Type === 'Audio'
            ? item.AlbumId
            : item.Type === 'Episode'
            ? item.SeasonId
            : null,
        ),
      );

      const programAndParentIds = seq.collect(externalIds, (eid) => {
        const parentKey = eid.item.AlbumId ?? eid.item.SeasonId;
        if (!isNonEmptyString(parentKey)) {
          return;
        }

        return {
          jellyfinItemId: eid.item.Id,
          programId: eid.externalId.program.uuid,
          parentKey,
        };
      });

      JellyfinTaskQueue.add(
        new SaveJellyfinProgramGroupingsTask({
          grandparentKey: grandparentId,
          parentKeys: compact(parentIds),
          programAndJellyfinIds: programAndParentIds,
          programType: programTypeFromJellyfinType(externalIds[0].item.Type)!,
          jellyfinServerName: externalIds[0].externalId.externalSourceId!,
        }),
      ).catch((e) => console.error(e));
    });
  });
}

function schedulePlexExternalIdsTask(upsertedPrograms: Program[]) {
  const logger = LoggerFactory.root;

  PlexTaskQueue.pause();
  const [, pQueueTime] = time(() => {
    forEach(
      filter(upsertedPrograms, (p) => p.sourceType === ProgramSourceType.PLEX),
      (program) => {
        try {
          const task = new SavePlexProgramExternalIdsTask(program.uuid);
          task.logLevel = 'trace';
          PlexTaskQueue.add(task).catch((e) => {
            logger.error(
              e,
              'Error saving external IDs for program %s',
              program,
            );
          });
        } catch (e) {
          logger.error(
            e,
            'Failed to schedule external IDs task for persisted program: %O',
            program,
          );
        }
      },
    );
  });

  logger.debug('Took %d ms to schedule tasks', pQueueTime);
}

function scheduleJellyfinExternalIdsTask(upsertedPrograms: Program[]) {
  const logger = LoggerFactory.root;

  JellyfinTaskQueue.pause();
  const [, pQueueTime] = time(() => {
    forEach(
      filter(
        upsertedPrograms,
        (p) => p.sourceType === ProgramSourceType.JELLYFIN,
      ),
      (program) => {
        try {
          const task = new SaveJellyfinProgramExternalIdsTask(program.uuid);
          task.logLevel = 'trace';
          JellyfinTaskQueue.add(task).catch((e) => {
            logger.error(
              e,
              'Error saving external IDs for program %s',
              program,
            );
          });
        } catch (e) {
          logger.error(
            e,
            'Failed to schedule external IDs task for persisted program: %O',
            program,
          );
        }
      },
    );
  });

  logger.debug('Took %d ms to schedule tasks', pQueueTime);
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
      if ((p.persisted || isCustomProgram(p)) && isNonEmptyString(p.id)) {
        acc[p.id] = idx++;
        // TODO handle other types of programs
      } else if (
        isContentProgram(p) &&
        isNonEmptyString(p.externalSourceName) &&
        isNonEmptyString(p.externalSourceType) &&
        isNonEmptyString(p.externalKey)
      ) {
        acc[
          createExternalId(
            p.externalSourceType,
            p.externalSourceName,
            p.externalKey,
          )
        ] = idx++;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
}
