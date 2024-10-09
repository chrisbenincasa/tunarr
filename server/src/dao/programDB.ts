import { Loaded } from '@mikro-orm/better-sqlite';
import { seq } from '@tunarr/shared/util';
import {
  ChannelProgram,
  ContentProgram,
  isContentProgram,
} from '@tunarr/types';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import { PlexEpisode, PlexMusicTrack } from '@tunarr/types/plex';
import { ContentProgramOriginalProgram } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { CaseWhenBuilder } from 'kysely';
import ld, {
  chunk,
  concat,
  difference,
  filter,
  find,
  flatten,
  forEach,
  groupBy,
  isEmpty,
  isNil,
  isNull,
  keys,
  map,
  mapValues,
  partition,
  reduce,
  reject,
  round,
  union,
  uniq,
} from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
import { P, match } from 'ts-pattern';
import { GlobalScheduler } from '../services/scheduler.js';
import { ReconcileProgramDurationsTask } from '../tasks/ReconcileProgramDurationsTask.js';
import { AnonymousTask } from '../tasks/Task.js';
import { JellyfinTaskQueue, PlexTaskQueue } from '../tasks/TaskQueue.js';
import { SaveJellyfinProgramExternalIdsTask } from '../tasks/jellyfin/SaveJellyfinProgramExternalIdsTask.js';
import { SavePlexProgramExternalIdsTask } from '../tasks/plex/SavePlexProgramExternalIdsTask.js';
import { asyncPool, unfurlPool } from '../util/asyncPool.js';
import { devAssert } from '../util/debug.js';
import {
  groupByAndMapAsync,
  groupByUniq,
  groupByUniqProp,
  isNonEmptyString,
  mapReduceAsyncSeq,
  mapToObj,
} from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { Timer } from '../util/perf.js';
import { ProgramGroupingMinter } from './converters/ProgramGroupingMinter.js';
import { ProgramMinterFactory } from './converters/ProgramMinter.js';
import { ProgramConverter } from './converters/programConverters.js';
import {
  ProgramExternalIdType,
  programExternalIdTypeFromString,
} from './custom_types/ProgramExternalIdType.js';
import {
  ProgramSourceType,
  programSourceTypeFromString,
} from './custom_types/ProgramSourceType.js';
import { getEm } from './dataSource';
import { directDbAccess } from './direct/directDbAccess.js';
import { ProgramUpsertFields } from './direct/programQueryHelpers.js';
import {
  NewProgram as NewRawProgram,
  Program as RawProgram,
  programExternalIdString,
} from './direct/schema/Program.js';
import { NewProgramExternalId as NewRawProgramExternalId } from './direct/schema/ProgramExternalId.js';
import { NewProgramGrouping } from './direct/schema/ProgramGrouping.js';
import { NewProgramGroupingExternalId } from './direct/schema/ProgramGroupingExternalId.js';
import { DB } from './direct/schema/db.js';
import { Program, ProgramType } from './entities/Program';
import { ProgramExternalId } from './entities/ProgramExternalId.js';
import { ProgramGroupingType } from './entities/ProgramGrouping.js';
import { upsertRawProgramExternalIds } from './programExternalIdHelpers.js';

type ValidatedContentProgram = MarkRequired<
  ContentProgram,
  'originalProgram' | 'externalSourceName' | 'externalSourceType'
>;

type MintedRawProgramInfo = {
  program: NewRawProgram;
  externalIds: NewRawProgramExternalId[];
  apiProgram: ValidatedContentProgram;
};

type NonMovieOriginalProgram =
  | { sourceType: 'plex'; program: PlexEpisode | PlexMusicTrack }
  | { sourceType: 'jellyfin'; program: JellyfinItem };

type ProgramRelationCaseBuilder = CaseWhenBuilder<
  DB,
  'program',
  unknown,
  string | null
>;

export class ProgramDB {
  private logger = LoggerFactory.child({ className: this.constructor.name });
  private timer = new Timer(this.logger);

  async getProgramById(id: string) {
    return getEm().findOne(Program, id, { populate: ['externalIds'] });
  }

  async getShowIdFromTitle(title: string) {
    const matchedGrouping = await directDbAccess()
      .selectFrom('programGrouping')
      .select('uuid')
      .where('title', '=', title)
      .where('type', '=', ProgramGroupingType.TvShow)
      .executeTakeFirst();

    return matchedGrouping?.uuid;
  }

  async getProgramsByIds(ids: string[], batchSize: number = 50) {
    const em = getEm();
    return mapReduceAsyncSeq(
      chunk(uniq(ids), batchSize),
      (ids) =>
        em.find(Program, { uuid: { $in: ids } }, { populate: ['externalIds'] }),
      (acc, curr) => [...acc, ...curr],
      [] as Loaded<Program, 'externalIds', '*', never>[],
    );
  }

  async lookupByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize: number = 25,
  ) {
    const em = getEm();
    const converter = new ProgramConverter();

    const tasks = asyncPool(
      chunk([...ids], chunkSize),
      async (idChunk) => {
        return await em.find(ProgramExternalId, {
          $or: map(idChunk, ([ps, es, ek]) => ({
            sourceType: programExternalIdTypeFromString(ps)!,
            externalSourceId: es,
            externalKey: ek,
          })),
        });
      },
      { concurrency: 2 },
    );

    const externalIdsdByProgram = groupBy(
      flatten(await unfurlPool(tasks)),
      (x) => x.program.uuid,
    );

    const programs = await mapReduceAsyncSeq(
      chunk(keys(externalIdsdByProgram), 50),
      async (programIdChunk) => await em.find(Program, programIdChunk),
      (acc, curr) => ({ ...acc, ...groupByUniqProp(curr, 'uuid') }),
      {} as Record<string, Loaded<Program>>,
    );

    return groupByAndMapAsync(
      // Silently drop programs we can't find.
      union(keys(externalIdsdByProgram), keys(programs)),
      (programId) => programId,
      (programId) => {
        const eids = externalIdsdByProgram[programId];
        return converter.entityToContentProgram(programs[programId], eids, {
          skipPopulate: { externalIds: false },
        });
      },
    );
  }

  async programIdsByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize: number = 50,
  ) {
    const em = getEm();
    const tasks = asyncPool(
      chunk([...ids], chunkSize),
      async (idChunk) => {
        return await em.find(ProgramExternalId, {
          $or: map(idChunk, ([ps, es, ek]) => ({
            sourceType: programExternalIdTypeFromString(ps)!,
            externalSourceId: es,
            externalKey: ek,
          })),
        });
      },
      { concurrency: 2 },
    );

    return mapValues(
      groupByUniq(flatten(await unfurlPool(tasks)), (eid) =>
        eid.toExternalIdString(),
      ),
      (eid) => eid.program.uuid,
    );
  }

  async getProgramExternalIds(programId: string) {
    const em = getEm();
    return await em.find(ProgramExternalId, {
      program: programId,
    });
  }

  async updateProgramPlexRatingKey(
    programId: string,
    plexServerName: string,
    details: Pick<
      ProgramExternalId,
      'externalKey' | 'directFilePath' | 'externalFilePath'
    >,
  ) {
    const em = getEm();
    const existingRatingKey = await em.findOne(ProgramExternalId, {
      program: programId,
      externalSourceId: plexServerName,
      sourceType: ProgramExternalIdType.PLEX,
    });

    if (isNil(existingRatingKey)) {
      const newEid = em.create(ProgramExternalId, {
        program: em.getReference(Program, programId),
        sourceType: ProgramExternalIdType.PLEX,
        externalSourceId: plexServerName,
        ...details,
      });
      em.persist(newEid);
    } else {
      existingRatingKey.externalKey = details.externalKey;
      if (isNonEmptyString(details.externalFilePath)) {
        existingRatingKey.externalFilePath = details.externalFilePath;
      }
      if (isNonEmptyString(details.directFilePath)) {
        existingRatingKey.directFilePath = details.directFilePath;
      }
    }
    await em.flush();
  }

  async upsertContentPrograms(
    programs: ChannelProgram[],
    programUpsertBatchSize: number = 100,
  ) {
    const start = performance.now();
    // TODO: Wrap all of this stuff in a class and use its own logger
    const em = getEm();
    const [, nonPersisted] = partition(programs, (p) => p.persisted);
    const minter = ProgramMinterFactory.create(em);

    const contentPrograms = ld
      .chain(nonPersisted)
      .filter(isContentProgram)
      .uniqBy((p) => p.uniqueId)
      .filter(
        (p): p is ValidatedContentProgram =>
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
    const programsToPersist: MintedRawProgramInfo[] = ld
      .chain(contentPrograms)
      .map((p) => {
        const program = minter.mintRaw(p.externalSourceName, p.originalProgram);
        const externalIds = minter.mintRawExternalIds(
          p.externalSourceName,
          program.uuid,
          p.originalProgram,
        );
        return { program, externalIds, apiProgram: p };
      })
      .value();

    const programInfoByUniqueId = groupByUniq(
      programsToPersist,
      ({ program }) => programExternalIdString(program),
    );

    this.logger.debug('Upserting %d programs', programsToPersist.length);

    // NOTE: upsert will not handle any relations. That's why we need to do
    // these manually below. Relations all have IDs generated application side
    // so we can't get proper diffing on 1:M Program:X, etc.
    // TODO: The way we deal with uniqueness right now makes a Program entity
    // exist 1:1 with its "external" entity, i.e. the same logical movie will
    // have duplicate entries in the DB across different servers and sources.
    const upsertedPrograms: RawProgram[] = [];
    await this.timer.timeAsync('programUpsert', async () => {
      for (const c of chunk(programsToPersist, programUpsertBatchSize)) {
        upsertedPrograms.push(
          ...(await directDbAccess()
            .transaction()
            .execute((tx) =>
              tx
                .insertInto('program')
                .values(map(c, 'program'))
                .onConflict((oc) =>
                  oc
                    .columns(['sourceType', 'externalSourceId', 'externalKey'])
                    .doUpdateSet((eb) =>
                      mapToObj(ProgramUpsertFields, (f) => ({
                        [f.replace('excluded.', '')]: eb.ref(f),
                      })),
                    ),
                )
                .returningAll()
                .execute(),
            )),
        );
      }
    });

    const programExternalIds = ld
      .chain(upsertedPrograms)
      .flatMap((program) => {
        const eids =
          programInfoByUniqueId[programExternalIdString(program)]
            ?.externalIds ?? [];
        forEach(eids, (eid) => {
          eid.programUuid = program.uuid;
        });
        return eids;
      })
      .value();

    await this.timer.timeAsync('programGroupings', () =>
      this.handleProgramGroupings(upsertedPrograms, programInfoByUniqueId),
    );

    const [requiredExternalIds, backgroundExternalIds] = partition(
      programExternalIds,
      (p) =>
        p.sourceType === ProgramExternalIdType.PLEX ||
        // p.sourceType === ProgramExternalIdType.PLEX_GUID ||
        p.sourceType === ProgramExternalIdType.JELLYFIN,
    );

    // Fail hard on not saving Plex / Jellyfin program external IDs. We need them for streaming
    // TODO: We could optimize further here by only saving IDs necessary for streaming
    await this.timer.timeAsync(
      `upsert ${requiredExternalIds.length} external ids`,
      () => upsertRawProgramExternalIds(requiredExternalIds, 200),
      // upsertProgramExternalIds_deprecated(requiredExternalIds),
    );

    this.schedulePlexExternalIdsTask(upsertedPrograms);
    this.scheduleJellyfinExternalIdsTask(upsertedPrograms);

    setImmediate(() => {
      this.logger.debug('Scheduling follow-up program tasks...');

      GlobalScheduler.scheduleOneOffTask(
        ReconcileProgramDurationsTask.name,
        dayjs().add(500, 'ms'),
        new ReconcileProgramDurationsTask(),
      );

      PlexTaskQueue.resume();
      JellyfinTaskQueue.resume();

      this.logger.debug('Upserting external IDs in background');

      GlobalScheduler.scheduleOneOffTask(
        'UpsertExternalIds',
        dayjs().add(100),
        AnonymousTask('UpsertExternalIds', () =>
          this.timer.timeAsync(
            `background external ID upsert (${backgroundExternalIds.length} ids)`,
            () => upsertRawProgramExternalIds(backgroundExternalIds),
          ),
        ),
      );
      // DatabaseTaskQueue.addFunc('UpsertExternalIds', () => {
      //   return this.timer.timeAsync(
      //     `background external ID upsert (${backgroundExternalIds.length} ids)`,
      //     () => upsertRawProgramExternalIds(backgroundExternalIds),
      //   );
      // }).catch((e) => {
      //   this.logger.error(
      //     e,
      //     'Error saving non-essential external IDs. A fixer will run for these',
      //   );
      // });
    });

    const end = performance.now();
    this.logger.debug(
      'upsertContentPrograms took %d millis. %d upsertedPrograms',
      round(end - start, 3),
      upsertedPrograms.length,
    );

    return upsertedPrograms;
  }

  private async handleProgramGroupings(
    upsertedPrograms: RawProgram[],
    programInfos: Record<string, MintedRawProgramInfo>,
  ) {
    const programsBySourceAndServer = ld
      .chain(upsertedPrograms)
      .groupBy('sourceType')
      .mapValues((ps) => groupBy(ps, 'externalSourceId'))
      .value();

    for (const [sourceType, byServerName] of Object.entries(
      programsBySourceAndServer,
    )) {
      for (const [serverName, programs] of Object.entries(byServerName)) {
        // This is just extra safety because lodash erases the type in groupBy
        const typ = programSourceTypeFromString(sourceType);
        if (!typ) {
          return;
        }

        await this.handleSingleSourceProgramGroupings(
          programs,
          programInfos,
          typ,
          serverName,
        );
      }
    }
  }

  private async handleSingleSourceProgramGroupings(
    upsertedPrograms: RawProgram[],
    programInfos: Record<string, MintedRawProgramInfo>,
    mediaSourceType: ProgramSourceType,
    mediaSourceId: string,
  ) {
    const grandparentRatingKeyToParentRatingKey: Record<
      string,
      Set<string>
    > = {};
    const grandparentRatingKeyToProgramId: Record<string, Set<string>> = {};
    const parentRatingKeyToProgramId: Record<string, Set<string>> = {};

    const relevantPrograms = seq.collect(upsertedPrograms, (program) => {
      if (program.type === ProgramType.Movie) {
        return;
      }

      const info = programInfos[programExternalIdString(program)];
      if (!info) {
        return;
      }

      const originalProgram = info.apiProgram.originalProgram;

      if (originalProgram.sourceType !== mediaSourceType) {
        return;
      }

      if (isMovieMediaItem(originalProgram)) {
        return;
      }

      const [grandparentKey, parentKey] = match(originalProgram)
        .with(
          {
            sourceType: 'plex',
            program: { type: P.union('episode', 'track') },
          },
          ({ program: ep }) =>
            [ep.grandparentRatingKey, ep.parentRatingKey] as const,
        )
        .with(
          { sourceType: 'jellyfin', program: { Type: 'Episode' } },
          ({ program: ep }) => [ep.SeriesId, ep.ParentId] as const,
        )
        .with(
          { sourceType: 'jellyfin', program: { Type: 'Audio' } },
          ({ program: ep }) =>
            [
              find(ep.AlbumArtists, { Name: ep.AlbumArtist })?.Id,
              ep.ParentId,
            ] as const,
        )
        .otherwise(() => [null, null] as const);

      if (!grandparentKey || !parentKey) {
        this.logger.warn(
          'Unexpected null/empty parent keys: %O',
          originalProgram,
        );
        return;
      }

      return [
        program,
        {
          ...(originalProgram as NonMovieOriginalProgram),
          grandparentKey,
          parentKey,
        },
      ] as const;
    });

    const upsertedProgramById = groupByUniqProp(
      map(relevantPrograms, ([program]) => program),
      'uuid',
    );

    for (const [program, { grandparentKey, parentKey }] of relevantPrograms) {
      // const [grandparentKey, parentKey] = match(originalProgram)
      //   .with({sourceType: 'plex', program: {type: P.union('episode', 'track')}}, ({program: ep}) => [ep.grandparentRatingKey, ep.parentRatingKey] as const)
      //   .with({sourceType: 'jellyfin', program: {Type: 'Episode'}}, ({program: ep}) => [ep.SeriesId, ep.ParentId] as const)
      //   .with({sourceType: 'jellyfin', program: {Type: 'Audio'}}, ({program: ep}) => [ep.AlbumArtist, ep.ParentId] as const)
      //   .otherwise(() => [null, null] as const);

      // if (!grandparentKey || !parentKey) {
      //   console.warn('Unexpected null/empty parent keys: %O', originalProgram);
      //   continue;
      // }

      if (isNonEmptyString(grandparentKey)) {
        (grandparentRatingKeyToProgramId[grandparentKey] ??= new Set()).add(
          program.uuid,
        );

        const set = (grandparentRatingKeyToParentRatingKey[grandparentKey] ??=
          new Set());
        if (isNonEmptyString(parentKey)) {
          set.add(parentKey);
        }
      }

      if (isNonEmptyString(parentKey)) {
        (parentRatingKeyToProgramId[parentKey] ??= new Set()).add(program.uuid);
      }
    }

    const allGroupingKeys = concat(
      keys(grandparentRatingKeyToParentRatingKey),
      keys(parentRatingKeyToProgramId),
    );

    const existingGroupings = await this.timer.timeAsync(
      `selecting grouping external ids (${allGroupingKeys.length})`,
      () =>
        directDbAccess()
          .selectFrom('programGroupingExternalId')
          .where((eb) => {
            return eb.and([
              eb('programGroupingExternalId.sourceType', '=', mediaSourceType),
              eb(
                'programGroupingExternalId.externalSourceId',
                '=',
                mediaSourceId,
              ),
              eb(
                'programGroupingExternalId.externalKey',
                'in',
                allGroupingKeys,
              ),
            ]);
          })
          .innerJoin(
            'programGrouping',
            'programGroupingExternalId.groupUuid',
            'programGrouping.uuid',
          )
          .selectAll()
          .groupBy([
            'programGroupingExternalId.externalKey',
            'programGrouping.uuid',
          ])
          .execute(),
    );

    const foundGroupingRatingKeys = map(existingGroupings, 'externalKey');
    const missingGroupingRatingKeys = difference(
      allGroupingKeys,
      foundGroupingRatingKeys,
    );
    const grandparentKeys = new Set(keys(grandparentRatingKeyToProgramId));
    const missingGrandparents = filter(missingGroupingRatingKeys, (s) =>
      grandparentKeys.has(s),
    );

    const tvShowIdUpdates = new Set<string>();
    const artistIdUpdates = new Set<string>();
    const seasonIdUpdates = new Set<string>();
    const albumIdUpdates = new Set<string>();

    for (const group of existingGroupings) {
      for (const [
        upsertedProgram,
        { grandparentKey, parentKey },
      ] of relevantPrograms) {
        if (group.externalKey === grandparentKey) {
          switch (upsertedProgram.type) {
            case ProgramType.Episode:
              upsertedProgram.tvShowUuid = group.groupUuid;
              tvShowIdUpdates.add(upsertedProgram.uuid);
              break;
            case ProgramType.Track:
              upsertedProgram.artistUuid = group.groupUuid;
              artistIdUpdates.add(upsertedProgram.uuid);
              break;
          }
        } else if (group.externalKey === parentKey) {
          switch (upsertedProgram.type) {
            case ProgramType.Episode:
              upsertedProgram.seasonUuid = group.groupUuid;
              seasonIdUpdates.add(upsertedProgram.uuid);
              break;
            case ProgramType.Track:
              upsertedProgram.albumUuid = group.groupUuid;
              albumIdUpdates.add(upsertedProgram.uuid);
              break;
          }
        }
      }
    }

    // New ones
    const groupings: NewProgramGrouping[] = [];
    const externalIds: NewProgramGroupingExternalId[] = [];
    for (const missingGrandparent of missingGrandparents) {
      const matchingPrograms = filter(
        relevantPrograms,
        ([, { grandparentKey }]) => grandparentKey === missingGrandparent,
      );

      if (isEmpty(matchingPrograms)) {
        continue;
      }

      const grandparentGrouping = ProgramGroupingMinter.mintGrandparentGrouping(
        matchingPrograms[0][1],
      );

      if (isNull(grandparentGrouping)) {
        devAssert(false);
        continue;
      }

      matchingPrograms.forEach(([program]) => {
        if (grandparentGrouping.type === ProgramGroupingType.MusicArtist) {
          program.artistUuid = grandparentGrouping.uuid;
          artistIdUpdates.add(program.uuid);
        } else if (grandparentGrouping.type === ProgramGroupingType.TvShow) {
          program.tvShowUuid = grandparentGrouping.uuid;
          tvShowIdUpdates.add(program.uuid);
        }
      });

      const parentKeys = [
        ...(grandparentRatingKeyToParentRatingKey[missingGrandparent] ??
          new Set()),
      ];
      const parents = reject(parentKeys, (parent) =>
        foundGroupingRatingKeys.includes(parent),
      );

      for (const parentKey of parents) {
        const programIds = parentRatingKeyToProgramId[parentKey];
        if (!programIds || programIds.size === 0) {
          devAssert(false);
          continue;
        }

        const programs = filter(relevantPrograms, ([program]) =>
          programIds.has(program.uuid),
        );

        // Also should never happen...
        if (isEmpty(programs)) {
          devAssert(false);
          continue;
        }

        devAssert(() => uniq(map(programs, ([p]) => p.type)).length === 1);

        const parentGrouping = ProgramGroupingMinter.mintParentGrouping(
          programs[0][1],
        );

        if (!parentGrouping) {
          continue;
        }

        programs.forEach(([program]) => {
          if (program.type === ProgramType.Episode) {
            program.seasonUuid = parentGrouping.uuid;
            seasonIdUpdates.add(program.uuid);
          } else {
            program.albumUuid = parentGrouping.uuid;
            albumIdUpdates.add(program.uuid);
          }
        });

        if (parentGrouping.type === ProgramGroupingType.TvShowSeason) {
          parentGrouping.showUuid = grandparentGrouping.uuid;
        } else if (parentGrouping.type === ProgramGroupingType.MusicAlbum) {
          parentGrouping.artistUuid = grandparentGrouping.uuid;
        }

        groupings.push(parentGrouping);
        externalIds.push(
          ...ProgramGroupingMinter.mintGroupingExternalIds(
            programs[0][1],
            parentGrouping.uuid,
            mediaSourceId,
            'parent',
          ),
        );
      }

      groupings.push(grandparentGrouping);
      externalIds.push(
        ...ProgramGroupingMinter.mintGroupingExternalIds(
          matchingPrograms[0][1],
          grandparentGrouping.uuid,
          mediaSourceId,
          'grandparent',
        ),
      );
    }

    if (isEmpty(groupings)) {
      return;
    }

    await this.timer.timeAsync('upsert program_groupings', () =>
      directDbAccess()
        .transaction()
        .execute((tx) =>
          tx
            .insertInto('programGrouping')
            .values(groupings)
            .executeTakeFirstOrThrow(),
        ),
    );

    if (!isEmpty(externalIds)) {
      await this.timer.timeAsync('upsert program_grouping external ids', () =>
        directDbAccess()
          .transaction()
          .execute((tx) =>
            tx
              .insertInto('programGroupingExternalId')
              .values(externalIds)
              .executeTakeFirstOrThrow(),
          ),
      );
    }

    const allProgramIds = [
      ...tvShowIdUpdates,
      ...albumIdUpdates,
      ...artistIdUpdates,
      ...seasonIdUpdates,
    ];

    if (!isEmpty(allProgramIds)) {
      // Surprisingly it's faster to do these all at once...
      await this.timer.timeAsync('update program relations', () =>
        directDbAccess()
          .transaction()
          .execute((tx) =>
            tx
              .updateTable('program')
              .$if(!isEmpty(tvShowIdUpdates), (_) =>
                _.set((eb) => ({
                  tvShowUuid: reduce(
                    [...tvShowIdUpdates],
                    (acc, curr) =>
                      acc
                        .when('program.uuid', '=', curr)
                        .then(upsertedProgramById[curr].tvShowUuid),
                    eb.case() as unknown as ProgramRelationCaseBuilder,
                  )
                    .else(eb.ref('program.tvShowUuid'))
                    .end(),
                })),
              )
              .$if(!isEmpty(albumIdUpdates), (_) =>
                _.set((eb) => ({
                  albumUuid: reduce(
                    [...albumIdUpdates],
                    (acc, curr) =>
                      acc
                        .when('program.uuid', '=', curr)
                        .then(upsertedProgramById[curr].albumUuid),
                    eb.case() as unknown as ProgramRelationCaseBuilder,
                  )
                    .else(eb.ref('program.albumUuid'))
                    .end(),
                })),
              )
              .$if(!isEmpty(seasonIdUpdates), (_) =>
                _.set((eb) => ({
                  seasonUuid: reduce(
                    [...seasonIdUpdates],
                    (acc, curr) =>
                      acc
                        .when('program.uuid', '=', curr)
                        .then(upsertedProgramById[curr].seasonUuid),
                    eb.case() as unknown as ProgramRelationCaseBuilder,
                  )
                    .else(eb.ref('program.seasonUuid'))
                    .end(),
                })),
              )
              .$if(!isEmpty(artistIdUpdates), (_) =>
                _.set((eb) => ({
                  artistUuid: reduce(
                    [...artistIdUpdates],
                    (acc, curr) =>
                      acc
                        .when('program.uuid', '=', curr)
                        .then(upsertedProgramById[curr].artistUuid),
                    eb.case() as unknown as ProgramRelationCaseBuilder,
                  )
                    .else(eb.ref('program.artistUuid'))
                    .end(),
                })),
              )
              .where('program.uuid', 'in', [...allProgramIds])
              .executeTakeFirst(),
          ),
      );
    }
  }

  private schedulePlexExternalIdsTask(upsertedPrograms: NewRawProgram[]) {
    PlexTaskQueue.pause();
    this.timer.timeSync('schedule Plex external IDs tasks', () => {
      forEach(
        filter(upsertedPrograms, { sourceType: ProgramSourceType.PLEX }),
        (program) => {
          try {
            const task = new SavePlexProgramExternalIdsTask(program.uuid);
            task.logLevel = 'trace';
            PlexTaskQueue.add(task).catch((e) => {
              this.logger.error(
                e,
                'Error saving external IDs for program %s',
                program,
              );
            });
          } catch (e) {
            this.logger.error(
              e,
              'Failed to schedule external IDs task for persisted program: %O',
              program,
            );
          }
        },
      );
    });
  }

  private scheduleJellyfinExternalIdsTask(upsertedPrograms: NewRawProgram[]) {
    JellyfinTaskQueue.pause();
    this.timer.timeSync('Schedule Jellyfin external IDs tasks', () => {
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
              this.logger.error(
                e,
                'Error saving external IDs for program %s',
                program,
              );
            });
          } catch (e) {
            this.logger.error(
              e,
              'Failed to schedule external IDs task for persisted program: %O',
              program,
            );
          }
        },
      );
    });
  }
}

function isMovieMediaItem(item: ContentProgramOriginalProgram): boolean {
  return match(item)
    .with({ sourceType: 'plex', program: { type: 'movie' } }, () => true)
    .with({ sourceType: 'jellyfin', program: { Type: 'Movie' } }, () => true)
    .otherwise(() => false);
}
