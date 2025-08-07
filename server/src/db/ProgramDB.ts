import type {
  GetOrInsertResult,
  IProgramDB,
  ProgramGroupingChildCounts,
  ProgramGroupingExternalIdLookup,
  WithChannelIdFilter,
} from '@/db/interfaces/IProgramDB.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { ReconcileProgramDurationsTask } from '@/tasks/ReconcileProgramDurationsTask.js';
import { AnonymousTask } from '@/tasks/Task.js';
import { JellyfinTaskQueue, PlexTaskQueue } from '@/tasks/TaskQueue.js';
import {
  SaveJellyfinProgramExternalIdsTask,
  type SaveJellyfinProgramExternalIdsTaskFactory,
} from '@/tasks/jellyfin/SaveJellyfinProgramExternalIdsTask.js';
import {
  SavePlexProgramExternalIdsTask,
  type SavePlexProgramExternalIdsTaskFactory,
} from '@/tasks/plex/SavePlexProgramExternalIdsTask.js';
import { KEYS } from '@/types/inject.js';
import { MarkNonNullable, Maybe, PagedResult } from '@/types/util.js';
import { Timer } from '@/util/Timer.js';
import { devAssert } from '@/util/debug.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { createExternalId } from '@tunarr/shared';
import { seq } from '@tunarr/shared/util';
import {
  ChannelProgram,
  ContentProgram,
  isContentProgram,
} from '@tunarr/types';
import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import dayjs from 'dayjs';
import { inject, injectable, interfaces } from 'inversify';
import {
  CaseWhenBuilder,
  InsertResult,
  Kysely,
  NotNull,
  UpdateResult,
} from 'kysely';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite';
import {
  chunk,
  concat,
  difference,
  filter,
  first,
  flatMap,
  flatten,
  forEach,
  groupBy,
  head,
  isEmpty,
  isNil,
  isNull,
  isUndefined,
  keys,
  map,
  mapValues,
  omit,
  partition,
  reduce,
  reject,
  round,
  some,
  uniq,
  uniqBy,
  values,
} from 'lodash-es';
import { Dictionary, MarkOptional, MarkRequired } from 'ts-essentials';
import { v4 } from 'uuid';
import { typedProperty } from '../types/path.ts';
import { getNumericEnvVar, TUNARR_ENV_VARS } from '../util/env.ts';
import {
  flatMapAsyncSeq,
  groupByFunc,
  groupByUniq,
  groupByUniqProp,
  isDefined,
  isNonEmptyString,
  mapAsyncSeq,
  mapToObj,
  run,
} from '../util/index.ts';
import { ProgramConverter } from './converters/ProgramConverter.ts';
import { ProgramGroupingMinter } from './converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from './converters/ProgramMinter.ts';
import { ProgramExternalIdType } from './custom_types/ProgramExternalIdType.ts';
import {
  ProgramSourceType,
  programSourceTypeFromString,
} from './custom_types/ProgramSourceType.ts';
import { PageParams } from './interfaces/IChannelDB.ts';
import {
  AllProgramFields,
  AllProgramJoins,
  ProgramUpsertFields,
  selectProgramsBuilder,
  withProgramByExternalId,
  withProgramExternalIds,
  withProgramGroupingExternalIds,
  withTrackAlbum,
  withTrackArtist,
  withTvSeason,
  withTvShow,
} from './programQueryHelpers.ts';
import { MediaSourceType } from './schema/MediaSource.ts';
import {
  NewProgramDao,
  ProgramDao,
  programExternalIdString,
  ProgramType,
  ProgramDao as RawProgram,
} from './schema/Program.ts';
import {
  MinimalProgramExternalId,
  NewProgramExternalId,
  NewSingleOrMultiExternalId,
  ProgramExternalId,
  ProgramExternalIdKeys,
  toInsertableProgramExternalId,
} from './schema/ProgramExternalId.ts';
import {
  AllProgramGroupingFields,
  NewProgramGrouping,
  ProgramGroupingType,
  ProgramGroupingUpdate,
} from './schema/ProgramGrouping.ts';
import {
  NewProgramGroupingExternalId,
  NewSingleOrMultiProgramGroupingExternalId,
  ProgramGroupingExternalId,
  ProgramGroupingExternalIdFieldsWithAlias,
  toInsertableProgramGroupingExternalId,
} from './schema/ProgramGroupingExternalId.ts';
import { DB } from './schema/db.ts';
import type {
  MusicAlbumWithExternalIds,
  NewProgramGroupingWithExternalIds,
  NewProgramWithExternalIds,
  ProgramGroupingWithExternalIds,
  ProgramWithExternalIds,
  ProgramWithRelations,
  TvSeasonWithExternalIds,
} from './schema/derivedTypes.ts';

type ValidatedContentProgram = MarkRequired<
  ContentProgram,
  'externalSourceName' | 'externalSourceType'
>;

type MintedNewProgramInfo = {
  program: NewProgramDao;
  externalIds: NewSingleOrMultiExternalId[];
  apiProgram: ValidatedContentProgram;
};

type ContentProgramWithHierarchy = Omit<
  MarkRequired<ContentProgram, 'grandparent' | 'parent'>,
  'subtype'
> & {
  subtype: 'episode' | 'track';
};

type ProgramRelationCaseBuilder = CaseWhenBuilder<
  DB,
  'program',
  unknown,
  string | null
>;

type RelevantProgramWithHierarchy = {
  program: RawProgram;
  programWithHierarchy: ContentProgramWithHierarchy & {
    grandparentKey: string;
    parentKey: string;
  };
};

// Keep this low to make bun sqlite happy.
const DEFAULT_PROGRAM_GROUPING_UPDATE_CHUNK_SIZE = 100;

@injectable()
export class ProgramDB implements IProgramDB {
  private timer: Timer; // = new Timer(this.logger);

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(ProgramConverter) private programConverter: ProgramConverter,
    @inject(SavePlexProgramExternalIdsTask.KEY)
    private savePlexProgramExternalIdsTaskFactory: SavePlexProgramExternalIdsTaskFactory,
    @inject(SaveJellyfinProgramExternalIdsTask.KEY)
    private saveJellyfinProgramExternalIdsTask: SaveJellyfinProgramExternalIdsTaskFactory,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.ProgramDaoMinterFactory)
    private programMinterFactory: interfaces.AutoFactory<ProgramDaoMinter>,
  ) {
    this.timer = new Timer(this.logger);
  }

  async getProgramById(id: string) {
    return this.db
      .selectFrom('program')
      .selectAll()
      .select((eb) => withProgramExternalIds(eb, ProgramExternalIdKeys))
      .where('program.uuid', '=', id)
      .executeTakeFirst();
  }

  async getProgramExternalIds(
    id: string,
    externalIdTypes?: ProgramExternalIdType[],
  ) {
    return await this.db
      .selectFrom('programExternalId')
      .selectAll()
      .where('programExternalId.programUuid', '=', id)
      .$if(!isEmpty(externalIdTypes), (qb) =>
        qb.where('programExternalId.sourceType', 'in', externalIdTypes!),
      )
      .execute();
  }

  async getShowIdFromTitle(title: string) {
    const matchedGrouping = await this.db
      .selectFrom('programGrouping')
      .select('uuid')
      .where('title', '=', title)
      .where('type', '=', ProgramGroupingType.Show)
      .executeTakeFirst();

    return matchedGrouping?.uuid;
  }

  async updateProgramDuration(programId: string, duration: number) {
    await this.db
      .updateTable('program')
      .where('uuid', '=', programId)
      .set({
        duration,
      })
      .executeTakeFirst();
  }

  async getProgramsByIds(
    ids: string[],
    batchSize: number = 500,
  ): Promise<ProgramWithRelations[]> {
    const results: ProgramWithRelations[] = [];
    for (const idChunk of chunk(ids, batchSize)) {
      const res = await this.db
        .selectFrom('program')
        .selectAll()
        .select(withTrackAlbum)
        .select(withTrackArtist)
        .select(withTvSeason)
        .select(withTvShow)
        .select(withProgramExternalIds)
        .where('program.uuid', 'in', idChunk)
        .execute();
      results.push(...res);
    }
    return results;
  }

  async getProgramGrouping(id: string) {
    return this.db
      .selectFrom('programGrouping')
      .selectAll()
      .select(withProgramGroupingExternalIds)
      .where('uuid', '=', id)
      .executeTakeFirst();
  }

  async getProgramGroupings(ids: string[]) {
    const uniqueIds = uniq(ids);

    const results = await Promise.allSettled(
      chunk(uniqueIds, 1000).map((idChunk) => {
        return this.db
          .selectFrom('programGrouping')
          .selectAll()
          .select(withProgramGroupingExternalIds)
          .where('uuid', 'in', idChunk)
          .execute();
      }),
    );

    const map: Record<string, ProgramGroupingWithExternalIds> = {};
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          result.reason,
          'Error while querying for program groupings. Returning partial data.',
        );
        continue;
      }
      for (const grouping of result.value) {
        map[grouping.uuid] = grouping;
      }
    }
    return map;
  }

  async getProgramGroupingByExternalId(eid: ProgramGroupingExternalIdLookup) {
    return await this.db
      .selectFrom('programGroupingExternalId')
      .where('externalKey', '=', eid.externalKey)
      .where('externalSourceId', '=', eid.externalSourceId)
      .where('sourceType', '=', eid.sourceType)
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('programGrouping')
            .select(AllProgramGroupingFields)
            .whereRef(
              'programGrouping.uuid',
              '=',
              'programGroupingExternalId.groupUuid',
            )
            .select(withProgramGroupingExternalIds),
        ).as('grouping'),
      )
      .executeTakeFirst()
      .then((result) => result?.grouping ?? undefined);
  }

  async getProgramParent(
    programId: string,
  ): Promise<Maybe<ProgramGroupingWithExternalIds>> {
    const p = await selectProgramsBuilder(this.db, {
      joins: { tvSeason: true, trackAlbum: true },
    })
      .where('program.uuid', '=', programId)
      .executeTakeFirst()
      .then((program) => program?.tvSeason ?? program?.trackAlbum);

    // It would be better if we didn'thave to do this in two queries...
    if (p) {
      const eids = await this.db
        .selectFrom('programGroupingExternalId')
        .where('groupUuid', '=', p.uuid)
        .selectAll()
        .execute();
      return {
        ...p,
        externalIds: eids,
      };
    }

    return;
  }

  getChildren(
    parentId: string,
    parentType: 'season' | 'album',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<ProgramWithExternalIds>>;
  getChildren(
    parentId: string,
    parentType: 'artist',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<MusicAlbumWithExternalIds>>;
  getChildren(
    parentId: string,
    parentType: 'show',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<TvSeasonWithExternalIds>>;
  async getChildren(
    parentId: string,
    parentType: ProgramGroupingType,
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<
    PagedResult<ProgramWithExternalIds | ProgramGroupingWithExternalIds>
  > {
    if (parentType === 'album' || parentType === 'season') {
      const baseQuery = params?.channelId
        ? this.db
            .selectFrom('channelPrograms')
            .where('channelPrograms.channelUuid', '=', params.channelId)
            .innerJoin('program', 'program.uuid', 'channelPrograms.programUuid')
            .where(
              'program.type',
              '=',
              parentType === 'album' ? 'track' : 'episode',
            )
            .where(
              parentType === 'album' ? 'albumUuid' : 'seasonUuid',
              '=',
              parentId,
            )
        : this.db
            .selectFrom('program')
            .where(
              'program.type',
              '=',
              parentType === 'album' ? 'track' : 'episode',
            )
            .where(
              parentType === 'album' ? 'albumUuid' : 'seasonUuid',
              '=',
              parentId,
            );

      const countPromise = baseQuery
        .select((eb) => eb.fn.count<number>('uuid').as('count'))
        .executeTakeFirstOrThrow();

      const resultPromise = baseQuery
        .select(withProgramExternalIds)
        .selectAll()
        .orderBy(['seasonNumber asc', 'episode asc'])
        .$if(!!params && params.limit >= 0, (eb) => eb.offset(params!.offset))
        .$if(!!params && params.limit >= 0, (eb) => eb.limit(params!.limit))
        .execute();

      const [{ count }, results] = await Promise.all([
        countPromise,
        resultPromise,
      ]);

      return {
        total: count,
        results,
      };
    } else {
      const childType = parentType === 'artist' ? 'album' : 'season';
      if (params?.channelId) {
        const baseQuery = this.db
          .selectFrom('channelPrograms')
          .where('channelPrograms.channelUuid', '=', params?.channelId)
          .innerJoin('program', 'channelPrograms.programUuid', 'program.uuid')
          .innerJoin(
            'programGrouping',
            childType === 'season' ? 'program.seasonUuid' : 'program.albumUuid',
            'programGrouping.uuid',
          )
          .where(
            'program.type',
            '=',
            childType === 'album' ? 'track' : 'episode',
          )
          .where(
            parentType === 'artist'
              ? 'program.artistUuid'
              : 'program.tvShowUuid',
            '=',
            parentId,
          )
          .groupBy('programGrouping.uuid');

        const [{ count }, results] = await Promise.all([
          baseQuery
            .select((eb) =>
              eb.fn
                .count<number>('programGrouping.uuid')
                .distinct()
                .as('count'),
            )
            .executeTakeFirstOrThrow(),
          baseQuery
            .selectAll()
            .orderBy(childType === 'season' ? 'title asc' : 'year asc')
            .select(withProgramGroupingExternalIds)
            .$if(!!params && params.limit >= 0, (eb) =>
              eb.offset(params.offset),
            )
            .$if(!!params && params.limit >= 0, (eb) => eb.limit(params.limit))
            .execute(),
        ]);

        return {
          total: count,
          results,
        };
      } else {
        const baseQuery = this.db
          .selectFrom('programGrouping')
          .where('programGrouping.type', '=', childType)
          .where(
            childType === 'season'
              ? 'programGrouping.showUuid'
              : 'programGrouping.artistUuid',
            '=',
            parentId,
          );

        const [{ count }, results] = await Promise.all([
          baseQuery
            .select((eb) =>
              eb.fn.count<number>('programGrouping.uuid').as('count'),
            )
            .executeTakeFirstOrThrow(),
          baseQuery
            .selectAll()
            .orderBy(childType === 'season' ? 'title asc' : 'year asc')
            .select(withProgramGroupingExternalIds)
            .$if(!!params && params.limit >= 0, (eb) =>
              eb.offset(params!.offset),
            )
            .$if(!!params && params.limit >= 0, (eb) => eb.limit(params!.limit))
            .execute(),
        ]);

        return {
          total: count,
          results,
        };
      }
    }
  }

  async lookupByExternalId(eid: {
    sourceType: ProgramSourceType;
    externalSourceId: string;
    externalKey: string;
  }) {
    return first(
      values(
        await this.lookupByExternalIds(
          new Set([[eid.sourceType, eid.externalSourceId, eid.externalKey]]),
        ),
      ),
    );
  }

  async lookupByExternalIds(ids: Set<[string, string, string]>) {
    const allIds = [...ids];
    const programsByExternalIds: ProgramWithRelations[] = [];
    for (const idChunk of chunk(allIds, 200)) {
      programsByExternalIds.push(
        ...(await this.db
          .selectFrom('programExternalId')
          .select((eb) =>
            withProgramByExternalId(eb, { joins: AllProgramJoins }),
          )
          .where((eb) =>
            eb.or(
              map(idChunk, ([ps, es, ek]) =>
                eb.and([
                  eb('programExternalId.externalKey', '=', ek),
                  eb('programExternalId.externalSourceId', '=', es),
                  eb(
                    'programExternalId.sourceType',
                    '=',
                    programSourceTypeFromString(ps)!,
                  ),
                ]),
              ),
            ),
          )
          .execute()
          .then((_) => seq.collect(_, (eid) => eid.program))),
      );
    }

    return groupByUniq(
      map(programsByExternalIds, (program) =>
        this.programConverter.programDaoToContentProgram(
          program,
          program.externalIds ?? [],
        ),
      ),
      (item) => item.id,
    );
  }

  async programIdsByExternalIds(
    ids: Set<[string, string, string]>,
    chunkSize: number = 50,
  ) {
    if (ids.size === 0) {
      return {};
    }

    const externalIds = await flatMapAsyncSeq(
      chunk([...ids], chunkSize),
      (idChunk) => {
        return this.db
          .selectFrom('programExternalId')
          .selectAll()
          .where((eb) =>
            eb.or(
              map(idChunk, ([ps, es, ek]) => {
                return eb.and([
                  eb('programExternalId.externalKey', '=', ek),
                  eb('programExternalId.externalSourceId', '=', es),
                  eb(
                    'programExternalId.sourceType',
                    '=',
                    programSourceTypeFromString(ps)!,
                  ),
                ]);
              }),
            ),
          )
          .execute();
      },
    );

    return mapValues(
      groupByUniq(externalIds, (eid) =>
        createExternalId(
          eid.sourceType,
          eid.externalSourceId!,
          eid.externalKey,
        ),
      ),
      (eid) => eid.programUuid,
    );
  }

  async updateProgramPlexRatingKey(
    programId: string,
    plexServerName: string,
    details: MarkOptional<
      Pick<
        ProgramExternalId,
        'externalKey' | 'directFilePath' | 'externalFilePath'
      >,
      'directFilePath' | 'externalFilePath'
    >,
  ) {
    const existingRatingKey = await this.db
      .selectFrom('programExternalId')
      .selectAll()
      .where((eb) =>
        eb.and({
          programUuid: programId,
          externalSourceId: plexServerName,
          sourceType: ProgramExternalIdType.PLEX,
        }),
      )
      .executeTakeFirst();

    if (isNil(existingRatingKey)) {
      const now = +dayjs();
      return await this.db
        .insertInto('programExternalId')
        .values({
          uuid: v4(),
          createdAt: now,
          updatedAt: now,
          programUuid: programId,
          sourceType: ProgramExternalIdType.PLEX,
          externalSourceId: plexServerName,
          ...details,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } else {
      await this.db
        .updateTable('programExternalId')
        .set({
          externalKey: details.externalKey,
        })
        .$if(isNonEmptyString(details.externalFilePath), (_) =>
          _.set({
            externalFilePath: details.externalFilePath!,
          }),
        )
        .$if(isNonEmptyString(details.directFilePath), (_) =>
          _.set({
            directFilePath: details.directFilePath!,
          }),
        )
        .where('uuid', '=', existingRatingKey.uuid)
        .executeTakeFirst();
      return await this.db
        .selectFrom('programExternalId')
        .selectAll()
        .where('uuid', '=', existingRatingKey.uuid)
        .executeTakeFirstOrThrow();
    }
  }

  async replaceProgramExternalId(
    programId: string,
    newExternalId: NewProgramExternalId,
    oldExternalId?: MinimalProgramExternalId,
  ) {
    await this.db.transaction().execute(async (tx) => {
      if (oldExternalId) {
        await tx
          .deleteFrom('programExternalId')
          .where('programExternalId.programUuid', '=', programId)
          .where(
            'programExternalId.externalKey',
            '=',
            oldExternalId.externalKey,
          )
          .where(
            'programExternalId.externalSourceId',
            '=',
            oldExternalId.externalSourceId,
          )
          .where('programExternalId.sourceType', '=', oldExternalId.sourceType)
          // TODO: Blocked on https://github.com/oven-sh/bun/issues/16909
          // .limit(1)
          .execute();
      }
      await tx.insertInto('programExternalId').values(newExternalId).execute();
    });
  }

  async upsertContentPrograms(
    programs: ChannelProgram[],
    programUpsertBatchSize: number = 100,
  ) {
    if (isEmpty(programs)) {
      return [];
    }

    const start = performance.now();
    // TODO: Wrap all of this stuff in a class and use its own logger
    const [, nonPersisted] = partition(programs, (p) => p.persisted);
    const minter = this.programMinterFactory();

    const [contentPrograms, invalidPrograms] = partition(
      uniqBy(filter(nonPersisted, isContentProgram), (p) => p.uniqueId),
      (p): p is ValidatedContentProgram =>
        isNonEmptyString(p.externalSourceType) &&
        isNonEmptyString(p.externalSourceName) &&
        isNonEmptyString(p.externalKey) &&
        p.duration > 0,
    );

    if (!isEmpty(invalidPrograms)) {
      this.logger.warn(
        'Found %d invalid programs when saving:\n%O',
        invalidPrograms.length,
        invalidPrograms,
      );
    }

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

    // TODO: handle custom shows
    const programsToPersist: MintedNewProgramInfo[] = map(
      contentPrograms,
      (p) => {
        const program = minter.contentProgramDtoToDao(p);
        const externalIds = minter.mintExternalIds(
          p.externalSourceName,
          p.externalSourceId,
          program.uuid,
          p,
        );
        return { program, externalIds, apiProgram: p };
      },
    );

    const programInfoByUniqueId = groupByUniq(
      programsToPersist,
      ({ program }) => programExternalIdString(program),
    );

    this.logger.debug('Upserting %d programs', programsToPersist.length);

    // TODO: The way we deal with uniqueness right now makes a Program entity
    // exist 1:1 with its "external" entity, i.e. the same logical movie will
    // have duplicate entries in the DB across different servers and sources.
    const upsertedPrograms: MarkNonNullable<ProgramDao, 'mediaSourceId'>[] = [];
    await this.timer.timeAsync('programUpsert', async () => {
      for (const c of chunk(programsToPersist, programUpsertBatchSize)) {
        upsertedPrograms.push(
          ...(await this.db.transaction().execute((tx) =>
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
              // .onConflict((oc) =>
              //   oc
              //     .columns(['sourceType', 'mediaSourceId', 'externalKey'])
              //     .doUpdateSet((eb) =>
              //       mapToObj(ProgramUpsertFields, (f) => ({
              //         [f.replace('excluded.', '')]: eb.ref(f),
              //       })),
              //     ),
              // )
              .returningAll()
              .$narrowType<{ mediaSourceId: NotNull }>()
              .execute(),
          )),
        );
      }
    });

    const programExternalIds = flatMap(upsertedPrograms, (program) => {
      const eids =
        programInfoByUniqueId[programExternalIdString(program)]?.externalIds ??
        [];
      forEach(eids, (eid) => {
        eid.programUuid = program.uuid;
      });
      return eids;
    });

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
      () => this.upsertProgramExternalIds(requiredExternalIds, 200),
    );

    this.schedulePlexExternalIdsTask(upsertedPrograms);
    this.scheduleJellyfinExternalIdsTask(upsertedPrograms);

    setImmediate(() => {
      this.logger.debug('Scheduling follow-up program tasks...');

      GlobalScheduler.scheduleOneOffTask(
        ReconcileProgramDurationsTask.KEY,
        dayjs().add(500, 'ms'),
        [],
      );

      PlexTaskQueue.resume();
      JellyfinTaskQueue.resume();

      this.logger.debug('Upserting external IDs in background');

      GlobalScheduler.scheduleOneOffTask(
        'UpsertExternalIds',
        dayjs().add(100),
        [],
        AnonymousTask('UpsertExternalIds', () =>
          this.timer.timeAsync(
            `background external ID upsert (${backgroundExternalIds.length} ids)`,
            () => this.upsertProgramExternalIds(backgroundExternalIds),
          ),
        ),
      );
    });

    const end = performance.now();
    this.logger.debug(
      'upsertContentPrograms took %d millis. %d upsertedPrograms',
      round(end - start, 3),
      upsertedPrograms.length,
    );

    return upsertedPrograms;
  }

  async upsertPrograms(
    programs: NewProgramWithExternalIds[],
    programUpsertBatchSize: number = 100,
  ) {
    if (isEmpty(programs)) {
      return [];
    }

    const db = this.db;

    const externalIdsByProgramCanonicalId = groupByFunc(
      programs,
      (program) => program.canonicalId ?? programExternalIdString(program),
      (program) => program.externalIds,
    );

    return await Promise.all(
      chunk(programs, programUpsertBatchSize).map(async (c) => {
        const chunkResult = await db.transaction().execute((tx) =>
          tx
            .insertInto('program')
            .values(c.map((program) => omit(program, 'externalIds')))
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
        );

        const allExternalIds = flatten(c.map((program) => program.externalIds));
        for (const program of chunkResult) {
          const key = program.canonicalId ?? programExternalIdString(program);
          const eids = externalIdsByProgramCanonicalId[key] ?? [];
          for (const eid of eids) {
            eid.programUuid = program.uuid;
          }
        }

        const externalIdsByProgramId =
          await this.upsertProgramExternalIds(allExternalIds);

        return chunkResult.map(
          (upsertedProgram) =>
            ({
              ...upsertedProgram,
              externalIds: externalIdsByProgramId[upsertedProgram.uuid] ?? [],
            }) satisfies ProgramWithExternalIds,
        );
      }),
    ).then(flatten);
  }

  async upsertProgramExternalIds(
    externalIds: NewSingleOrMultiExternalId[],
    chunkSize: number = 100,
  ): Promise<Dictionary<ProgramExternalId[]>> {
    if (isEmpty(externalIds)) {
      return {};
    }

    const logger = this.logger;

    const [singles, multiples] = partition(
      externalIds,
      (id) => id.type === 'single',
    );

    let singleIdPromise: Promise<ProgramExternalId[]>;
    if (!isEmpty(singles)) {
      singleIdPromise = mapAsyncSeq(
        chunk(singles, chunkSize),
        (singleChunk) => {
          return this.db.transaction().execute((tx) =>
            tx
              .insertInto('programExternalId')
              .values(singleChunk.map(toInsertableProgramExternalId))
              .onConflict((oc) =>
                oc
                  .columns(['programUuid', 'sourceType', 'externalSourceId'])
                  .where('externalSourceId', 'is', null)
                  .doUpdateSet((eb) => ({
                    updatedAt: eb.ref('excluded.updatedAt'),
                    externalFilePath: eb.ref('excluded.externalFilePath'),
                    directFilePath: eb.ref('excluded.directFilePath'),
                    programUuid: eb.ref('excluded.programUuid'),
                  })),
              )
              .onConflict((oc) =>
                oc
                  .columns(['programUuid', 'sourceType'])
                  .where('mediaSourceId', 'is', null)
                  .doUpdateSet((eb) => ({
                    updatedAt: eb.ref('excluded.updatedAt'),
                    externalFilePath: eb.ref('excluded.externalFilePath'),
                    directFilePath: eb.ref('excluded.directFilePath'),
                    programUuid: eb.ref('excluded.programUuid'),
                  })),
              )
              .returningAll()
              .execute(),
          );
        },
      ).then(flatten);
    } else {
      singleIdPromise = Promise.resolve([]);
    }

    let multiIdPromise: Promise<ProgramExternalId[]>;
    if (!isEmpty(multiples)) {
      multiIdPromise = mapAsyncSeq(
        chunk(multiples, chunkSize),
        (multiChunk) => {
          return this.db.transaction().execute((tx) =>
            tx
              .insertInto('programExternalId')
              .values(multiChunk.map(toInsertableProgramExternalId))
              .onConflict((oc) =>
                oc
                  .columns(['programUuid', 'sourceType', 'externalSourceId'])
                  .where('externalSourceId', 'is not', null)
                  .doUpdateSet((eb) => ({
                    updatedAt: eb.ref('excluded.updatedAt'),
                    externalFilePath: eb.ref('excluded.externalFilePath'),
                    directFilePath: eb.ref('excluded.directFilePath'),
                    programUuid: eb.ref('excluded.programUuid'),
                  })),
              )
              .onConflict((oc) =>
                oc
                  .columns(['programUuid', 'sourceType', 'mediaSourceId'])
                  .where('mediaSourceId', 'is not', null)
                  .doUpdateSet((eb) => ({
                    updatedAt: eb.ref('excluded.updatedAt'),
                    externalFilePath: eb.ref('excluded.externalFilePath'),
                    directFilePath: eb.ref('excluded.directFilePath'),
                    programUuid: eb.ref('excluded.programUuid'),
                  })),
              )
              .returningAll()
              .execute(),
          );
        },
      ).then(flatten);
    } else {
      multiIdPromise = Promise.resolve([]);
    }

    const [singleResult, multiResult] = await Promise.allSettled([
      singleIdPromise,
      multiIdPromise,
    ]);

    const allExternalIds: ProgramExternalId[] = [];
    if (singleResult.status === 'rejected') {
      logger.error(singleResult.reason, 'Error saving external IDs');
    } else {
      logger.trace('Upserted %d external IDs', singleResult.value.length);
      allExternalIds.push(...singleResult.value);
    }

    if (multiResult.status === 'rejected') {
      logger.error(multiResult.reason, 'Error saving external IDs');
    } else {
      logger.trace('Upserted %d external IDs', multiResult.value.length);
      allExternalIds.push(...multiResult.value);
    }

    return groupBy(allExternalIds, (eid) => eid.programUuid);
  }

  async getProgramsForMediaSource(mediaSourceId: string, type?: ProgramType) {
    return this.db
      .selectFrom('mediaSource')
      .where('mediaSource.uuid', '=', mediaSourceId)
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('program')
            .select(AllProgramFields)
            .$if(isDefined(type), (eb) => eb.where('program.type', '=', type!))
            .whereRef('mediaSource.name', '=', 'program.externalSourceId'),
        ).as('programs'),
      )
      .executeTakeFirst()
      .then((dbResult) => dbResult?.programs ?? []);
  }

  async getMediaSourceLibraryPrograms(libraryId: string) {
    return selectProgramsBuilder(this.db, { includeGroupingExternalIds: true })
      .where('libraryId', '=', libraryId)
      .selectAll()
      .select(withProgramExternalIds)
      .execute();
  }

  async getProgramCanonicalIdsForMediaSource(
    mediaSourceLibraryId: string,
    type: ProgramType,
  ) {
    return this.db
      .selectFrom('program')
      .where('program.libraryId', '=', mediaSourceLibraryId)
      .where('program.type', '=', type)
      .where('program.canonicalId', 'is not', null)
      .select([
        'program.uuid',
        'program.externalKey',
        'program.canonicalId',
        'program.libraryId',
      ])
      .$narrowType<{ canonicalId: string; libraryId: string }>()
      .execute()
      .then((result) => groupByUniq(result, (p) => p.externalKey));
  }

  async getProgramGroupingCanonicalIds(
    mediaSourceLibraryId: string,
    type: ProgramGroupingType,
    sourceType: MediaSourceType,
  ) {
    return this.db
      .selectFrom('programGrouping')
      .where('programGrouping.libraryId', '=', mediaSourceLibraryId)
      .where('programGrouping.type', '=', type)
      .where('programGrouping.canonicalId', 'is not', null)
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('programGroupingExternalId as eid')
            .where('eid.sourceType', '=', sourceType)
            .whereRef('eid.groupUuid', '=', 'programGrouping.uuid')
            .select(
              ProgramGroupingExternalIdFieldsWithAlias(
                ['externalKey', 'externalSourceId', 'sourceType'],
                'eid',
              ),
            ),
        ).as('externalIds'),
      )
      .select([
        'programGrouping.uuid',
        'programGrouping.canonicalId',
        'programGrouping.libraryId',
      ])
      .$narrowType<{ canonicalId: string; libraryId: string }>()
      .execute()
      .then((result) =>
        groupByUniq(result, (p) => head(p.externalIds)?.externalKey ?? ''),
      );
  }

  async getShowSeasons(showUuid: string) {
    return this.db
      .selectFrom('programGrouping')
      .where('programGrouping.showUuid', '=', showUuid)
      .where('programGrouping.type', '=', ProgramGroupingType.Season)
      .selectAll()
      .select(withProgramGroupingExternalIds)
      .execute();
  }

  async getArtistAlbums(artistUuid: string) {
    return this.db
      .selectFrom('programGrouping')
      .where('programGrouping.artistUuid', '=', artistUuid)
      .where('programGrouping.type', '=', ProgramGroupingType.Album)
      .selectAll()
      .select(withProgramGroupingExternalIds)
      .execute();
  }

  async getOrInsertProgramGrouping(
    dao: NewProgramGroupingWithExternalIds,
    externalId: ProgramGroupingExternalIdLookup,
    forceUpdate: boolean = false,
  ): Promise<GetOrInsertResult<ProgramGroupingWithExternalIds>> {
    const existing = await this.getProgramGroupingByExternalId(externalId);
    if (existing) {
      let wasUpdated = false;
      const missingAssociation =
        (existing.type === 'season' &&
          dao.showUuid &&
          dao.showUuid !== existing.showUuid) ||
        (existing.type === 'album' &&
          dao.artistUuid &&
          dao.artistUuid !== existing.artistUuid);
      const differentVersion = existing.canonicalId !== dao.canonicalId;
      const shouldUpdate =
        forceUpdate || differentVersion || missingAssociation;
      if (shouldUpdate) {
        dao.uuid = existing.uuid;
        dao.externalIds.forEach((externalId) => {
          externalId.groupUuid = existing.uuid;
        });
        await this.db.transaction().execute(async (tx) => {
          await this.updateProgramGrouping(dao, existing, tx);
          await this.updateProgramGroupingExternalIds(
            existing.externalIds,
            dao.externalIds,
            tx,
          );
        });

        wasUpdated = true;
      }

      return {
        entity: existing,
        wasInserted: false,
        wasUpdated,
      };
    }

    return await this.db.transaction().execute(async (tx) => {
      const grouping = await tx
        .insertInto('programGrouping')
        .values(omit(dao, 'externalIds'))
        .returningAll()
        .executeTakeFirstOrThrow();
      const externalIds: ProgramGroupingExternalId[] = [];
      if (dao.externalIds.length > 0) {
        externalIds.push(
          ...(await tx
            .insertInto('programGroupingExternalId')
            .values(
              dao.externalIds.map((eid) => ({
                ...omit(eid, 'type'),
                groupUuid: grouping.uuid,
              })),
            )
            .returningAll()
            .execute()),
        );
      }
      return {
        wasInserted: true,
        wasUpdated: false,
        entity: {
          ...grouping,
          externalIds,
        } satisfies ProgramGroupingWithExternalIds,
      };
    });
  }

  private async updateProgramGrouping(
    incoming: NewProgramGroupingWithExternalIds,
    existing: ProgramGroupingWithExternalIds,
    tx: Kysely<DB> = this.db,
  ) {
    const update: ProgramGroupingUpdate = {
      ...omit(existing, 'externalIds'),
      index: incoming.index,
      title: incoming.title,
      summary: incoming.summary,
      icon: incoming.icon,
      // relations
      artistUuid: incoming.artistUuid,
      showUuid: incoming.showUuid,
    };

    await tx
      .updateTable('programGrouping')
      .where('uuid', '=', existing.uuid)
      .set(update)
      .limit(1)
      .executeTakeFirstOrThrow();
  }

  private async updateProgramGroupingExternalIds(
    existingIds: ProgramGroupingExternalId[],
    newIds: NewSingleOrMultiProgramGroupingExternalId[],
    tx: Kysely<DB> = this.db,
  ) {
    devAssert(
      uniq(seq.collect(existingIds, (id) => id.mediaSourceId)).length === 1,
    );
    devAssert(uniq(existingIds.map((id) => id.libraryId)).length === 1);
    devAssert(uniq(newIds.map((id) => id.libraryId)).length === 1);

    const newByUniqueId: Record<
      string,
      NewSingleOrMultiProgramGroupingExternalId
    > = groupByUniq(newIds, (id) => {
      switch (id.type) {
        case 'single':
          return id.sourceType;
        case 'multi':
          return `${id.sourceType}|${id.externalSourceId}`;
      }
    });
    const newUniqueIds = new Set(keys(newByUniqueId));

    const existingByUniqueId: Record<string, ProgramGroupingExternalId> =
      groupByUniq(existingIds, (id) => {
        if (isValidSingleExternalIdType(id.sourceType)) {
          return id.sourceType;
        } else {
          return `${id.sourceType}|${id.externalSourceId}`;
        }
      });
    const existingUniqueIds = new Set(keys(existingByUniqueId));

    const deletedUniqueKeys = existingUniqueIds.difference(newUniqueIds);
    const addedUniqueKeys = newUniqueIds.difference(existingUniqueIds);
    const updatedKeys = existingUniqueIds.intersection(newUniqueIds);

    // TODO: This stinks, consider adding a unique ID
    const deletedIds = [...deletedUniqueKeys.values()].map(
      (key) => existingByUniqueId[key],
    );
    await Promise.all(
      chunk(deletedIds, 100).map((idChunk) => {
        return tx
          .deleteFrom('programGroupingExternalId')
          .where((eb) => {
            const clauses = idChunk.map((id) =>
              eb.and([
                eb('mediaSourceId', '=', id.mediaSourceId),
                eb('libraryId', '=', id.libraryId),
                eb('externalKey', '=', id.externalKey),
                eb('externalSourceId', '=', id.externalSourceId),
                eb('sourceType', '=', id.sourceType),
              ]),
            );
            return eb.or(clauses);
          })
          .executeTakeFirstOrThrow();
      }),
    );

    const addedIds = [...addedUniqueKeys.union(updatedKeys).values()].map(
      (key) => newByUniqueId[key],
    );

    await Promise.all(
      chunk(addedIds, 100).map((idChunk) =>
        this.upsertProgramGroupingExternalIdsChunk(idChunk, tx),
      ),
    );
  }

  async getProgramGroupingChildCounts(groupingIds: string[]) {
    if (isEmpty(groupingIds)) {
      return {};
    }

    const uniqueIds = uniq(groupingIds);

    const allResults = await Promise.allSettled(
      chunk(uniqueIds, 1000).map((idChunk) =>
        this.db
          .selectFrom('programGrouping as pg')
          .where('pg.uuid', 'in', idChunk)
          .leftJoin('program as p', (j) =>
            j.on((eb) =>
              eb.or([
                eb('pg.uuid', '=', eb.ref('p.tvShowUuid')),
                eb('pg.uuid', '=', eb.ref('p.artistUuid')),
                eb('pg.uuid', '=', eb.ref('p.seasonUuid')),
                eb('pg.uuid', '=', eb.ref('p.albumUuid')),
              ]),
            ),
          )
          .leftJoin('programGrouping as pg2', (j) =>
            j.on((eb) =>
              eb.or([
                eb('pg.uuid', '=', eb.ref('pg2.artistUuid')),
                eb('pg.uuid', '=', eb.ref('pg2.showUuid')),
              ]),
            ),
          )
          .select(['pg.uuid as uuid', 'pg.type as type'])
          .select((eb) =>
            eb.fn.count<number>('p.uuid').distinct().as('programCount'),
          )
          .select((eb) =>
            eb.fn.count<number>('pg2.uuid').distinct().as('childGroupCount'),
          )
          .groupBy('pg.uuid')
          .execute(),
      ),
    );

    const map: Record<string, ProgramGroupingChildCounts> = {};

    for (const result of allResults) {
      if (result.status === 'rejected') {
        this.logger.error(
          result.reason,
          'Failed querying program grouping children. Continuing with partial results',
        );
        continue;
      }

      for (const counts of result.value) {
        map[counts.uuid] = {
          type: counts.type,
          childCount:
            counts.type === 'season' || counts.type === 'album'
              ? counts.programCount
              : counts.childGroupCount,
          grandchildCount:
            counts.type === 'artist' || counts.type === 'show'
              ? counts.programCount
              : undefined,
        };
      }
    }

    return map;
  }

  async getProgramGroupingDescendants(
    groupId: string,
    groupTypeHint?: ProgramGroupingType,
  ) {
    return this.db
      .selectFrom('program')
      .$if(isUndefined(groupTypeHint), (qb) =>
        qb.where((eb) =>
          eb.or([
            eb('program.tvShowUuid', '=', groupId),
            eb('program.albumUuid', '=', groupId),
            eb('program.seasonUuid', '=', groupId),
            eb('program.artistUuid', '=', groupId),
          ]),
        ),
      )
      .$if(isDefined(groupTypeHint), (qb) => {
        switch (groupTypeHint!) {
          case 'show':
            return qb.where('program.tvShowUuid', '=', groupId);
          case 'season':
            return qb.where('program.seasonUuid', '=', groupId);
          case 'artist':
            return qb.where('program.artistUuid', '=', groupId);
          case 'album':
            return qb.where('program.albumUuid', '=', groupId);
        }
      })
      .selectAll()
      .select(withProgramExternalIds)
      .execute();
  }

  private async handleProgramGroupings(
    upsertedPrograms: MarkNonNullable<ProgramDao, 'mediaSourceId'>[],
    programInfos: Record<string, MintedNewProgramInfo>,
  ) {
    const programsBySourceAndServer = mapValues(
      groupBy(upsertedPrograms, 'sourceType'),
      (ps) => groupBy(ps, typedProperty('mediaSourceId')),
    );

    for (const [sourceType, byServerId] of Object.entries(
      programsBySourceAndServer,
    )) {
      for (const [serverId, programs] of Object.entries(byServerId)) {
        // Making an assumption that these are all the same... this field will
        // go away soon anyway
        const serverName = head(programs)!.externalSourceId;
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
          serverId,
        );
      }
    }
  }

  private async handleSingleSourceProgramGroupings(
    upsertedPrograms: RawProgram[],
    programInfos: Record<string, MintedNewProgramInfo>,
    mediaSourceType: ProgramSourceType,
    mediaSourceName: string,
    mediaSourceId: string,
  ) {
    const grandparentRatingKeyToParentRatingKey: Record<
      string,
      Set<string>
    > = {};
    const grandparentRatingKeyToProgramId: Record<string, Set<string>> = {};
    const parentRatingKeyToProgramId: Record<string, Set<string>> = {};

    const relevantPrograms: RelevantProgramWithHierarchy[] = seq.collect(
      upsertedPrograms,
      (program) => {
        if (
          program.type === ProgramType.Movie ||
          program.type === ProgramType.MusicVideo ||
          program.type === ProgramType.OtherVideo
        ) {
          return;
        }

        const info = programInfos[programExternalIdString(program)];
        if (!info) {
          return;
        }

        if (
          info.apiProgram.subtype === 'movie' ||
          info.apiProgram.subtype === 'music_video' ||
          info.apiProgram.subtype === 'other_video'
        ) {
          return;
        }

        const [grandparentKey, parentKey] = [
          info.apiProgram.grandparent?.externalKey,
          info.apiProgram.parent?.externalKey,
        ];

        if (!grandparentKey || !parentKey) {
          this.logger.warn(
            'Unexpected null/empty parent keys: %O',
            info.apiProgram,
          );
          return;
        }

        return {
          program,
          programWithHierarchy: {
            ...(info.apiProgram as ContentProgramWithHierarchy),
            grandparentKey,
            parentKey,
          },
        };
      },
    );

    const upsertedProgramById = groupByUniqProp(
      map(relevantPrograms, ({ program }) => program),
      'uuid',
    );

    for (const {
      program,
      programWithHierarchy: { grandparentKey, parentKey },
    } of relevantPrograms) {
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
        this.db
          .selectFrom('programGroupingExternalId')
          .where((eb) => {
            return eb.and([
              eb('programGroupingExternalId.sourceType', '=', mediaSourceType),
              eb(
                'programGroupingExternalId.externalSourceId',
                '=',
                mediaSourceName,
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

    const updatesByType: Record<ProgramGroupingType, Set<string>> = {
      album: new Set(),
      artist: new Set(),
      season: new Set(),
      show: new Set(),
    } as const;

    for (const group of existingGroupings) {
      for (const {
        program: upsertedProgram,
        programWithHierarchy: { grandparentKey, parentKey },
      } of relevantPrograms) {
        if (group.externalKey === grandparentKey) {
          switch (upsertedProgram.type) {
            case ProgramType.Episode:
              upsertedProgram.tvShowUuid = group.groupUuid;
              updatesByType[ProgramGroupingType.Show].add(upsertedProgram.uuid);
              break;
            case ProgramType.Track:
              upsertedProgram.artistUuid = group.groupUuid;
              updatesByType[ProgramGroupingType.Artist].add(
                upsertedProgram.uuid,
              );
              break;
            case 'movie':
            case 'music_video':
            case 'other_video':
            default:
              this.logger.warn(
                'Unexpected program type %s when calculating hierarchy. id = %s',
                upsertedProgram.type,
                upsertedProgram.uuid,
              );
              break;
          }
        } else if (group.externalKey === parentKey) {
          switch (upsertedProgram.type) {
            case ProgramType.Episode:
              upsertedProgram.seasonUuid = group.groupUuid;
              updatesByType[ProgramGroupingType.Season].add(
                upsertedProgram.uuid,
              );
              break;
            case ProgramType.Track:
              upsertedProgram.albumUuid = group.groupUuid;
              updatesByType[ProgramGroupingType.Album].add(
                upsertedProgram.uuid,
              );
              break;
            case 'movie':
            case 'music_video':
            case 'other_video':
            default:
              this.logger.warn(
                'Unexpected program type %s when calculating hierarchy. id = %s',
                upsertedProgram.type,
                upsertedProgram.uuid,
              );
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
        ({ programWithHierarchy: { grandparentKey } }) =>
          grandparentKey === missingGrandparent,
      );

      if (isEmpty(matchingPrograms)) {
        continue;
      }

      const grandparentGrouping = ProgramGroupingMinter.mintGrandparentGrouping(
        matchingPrograms[0].programWithHierarchy,
      );

      if (isNull(grandparentGrouping)) {
        devAssert(false);
        continue;
      }

      matchingPrograms.forEach(({ program }) => {
        if (grandparentGrouping.type === ProgramGroupingType.Artist) {
          program.artistUuid = grandparentGrouping.uuid;
          updatesByType[ProgramGroupingType.Artist].add(program.uuid);
        } else if (grandparentGrouping.type === ProgramGroupingType.Show) {
          program.tvShowUuid = grandparentGrouping.uuid;
          updatesByType[ProgramGroupingType.Show].add(program.uuid);
        }
      });

      const parentKeys = [
        ...(grandparentRatingKeyToParentRatingKey[missingGrandparent] ??
          new Set()),
      ];
      const parents = reject(parentKeys, (parent) =>
        foundGroupingRatingKeys.includes(parent),
      );

      // const existingParents = seq.collect(
      //   existingParentKeys,
      //   (key) => existingGroupingsByKey[key],
      // );
      // Fix mappings if we have to...
      // const existingParentsNeedingUpdate = existingParents.filter(parent => {
      //   if (parent.type === ProgramGroupingType.Album && parent.artistUuid !== grandparentGrouping.uuid) {
      //     parent.artistUuid = grandparentGrouping.uuid;
      //     return true;
      //   } else if (parent.type === ProgramGroupingType.Season && parent.showUuid !== grandparentGrouping.uuid) {
      //     return true;
      //   }
      //   return false;
      // });

      for (const parentKey of parents) {
        const programIds = parentRatingKeyToProgramId[parentKey];
        if (!programIds || programIds.size === 0) {
          devAssert(false);
          continue;
        }

        const programs = filter(relevantPrograms, ({ program }) =>
          programIds.has(program.uuid),
        );

        // Also should never happen...
        if (isEmpty(programs)) {
          devAssert(false);
          continue;
        }

        devAssert(
          () => uniq(map(programs, ({ program: p }) => p.type)).length === 1,
        );

        const parentGrouping = ProgramGroupingMinter.mintParentGrouping(
          programs[0].programWithHierarchy,
        );

        if (!parentGrouping) {
          continue;
        }

        programs.forEach(({ program }) => {
          if (program.type === ProgramType.Episode) {
            program.seasonUuid = parentGrouping.uuid;
            updatesByType[ProgramGroupingType.Season].add(program.uuid);
          } else if (program.type === ProgramType.Track) {
            program.albumUuid = parentGrouping.uuid;
            updatesByType[ProgramGroupingType.Album].add(program.uuid);
          }
        });

        if (parentGrouping.type === ProgramGroupingType.Season) {
          parentGrouping.showUuid = grandparentGrouping.uuid;
        } else if (parentGrouping.type === ProgramGroupingType.Album) {
          parentGrouping.artistUuid = grandparentGrouping.uuid;
        }

        groupings.push(parentGrouping);
        externalIds.push(
          ...ProgramGroupingMinter.mintGroupingExternalIds(
            programs[0].programWithHierarchy,
            parentGrouping.uuid,
            mediaSourceName,
            mediaSourceId,
            'parent',
          ),
        );
      }

      groupings.push(grandparentGrouping);
      externalIds.push(
        ...ProgramGroupingMinter.mintGroupingExternalIds(
          matchingPrograms[0].programWithHierarchy,
          grandparentGrouping.uuid,
          mediaSourceName,
          mediaSourceId,
          'grandparent',
        ),
      );
    }

    if (!isEmpty(groupings)) {
      await this.timer.timeAsync('upsert program_groupings', () =>
        this.db
          .transaction()
          .execute((tx) =>
            tx
              .insertInto('programGrouping')
              .values(groupings)
              .executeTakeFirstOrThrow(),
          ),
      );
    }

    if (!isEmpty(externalIds)) {
      await this.timer.timeAsync('upsert program_grouping external ids', () =>
        Promise.all(
          chunk(
            externalIds, //.map(toInsertableProgramGroupingExternalId),
            100,
          ).map((externalIds) =>
            this.db
              .transaction()
              .execute((tx) =>
                this.upsertProgramGroupingExternalIdsChunk(externalIds, tx),
              ),
          ),
        ),
      );
    }

    const hasUpdates = some(updatesByType, (updates) => updates.size > 0);

    if (hasUpdates) {
      // Surprisingly it's faster to do these all at once...
      await this.timer.timeAsync('update program relations', () =>
        this.db.transaction().execute(async (tx) => {
          // For each program, we produce 3 SQL variables: when = ?, then = ?, and uuid in [?].
          // We have to chunk by type in order to ensure we don't go over the variable limit
          const tvShowIdUpdates = [...updatesByType[ProgramGroupingType.Show]];

          const chunkSize = run(() => {
            const envVal = getNumericEnvVar(
              TUNARR_ENV_VARS.DEBUG__PROGRAM_GROUPING_UPDATE_CHUNK_SIZE,
            );

            if (isNonEmptyString(envVal) && !isNaN(parseInt(envVal))) {
              return Math.min(10_000, parseInt(envVal));
            }
            return DEFAULT_PROGRAM_GROUPING_UPDATE_CHUNK_SIZE;
          });

          const updates: Promise<UpdateResult[]>[] = [];

          if (!isEmpty(tvShowIdUpdates)) {
            // Should produce up to 30_000 variables each iteration...
            for (const idChunk of chunk(tvShowIdUpdates, chunkSize)) {
              updates.push(
                tx
                  .updateTable('program')
                  .set((eb) => ({
                    tvShowUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr].tvShowUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.tvShowUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute(),
              );
            }
          }

          const seasonIdUpdates = [
            ...updatesByType[ProgramGroupingType.Season],
          ];

          if (!isEmpty(seasonIdUpdates)) {
            // Should produce up to 30_000 variables each iteration...
            for (const idChunk of chunk(seasonIdUpdates, chunkSize)) {
              updates.push(
                tx
                  .updateTable('program')
                  .set((eb) => ({
                    seasonUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr].seasonUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.seasonUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute(),
              );
            }
          }

          const musicArtistUpdates = [
            ...updatesByType[ProgramGroupingType.Artist],
          ];

          if (!isEmpty(musicArtistUpdates)) {
            // Should produce up to 30_000 variables each iteration...
            for (const idChunk of chunk(musicArtistUpdates, chunkSize)) {
              updates.push(
                tx
                  .updateTable('program')
                  .set((eb) => ({
                    artistUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr].artistUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.artistUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute(),
              );
            }
          }

          const musicAlbumUpdates = [
            ...updatesByType[ProgramGroupingType.Album],
          ];

          if (!isEmpty(musicAlbumUpdates)) {
            // Should produce up to 30_000 variables each iteration...
            for (const idChunk of chunk(musicAlbumUpdates, chunkSize)) {
              updates.push(
                tx
                  .updateTable('program')
                  .set((eb) => ({
                    albumUuid: reduce(
                      idChunk,
                      (acc, curr) =>
                        acc
                          .when('program.uuid', '=', curr)
                          .then(upsertedProgramById[curr].albumUuid),
                      eb.case() as unknown as ProgramRelationCaseBuilder,
                    )
                      .else(eb.ref('program.albumUuid'))
                      .end(),
                  }))
                  .where('program.uuid', 'in', idChunk)
                  .execute(),
              );
            }
          }

          await Promise.all(updates);
        }),
      );
    }
  }

  private async upsertProgramGroupingExternalIdsChunk(
    ids: (
      | NewSingleOrMultiProgramGroupingExternalId
      | NewProgramGroupingExternalId
    )[],
    tx: Kysely<DB> = this.db,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const [singles, multiples] = partition(ids, (id) =>
      isValidSingleExternalIdType(id.sourceType),
    );

    const promises: Promise<InsertResult>[] = [];

    if (singles.length > 0) {
      promises.push(
        tx
          .insertInto('programGroupingExternalId')
          .values(singles.map(toInsertableProgramGroupingExternalId))
          .onConflict((oc) =>
            oc
              .columns(['groupUuid', 'sourceType'])
              .where('mediaSourceId', 'is', null)
              .doUpdateSet((eb) => ({
                updatedAt: eb.ref('excluded.updatedAt'),
                externalFilePath: eb.ref('excluded.externalFilePath'),
                groupUuid: eb.ref('excluded.groupUuid'),
                externalKey: eb.ref('excluded.externalKey'),
              })),
          )
          .executeTakeFirstOrThrow(),
      );
    }

    if (multiples.length > 0) {
      promises.push(
        tx
          .insertInto('programGroupingExternalId')
          .values(multiples.map(toInsertableProgramGroupingExternalId))
          .onConflict((oc) =>
            oc
              .columns(['groupUuid', 'sourceType', 'mediaSourceId'])
              .where('mediaSourceId', 'is not', null)
              .doUpdateSet((eb) => ({
                updatedAt: eb.ref('excluded.updatedAt'),
                externalFilePath: eb.ref('excluded.externalFilePath'),
                groupUuid: eb.ref('excluded.groupUuid'),
                externalKey: eb.ref('excluded.externalKey'),
              })),
          )
          .executeTakeFirstOrThrow(),
      );
    }

    await Promise.all(promises);
  }

  private schedulePlexExternalIdsTask(upsertedPrograms: ProgramDao[]) {
    PlexTaskQueue.pause();
    this.timer.timeSync('schedule Plex external IDs tasks', () => {
      forEach(
        filter(upsertedPrograms, { sourceType: ProgramSourceType.PLEX }),
        (program) => {
          try {
            const task = this.savePlexProgramExternalIdsTaskFactory(
              program.uuid,
            );
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

  private scheduleJellyfinExternalIdsTask(upsertedPrograms: ProgramDao[]) {
    JellyfinTaskQueue.pause();
    this.timer.timeSync('Schedule Jellyfin external IDs tasks', () => {
      forEach(
        filter(
          upsertedPrograms,
          (p) => p.sourceType === ProgramSourceType.JELLYFIN,
        ),
        (program) => {
          try {
            const task = this.saveJellyfinProgramExternalIdsTask(program.uuid);
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
