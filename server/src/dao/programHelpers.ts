import { ref } from '@mikro-orm/core';
import {
  ChannelProgram,
  ContentProgram,
  CustomProgram,
  isContentProgram,
  isCustomProgram,
} from '@tunarr/types';
import { PlexEpisode, PlexMedia, PlexMusicTrack } from '@tunarr/types/plex';
import dayjs from 'dayjs';
import ld, {
  filter,
  forEach,
  isNil,
  map,
  partition,
  reduce,
  round,
} from 'lodash-es';
import { performance } from 'perf_hooks';
import { GlobalScheduler } from '../services/scheduler.js';
import { ReconcileProgramDurationsTask } from '../tasks/ReconcileProgramDurationsTask.js';
import { SavePlexProgramExternalIdsTask } from '../tasks/SavePlexProgramExternalIdsTask.js';
import { PlexTaskQueue } from '../tasks/TaskQueue.js';
import { SavePlexProgramGroupingsTask } from '../tasks/plex/SavePlexProgramGroupingsTask.js';
import { ProgramMinterFactory } from '../util/ProgramMinter.js';
import { groupByUniqFunc, isNonEmptyString } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { time, timeNamedAsync } from '../util/perf.js';
import { ProgramExternalIdType } from './custom_types/ProgramExternalIdType.js';
import { getEm } from './dataSource.js';
import { Program, programTypeFromString } from './entities/Program.js';
import { ProgramExternalId } from './entities/ProgramExternalId.js';
import { upsertProgramExternalIds_deprecated } from './programExternalIdHelpers.js';
import { createExternalId } from '@tunarr/shared';

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

  // TODO handle custom shows
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

  const plexRatingExternalIdToMedia = ld
    .chain(programsToPersist)
    .reduce(
      (acc, { apiProgram, externalIds }) => {
        const flattened = filter(externalIds, {
          sourceType: ProgramExternalIdType.PLEX,
          externalSourceId: apiProgram.externalSourceName!,
        });

        return {
          ...acc,
          ...reduce(
            flattened,
            (acc2, eid) => ({
              ...acc2,
              [eid.toExternalIdString()]: apiProgram.originalProgram!,
            }),
            {} as Record<string, PlexMedia>,
          ),
        };
      },
      {} as Record<string, PlexMedia>,
    )
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

  // We're dealing specifically with Plex items right now. We want to treat
  // _at least_ the rating key / GUID as invariants in the program_external_id
  // table for each program.
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

  const externalIdsByGrandparentId = ld
    .chain(programExternalIds)
    .map((externalId) => {
      const plexMedia =
        plexRatingExternalIdToMedia[externalId.toExternalIdString()];

      if (
        plexMedia &&
        (plexMedia.type === 'track' || plexMedia.type === 'episode')
      ) {
        return {
          externalId,
          plexMedia,
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

  setImmediate(() => {
    forEach(externalIdsByGrandparentId, (externalIds, grandparentId) => {
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
          parentKeys: parentIds,
          programAndPlexIds,
          programType: programTypeFromString(externalIds[0].plexMedia.type)!,
          plexServerName: externalIds[0].externalId.externalSourceId!,
        }),
      ).catch((e) => console.error(e));
    });
  });

  const [requiredExternalIds, backgroundExternalIds] = partition(
    programExternalIds,
    (p) =>
      p.sourceType === ProgramExternalIdType.PLEX ||
      p.sourceType === ProgramExternalIdType.PLEX_GUID,
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

  PlexTaskQueue.pause();
  const [, pQueueTime] = time(() => {
    forEach(upsertedPrograms, (program) => {
      try {
        const task = new SavePlexProgramExternalIdsTask(program.uuid);
        task.logLevel = 'trace';
        PlexTaskQueue.add(task).catch((e) => {
          logger.error(e, 'Error saving external IDs for program %s', program);
        });
      } catch (e) {
        logger.error(
          e,
          'Failed to schedule external IDs task for persisted program: %O',
          program,
        );
      }
    });
  });

  logger.debug('Took %d ms to schedule tasks', pQueueTime);

  setImmediate(() => {
    GlobalScheduler.scheduleOneOffTask(
      ReconcileProgramDurationsTask.name,
      dayjs().add(500, 'ms'),
      new ReconcileProgramDurationsTask(),
    );
    PlexTaskQueue.resume();
  });

  const end = performance.now();
  logger.debug(
    'upsertContentPrograms to %d millis. %d upsertedPrograms',
    round(end - start, 3),
    upsertedPrograms.length,
  );

  return upsertedPrograms;
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
