import type {
  IProgramDB,
  ProgramCanonicalIdLookupResult,
  ProgramGroupingCanonicalIdLookupResult,
  ProgramGroupingChildCounts,
  ProgramGroupingExternalIdLookup,
  UpsertResult,
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
  untag,
} from '@tunarr/types';
import { isValidSingleExternalIdType } from '@tunarr/types/schemas';
import { RunResult } from 'better-sqlite3';
import dayjs from 'dayjs';
import {
  and,
  asc,
  count,
  countDistinct,
  isNull as dbIsNull,
  eq,
  inArray,
  or,
  sql,
} from 'drizzle-orm';
import {
  BaseSQLiteDatabase,
  SelectedFields,
  SQLiteSelectBuilder,
} from 'drizzle-orm/sqlite-core';
import { inject, injectable, interfaces } from 'inversify';
import {
  CaseWhenBuilder,
  InsertResult,
  Kysely,
  NotNull,
  UpdateResult,
} from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import {
  chunk,
  compact,
  concat,
  difference,
  filter,
  first,
  flatMap,
  flatten,
  forEach,
  groupBy,
  head,
  isArray,
  isEmpty,
  isNil,
  isNull,
  isUndefined,
  keys,
  last,
  map,
  mapValues,
  omit,
  partition,
  reduce,
  reject,
  round,
  some,
  sum,
  uniq,
  uniqBy,
} from 'lodash-es';
import {
  Dictionary,
  MarkOptional,
  MarkRequired,
  StrictExclude,
} from 'ts-essentials';
import { match, P } from 'ts-pattern';
import { v4 } from 'uuid';
import { typedProperty } from '../types/path.ts';
import {
  createManyRelationAgg,
  mapRawJsonRelationResult,
} from '../util/drizzleUtil.ts';
import { getNumericEnvVar, TUNARR_ENV_VARS } from '../util/env.ts';
import {
  flatMapAsyncSeq,
  groupByUniq,
  groupByUniqProp,
  isDefined,
  isNonEmptyString,
  mapAsyncSeq,
  mapToObj,
  programExternalIdString,
  run,
  unzip,
} from '../util/index.ts';
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
  ProgramUpsertFields,
  selectProgramsBuilder,
  withProgramByExternalId,
  withProgramExternalIds,
} from './programQueryHelpers.ts';
import { Artwork, NewArtwork } from './schema/Artwork.ts';
import { ChannelPrograms } from './schema/ChannelPrograms.ts';
import { Credit, NewCredit } from './schema/Credit.ts';
import {
  EntityGenre,
  Genre,
  NewGenre,
  NewGenreEntity,
} from './schema/Genre.ts';
import { RemoteMediaSourceType } from './schema/MediaSource.ts';
import {
  NewProgramDao,
  Program,
  ProgramDao,
  ProgramType,
  ProgramDao as RawProgram,
} from './schema/Program.ts';
import { NewProgramChapter, ProgramChapter } from './schema/ProgramChapter.ts';
import {
  MinimalProgramExternalId,
  NewProgramExternalId,
  NewSingleOrMultiExternalId,
  ProgramExternalId,
  toInsertableProgramExternalId,
} from './schema/ProgramExternalId.ts';
import {
  NewProgramGrouping,
  NewProgramGroupingOrm,
  ProgramGrouping,
  ProgramGroupingOrm,
  ProgramGroupingType,
  type ProgramGroupingTypes,
} from './schema/ProgramGrouping.ts';
import {
  NewProgramGroupingExternalId,
  NewSingleOrMultiProgramGroupingExternalId,
  ProgramGroupingExternalId,
  ProgramGroupingExternalIdOrm,
  toInsertableProgramGroupingExternalId,
} from './schema/ProgramGroupingExternalId.ts';
import {
  NewProgramMediaFile,
  ProgramMediaFile,
} from './schema/ProgramMediaFile.ts';
import {
  NewProgramMediaStream,
  ProgramMediaStream,
} from './schema/ProgramMediaStream.ts';
import {
  NewProgramSubtitles,
  ProgramSubtitles,
} from './schema/ProgramSubtitles.ts';
import { ProgramVersion } from './schema/ProgramVersion.ts';
import {
  NewStudio,
  NewStudioEntity,
  Studio,
  StudioEntity,
} from './schema/Studio.ts';
import {
  MediaSourceId,
  MediaSourceName,
  MediaSourceType,
  ProgramState,
  RemoteSourceType,
} from './schema/base.js';
import { DB } from './schema/db.ts';
import type {
  MusicAlbumOrm,
  NewProgramGroupingWithRelations,
  NewProgramVersion,
  NewProgramWithRelations,
  ProgramGroupingOrmWithRelations,
  ProgramGroupingWithExternalIds,
  ProgramWithExternalIds,
  ProgramWithRelationsOrm,
  TvSeasonOrm,
} from './schema/derivedTypes.ts';
import { DrizzleDBAccess, schema } from './schema/index.ts';

type MintedNewProgramInfo = {
  program: NewProgramDao;
  externalIds: NewSingleOrMultiExternalId[];
  apiProgram: ContentProgram;
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
    @inject(SavePlexProgramExternalIdsTask.KEY)
    private savePlexProgramExternalIdsTaskFactory: SavePlexProgramExternalIdsTaskFactory,
    @inject(SaveJellyfinProgramExternalIdsTask.KEY)
    private saveJellyfinProgramExternalIdsTask: SaveJellyfinProgramExternalIdsTaskFactory,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.ProgramDaoMinterFactory)
    private programMinterFactory: interfaces.AutoFactory<ProgramDaoMinter>,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
  ) {
    this.timer = new Timer(this.logger);
  }

  async getProgramById(
    id: string,
  ): Promise<Maybe<MarkRequired<ProgramWithRelationsOrm, 'externalIds'>>> {
    return this.drizzleDB.query.program.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
      with: {
        externalIds: true,
        artwork: true,
        subtitles: true,
        credits: true,
        versions: {
          with: {
            mediaStreams: true,
            mediaFiles: true,
            chapters: true,
          },
        },
      },
    });
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
    ids: string[] | readonly string[],
    // joins: DBQueryConfig<'many', true, (typeof schema)['programRelations']>['with'],
    batchSize: number = 500,
  ): Promise<ProgramWithRelationsOrm[]> {
    const results: ProgramWithRelationsOrm[] = [];
    for (const idChunk of chunk(ids, batchSize)) {
      const res = await this.drizzleDB.query.program.findMany({
        where: (fields, { inArray }) => inArray(fields.uuid, idChunk),
        with: {
          album: {
            with: {
              artwork: true,
            },
          },
          artist: true,
          season: true,
          show: {
            with: {
              artwork: true,
            },
          },
          externalIds: true,
          artwork: true,
        },
      });
      results.push(...res);
    }
    return results;
  }

  async getProgramGrouping(id: string) {
    return this.drizzleDB.query.programGrouping.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
      with: {
        externalIds: true,
        artwork: true,
      },
    });
  }

  async getProgramGroupings(
    ids: string[],
  ): Promise<Record<string, ProgramGroupingOrmWithRelations>> {
    if (ids.length === 0) {
      return {};
    }

    const uniqueIds = uniq(ids);

    const results = await Promise.allSettled(
      chunk(uniqueIds, 1000).map((idChunk) => {
        return this.drizzleDB.query.programGrouping.findMany({
          where: (fields, { inArray }) => inArray(fields.uuid, idChunk),
          with: {
            externalIds: true,
            artwork: true,
            artist: true,
            show: true,
            credits: true,
          },
        });
      }),
    );

    const map: Record<string, ProgramGroupingOrmWithRelations> = {};
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

  async getProgramGroupingByExternalId(
    eid: ProgramGroupingExternalIdLookup,
  ): Promise<Maybe<ProgramGroupingOrmWithRelations>> {
    return await this.drizzleDB.query.programGroupingExternalId
      .findFirst({
        where: (row, { and, or, eq }) =>
          and(
            eq(row.externalKey, eid.externalKey),
            eq(row.sourceType, eid.sourceType),
            or(
              eq(row.externalSourceId, untag(eid.externalSourceId)),
              eq(row.mediaSourceId, eid.externalSourceId),
            ),
          ),
        with: {
          grouping: {
            with: {
              externalIds: true,
            },
          },
        },
      })
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
  ): Promise<PagedResult<ProgramWithRelationsOrm>>;
  getChildren(
    parentId: string,
    parentType: 'artist',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<MusicAlbumOrm>>;
  getChildren(
    parentId: string,
    parentType: 'show',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<TvSeasonOrm>>;
  getChildren(
    parentId: string,
    parentType: 'artist' | 'show',
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<PagedResult<ProgramGroupingOrmWithRelations>>;
  async getChildren(
    parentId: string,
    parentType: ProgramGroupingType,
    params?: WithChannelIdFilter<PageParams>,
  ): Promise<
    | PagedResult<ProgramWithRelationsOrm>
    | PagedResult<ProgramGroupingOrmWithRelations>
  > {
    if (parentType === 'album' || parentType === 'season') {
      return this.getTerminalChildren(parentId, parentType, params);
    } else {
      return this.getGroupingChildren(parentId, parentType, params);
    }
  }

  private async getGroupingChildren(
    parentId: string,
    parentType: ProgramGroupingTypes['Show'] | ProgramGroupingTypes['Artist'],
    params?: WithChannelIdFilter<PageParams>,
  ) {
    const childType = parentType === 'artist' ? 'album' : 'season';
    function builder<
      TSelection extends SelectedFields | undefined,
      TResultType extends 'sync' | 'async',
      TRunResult,
    >(f: SQLiteSelectBuilder<TSelection, TResultType, TRunResult>) {
      return f
        .from(Program)
        .where(
          and(
            eq(
              Program.type,
              parentType === ProgramGroupingType.Show
                ? ProgramType.Episode
                : ProgramType.Track,
            ),
            eq(
              parentType === ProgramGroupingType.Show
                ? Program.tvShowUuid
                : Program.artistUuid,
              parentId,
            ),
            params?.channelId
              ? eq(ChannelPrograms.channelUuid, params.channelId)
              : undefined,
          ),
        );
    }

    const sq = this.drizzleDB
      .select()
      .from(ProgramGroupingExternalId)
      .where(eq(ProgramGroupingExternalId.groupUuid, ProgramGrouping.uuid))
      .as('sq');

    const baseQuery = builder(
      this.drizzleDB.select({
        grouping: ProgramGrouping,
        externalIds: createManyRelationAgg(sq, 'external_ids'),
        artwork: createManyRelationAgg(
          this.drizzleDB
            .select()
            .from(Artwork)
            .where(eq(ProgramGrouping.uuid, Artwork.groupingId))
            .as('artwork'),
          'artwork',
        ),
      }),
    )
      .innerJoin(
        ProgramGrouping,
        eq(
          childType === 'season' ? Program.seasonUuid : Program.albumUuid,
          ProgramGrouping.uuid,
        ),
      )
      .orderBy(asc(ProgramGrouping.index))
      .offset(params?.offset ?? 0)
      .limit(params?.limit ?? 1_000_000)
      .groupBy(ProgramGrouping.uuid);

    const baseCountQuery = builder(
      this.drizzleDB.select({
        count: countDistinct(ProgramGrouping.uuid),
      }),
    )
      .innerJoin(
        ProgramGrouping,
        eq(
          childType === 'season' ? Program.seasonUuid : Program.albumUuid,
          ProgramGrouping.uuid,
        ),
      )
      .groupBy(ProgramGrouping.uuid);

    if (params?.channelId) {
      const res = await baseQuery.innerJoin(
        ChannelPrograms,
        eq(ChannelPrograms.programUuid, Program.uuid),
      );

      const cq = baseCountQuery.innerJoin(
        ChannelPrograms,
        eq(ChannelPrograms.programUuid, Program.uuid),
      );

      const programs = res.map(({ grouping, externalIds, artwork }) => {
        const withRelations = grouping as ProgramGroupingOrmWithRelations;
        withRelations.externalIds = mapRawJsonRelationResult(
          externalIds,
          ProgramGroupingExternalId,
        );
        withRelations.artwork = mapRawJsonRelationResult(artwork, Artwork);
        return withRelations;
      });

      return {
        total: sum((await cq).map(({ count }) => count)),
        results: programs,
      };
    } else {
      const res = await baseQuery;

      const programs = res.map(({ grouping, externalIds, artwork }) => {
        const withRelations = grouping as ProgramGroupingOrmWithRelations;
        withRelations.externalIds = mapRawJsonRelationResult(
          externalIds,
          ProgramGroupingExternalId,
        );
        withRelations.artwork = mapRawJsonRelationResult(artwork, Artwork);
        return withRelations;
      });

      return {
        total: sum((await baseCountQuery).map(({ count }) => count)),
        results: programs,
      };
    }
  }

  private async getTerminalChildren(
    parentId: string,
    parentType: ProgramGroupingTypes['Season'] | ProgramGroupingTypes['Album'],
    params?: WithChannelIdFilter<PageParams>,
  ) {
    function builder<
      TSelection extends SelectedFields | undefined,
      TResultType extends 'sync' | 'async',
      TRunResult,
    >(f: SQLiteSelectBuilder<TSelection, TResultType, TRunResult>) {
      return f
        .from(Program)
        .where(
          and(
            eq(
              Program.type,
              parentType === ProgramGroupingType.Album
                ? ProgramType.Track
                : ProgramType.Episode,
            ),
            eq(
              parentType === ProgramGroupingType.Album
                ? Program.albumUuid
                : Program.seasonUuid,
              parentId,
            ),
            params?.channelId
              ? eq(ChannelPrograms.channelUuid, params.channelId)
              : undefined,
          ),
        );
    }

    const sq = this.drizzleDB
      .select()
      .from(ProgramExternalId)
      .where(eq(ProgramExternalId.programUuid, Program.uuid))
      .as('sq');

    const baseQuery = builder(
      this.drizzleDB.select({
        program: Program,
        externalIds: createManyRelationAgg(sq, 'external_ids'),
        artwork: createManyRelationAgg(
          this.drizzleDB
            .select()
            .from(Artwork)
            .where(eq(Artwork.programId, Program.uuid))
            .as('artwork'),
          'artwork',
        ),
      }),
    ).orderBy(asc(Program.episode));

    const baseCountQuery = builder(
      this.drizzleDB.select({
        count: count(),
      }),
    );

    if (params?.channelId) {
      const res = await baseQuery
        .offset(params?.offset ?? 0)
        .limit(params?.limit ?? 1_000_000)
        .innerJoin(
          ChannelPrograms,
          eq(ChannelPrograms.programUuid, Program.uuid),
        );

      const cq = baseCountQuery.innerJoin(
        ChannelPrograms,
        eq(ChannelPrograms.programUuid, Program.uuid),
      );

      const programs = res.map(({ program, externalIds, artwork }) => {
        const withRelations: ProgramWithRelationsOrm = program;
        withRelations.externalIds = mapRawJsonRelationResult(
          externalIds,
          ProgramExternalId,
        );
        withRelations.artwork = mapRawJsonRelationResult(artwork, Artwork);
        return withRelations;
      });

      console.log(programs);

      return {
        total: sum((await cq).map(({ count }) => count)),
        results: programs,
      };
    } else {
      const res = await baseQuery;

      const programs = res.map(({ program, externalIds, artwork }) => {
        const withRelations: ProgramWithRelationsOrm = program;
        withRelations.externalIds = mapRawJsonRelationResult(
          externalIds,
          ProgramExternalId,
        );
        withRelations.artwork = mapRawJsonRelationResult(artwork, Artwork);
        return withRelations;
      });

      return {
        total: sum((await baseCountQuery).map(({ count }) => count)),
        results: programs,
      };
    }
  }

  async lookupByExternalId(eid: {
    sourceType: RemoteSourceType;
    externalSourceId: MediaSourceId;
    externalKey: string;
  }) {
    return first(
      await this.lookupByExternalIds(
        new Set([[eid.sourceType, eid.externalSourceId, eid.externalKey]]),
      ),
    );
  }

  async lookupByExternalIds(
    ids:
      | Set<[RemoteSourceType, MediaSourceId, string]>
      | Set<readonly [RemoteSourceType, MediaSourceId, string]>,
    chunkSize: number = 200,
  ) {
    const allIds = [...ids];
    const programs: MarkRequired<ProgramWithRelationsOrm, 'externalIds'>[] = [];
    for (const idChunk of chunk(allIds, chunkSize)) {
      const results = await this.drizzleDB.query.programExternalId.findMany({
        where: (fields, { or, and, eq }) => {
          const ands = idChunk.map(([ps, es, ek]) =>
            and(
              eq(fields.externalKey, ek),
              eq(fields.sourceType, ps),
              eq(fields.mediaSourceId, es),
            ),
          );
          return or(...ands);
        },
        with: {
          program: {
            with: {
              album: true,
              artist: true,
              season: true,
              show: true,
              externalIds: true,
            },
          },
        },
      });
      programs.push(...seq.collect(results, (r) => r.program));
    }

    return programs;
  }

  async lookupByMediaSource(
    sourceType: RemoteMediaSourceType,
    sourceId: MediaSourceId,
    programType: Maybe<ProgramType>,
    chunkSize: number = 200,
  ): Promise<ProgramDao[]> {
    const programs: ProgramDao[] = [];
    let chunk: ProgramDao[] = [];
    let lastId: Maybe<string>;
    do {
      const result = await this.db
        .selectFrom('programExternalId')
        .select('programExternalId.uuid')
        .select((eb) =>
          withProgramByExternalId(eb, { joins: {} }, (qb) =>
            qb.$if(!!programType, (eb) =>
              eb.where('program.type', '=', programType!),
            ),
          ),
        )
        .where('programExternalId.sourceType', '=', sourceType)
        .where('programExternalId.mediaSourceId', '=', sourceId)
        .$if(!!lastId, (x) => x.where('programExternalId.uuid', '>', lastId!))
        .orderBy('programExternalId.uuid asc')
        .limit(chunkSize)
        .execute();
      chunk = seq.collect(result, (eid) => eid.program);
      programs.push(...chunk);
      lastId = last(result)?.uuid;
    } while (chunk.length > 0);

    return programs;
  }

  async programIdsByExternalIds(
    ids: Set<[string, MediaSourceId, string]>,
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
                  eb('programExternalId.mediaSourceId', '=', es),
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
        createExternalId(eid.sourceType, eid.mediaSourceId!, eid.externalKey),
      ),
      (eid) => eid.programUuid,
    );
  }

  async updateProgramPlexRatingKey(
    programId: string,
    serverId: MediaSourceId,
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
          mediaSourceId: serverId,
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
          mediaSourceId: serverId,
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
      (p) =>
        isNonEmptyString(p.externalSourceType) &&
        isNonEmptyString(p.externalSourceId) &&
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

    const programsToPersist: MintedNewProgramInfo[] = seq.collect(
      contentPrograms,
      (p) => {
        const program = minter.contentProgramDtoToDao(p);
        if (!program) {
          return;
        }
        const externalIds = minter.mintExternalIds(
          program.externalSourceId,
          program.mediaSourceId,
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

    const upsertedPrograms: MarkNonNullable<ProgramDao, 'mediaSourceId'>[] = [];
    await this.timer.timeAsync('programUpsert', async () => {
      for (const c of chunk(programsToPersist, programUpsertBatchSize)) {
        upsertedPrograms.push(
          ...(await this.db.transaction().execute((tx) =>
            tx
              .insertInto('program')
              .values(map(c, 'program'))
              // .onConflict((oc) =>
              //   oc
              //     .columns(['sourceType', 'externalSourceId', 'externalKey'])
              //     .doUpdateSet((eb) =>
              //       mapToObj(ProgramUpsertFields, (f) => ({
              //         [f.replace('excluded.', '')]: eb.ref(f),
              //       })),
              //     ),
              // )
              .onConflict((oc) =>
                oc
                  .columns(['sourceType', 'mediaSourceId', 'externalKey'])
                  .doUpdateSet((eb) =>
                    mapToObj(ProgramUpsertFields, (f) => ({
                      [f.replace('excluded.', '')]: eb.ref(f),
                    })),
                  ),
              )
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
      (p) => p.sourceType === 'plex' || p.sourceType === 'jellyfin',
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

  upsertPrograms(
    request: NewProgramWithRelations,
  ): Promise<ProgramWithExternalIds>;
  upsertPrograms(
    programs: NewProgramWithRelations[],
    programUpsertBatchSize?: number,
  ): Promise<ProgramWithExternalIds[]>;
  async upsertPrograms(
    requests: NewProgramWithRelations | NewProgramWithRelations[],
    programUpsertBatchSize: number = 100,
  ): Promise<ProgramWithExternalIds | ProgramWithExternalIds[]> {
    const wasSingleRequest = !isArray(requests);
    requests = isArray(requests) ? requests : [requests];
    if (isEmpty(requests)) {
      return [];
    }

    const db = this.db;

    // Group related items by canonicalId because the UUID we get back
    // from the upsert may not be the one we generated (if an existing entry)
    // already exists
    const requestsByCanonicalId = groupByUniq(
      requests,
      ({ program }) => program.canonicalId,
    );

    const result = await Promise.all(
      chunk(requests, programUpsertBatchSize).map(async (c) => {
        const chunkResult = await db.transaction().execute((tx) =>
          tx
            .insertInto('program')
            .values(c.map(({ program }) => program))
            .onConflict((oc) =>
              oc
                .columns(['sourceType', 'mediaSourceId', 'externalKey'])
                .doUpdateSet((eb) =>
                  mapToObj(ProgramUpsertFields, (f) => ({
                    [f.replace('excluded.', '')]: eb.ref(f),
                  })),
                ),
            )
            .returningAll()
            // All new programs must have mediaSourceId and canonicalId. This is enforced
            // by the NewProgramDao type
            .$narrowType<{ mediaSourceId: NotNull; canonicalId: NotNull }>()
            .execute(),
        );

        const allExternalIds = flatten(c.map((program) => program.externalIds));
        const versionsToInsert: NewProgramVersion[] = [];
        const artworkToInsert: NewArtwork[] = [];
        const subtitlesToInsert: NewProgramSubtitles[] = [];
        const creditsToInsert: NewCredit[] = [];
        const genresToInsert: Dictionary<NewGenre[]> = {};
        const studiosToInsert: Dictionary<NewStudio[]> = {};
        for (const program of chunkResult) {
          const key = program.canonicalId;
          const request: Maybe<NewProgramWithRelations> =
            requestsByCanonicalId[key];
          const eids = request?.externalIds ?? [];
          for (const eid of eids) {
            eid.programUuid = program.uuid;
          }

          for (const version of request?.versions ?? []) {
            version.programId = program.uuid;
            versionsToInsert.push(version);
          }

          for (const art of request?.artwork ?? []) {
            art.programId = program.uuid;
            artworkToInsert.push(art);
          }

          for (const subtitle of request?.subtitles ?? []) {
            subtitle.programId = program.uuid;
            subtitlesToInsert.push(subtitle);
          }

          for (const { credit, artwork } of request?.credits ?? []) {
            credit.programId = program.uuid;
            creditsToInsert.push(credit);
            artworkToInsert.push(...artwork);
          }

          for (const genre of request?.genres ?? []) {
            genresToInsert[program.uuid] ??= [];
            genresToInsert[program.uuid]?.push(genre);
          }

          for (const studio of request?.studios ?? []) {
            studiosToInsert[program.uuid] ??= [];
            studiosToInsert[program.uuid]?.push(studio);
          }
        }

        const externalIdsByProgramId =
          await this.upsertProgramExternalIds(allExternalIds);

        await this.upsertProgramVersions(versionsToInsert);

        // Credits must come before artwork because some art may
        // rely on credit IDs
        await this.upsertCredits(creditsToInsert);

        await this.upsertArtwork(artworkToInsert);

        await this.upsertSubtitles(subtitlesToInsert);

        for (const [programId, genres] of Object.entries(genresToInsert)) {
          await this.upsertProgramGenres(programId, genres);
        }

        for (const [programId, studios] of Object.entries(studiosToInsert)) {
          await this.upsertProgramStudios(programId, studios);
        }

        return chunkResult.map(
          (upsertedProgram) =>
            ({
              ...upsertedProgram,
              externalIds: externalIdsByProgramId[upsertedProgram.uuid] ?? [],
            }) satisfies ProgramWithExternalIds,
        );
      }),
    ).then(flatten);

    if (wasSingleRequest) {
      return head(result)!;
    } else {
      return result;
    }
  }

  private async upsertProgramVersions(versions: NewProgramVersion[]) {
    if (versions.length === 0) {
      this.logger.warn('No program versions passed for item');
      return [];
    }

    const insertedVersions: ProgramVersion[] = [];
    await this.db.transaction().execute(async (tx) => {
      const byProgramId = groupByUniq(versions, (version) => version.programId);
      for (const batch of chunk(Object.entries(byProgramId), 50)) {
        const [programIds, versionBatch] = unzip(batch);
        // We probably need to delete here, because we never really delete
        // programs on the upsert path.
        await tx
          .deleteFrom('programVersion')
          .where('programId', 'in', programIds)
          .executeTakeFirstOrThrow();

        const insertResult = await tx
          .insertInto('programVersion')
          .values(
            versionBatch.map((version) =>
              omit(version, ['chapters', 'mediaStreams', 'mediaFiles']),
            ),
          )
          .returningAll()
          .execute();

        await this.upsertProgramMediaStreams(
          versionBatch.flatMap(({ mediaStreams }) => mediaStreams),
          tx,
        );
        await this.upsertProgramChapters(
          versionBatch.flatMap(({ chapters }) => chapters ?? []),
          tx,
        );
        await this.upsertProgramMediaFiles(
          versionBatch.flatMap(({ mediaFiles }) => mediaFiles),
          tx,
        );

        insertedVersions.push(...insertResult);
      }
    });
    return insertedVersions;
  }

  private async upsertProgramMediaStreams(
    streams: NewProgramMediaStream[],
    tx: Kysely<DB> = this.db,
  ) {
    if (streams.length === 0) {
      this.logger.warn('No media streams passed for version');
      return [];
    }

    const byVersionId = groupBy(streams, (stream) => stream.programVersionId);
    const inserted: ProgramMediaStream[] = [];
    for (const batch of chunk(Object.entries(byVersionId), 50)) {
      const [_, streams] = unzip(batch);
      // TODO: Do we need to delete first?
      // await tx.deleteFrom('programMediaStream').where('programVersionId', 'in', versionIds).executeTakeFirstOrThrow();
      inserted.push(
        ...(await tx
          .insertInto('programMediaStream')
          .values(flatten(streams))
          .returningAll()
          .execute()),
      );
    }
    return inserted;
  }

  private async upsertProgramChapters(
    chapters: NewProgramChapter[],
    tx: Kysely<DB> = this.db,
  ) {
    if (chapters.length === 0) {
      return [];
    }

    const byVersionId = groupBy(chapters, (stream) => stream.programVersionId);
    const inserted: ProgramChapter[] = [];
    for (const batch of chunk(Object.entries(byVersionId), 50)) {
      const [_, streams] = unzip(batch);
      // TODO: Do we need to delete first?
      // await tx.deleteFrom('programMediaStream').where('programVersionId', 'in', versionIds).executeTakeFirstOrThrow();
      inserted.push(
        ...(await tx
          .insertInto('programChapter')
          .values(flatten(streams))
          .returningAll()
          .execute()),
      );
    }
    return inserted;
  }

  private async upsertProgramMediaFiles(
    files: NewProgramMediaFile[],
    tx: Kysely<DB> = this.db,
  ) {
    if (files.length === 0) {
      this.logger.warn('No media files passed for version');
      return [];
    }

    const byVersionId = groupBy(files, (stream) => stream.programVersionId);
    const inserted: ProgramMediaFile[] = [];
    for (const batch of chunk(Object.entries(byVersionId), 50)) {
      const [_, files] = unzip(batch);
      // TODO: Do we need to delete first?
      // await tx.deleteFrom('programMediaStream').where('programVersionId', 'in', versionIds).executeTakeFirstOrThrow();
      inserted.push(
        ...(await tx
          .insertInto('programMediaFile')
          .values(flatten(files))
          .returningAll()
          .execute()),
      );
    }
    return inserted;
  }

  async upsertArtwork(artwork: NewArtwork[]) {
    if (artwork.length === 0) {
      return;
    }

    const programArt = groupBy(
      artwork.filter((art) => isNonEmptyString(art.programId)),
      (art) => art.programId,
    );
    const groupArt = groupBy(
      artwork.filter((art) => isNonEmptyString(art.groupingId)),
      (art) => art.groupingId,
    );
    const creditArt = groupBy(
      artwork.filter((art) => isNonEmptyString(art.creditId)),
      (art) => art.creditId,
    );

    return await this.drizzleDB.transaction(async (tx) => {
      for (const batch of chunk(keys(programArt), 50)) {
        await tx.delete(Artwork).where(inArray(Artwork.programId, batch));
      }
      for (const batch of chunk(keys(groupArt), 50)) {
        await tx.delete(Artwork).where(inArray(Artwork.groupingId, batch));
      }
      for (const batch of chunk(keys(creditArt), 50)) {
        await tx.delete(Artwork).where(inArray(Artwork.creditId, batch));
      }
      const inserted: Artwork[] = [];
      for (const batch of chunk(artwork, 50)) {
        const batchResult = await this.drizzleDB
          .insert(Artwork)
          .values(batch)
          .onConflictDoUpdate({
            target: Artwork.uuid,
            set: {
              cachePath: sql`excluded.cache_path`,
              groupingId: sql`excluded.grouping_id`,
              programId: sql`excluded.program_id`,
              updatedAt: sql`excluded.updated_at`,
              sourcePath: sql`excluded.source_path`,
            },
          })
          .returning();
        inserted.push(...batchResult);
      }
      return inserted;
    });
  }

  async upsertProgramGenres(programId: string, genres: NewGenre[]) {
    return this.upsertProgramGenresInternal('program', programId, genres);
  }

  async upsertProgramGroupingGenres(groupingId: string, genres: NewGenre[]) {
    return this.upsertProgramGenresInternal('grouping', groupingId, genres);
  }

  private async upsertProgramGenresInternal(
    entityType: 'program' | 'grouping',
    joinId: string,
    genres: NewGenre[],
  ) {
    if (genres.length === 0) {
      return;
    }

    const incomingByName = groupByUniq(genres, (g) => g.name);
    const existingGenresByName: Dictionary<Genre> = {};
    for (const genreChunk of chunk(genres, 100)) {
      const names = genreChunk.map((g) => g.name);
      const results = await this.drizzleDB
        .select()
        .from(Genre)
        .where(inArray(Genre.name, names));
      for (const result of results) {
        existingGenresByName[result.name] = result;
      }
    }

    const newGenreNames = new Set(
      difference(keys(incomingByName), keys(existingGenresByName)),
    );

    const relations: NewGenreEntity[] = [];
    for (const name of Object.keys(incomingByName)) {
      const genreId = newGenreNames.has(name)
        ? incomingByName[name]!.uuid
        : existingGenresByName[name]!.uuid;
      relations.push({
        genreId,
        programId: entityType === 'program' ? joinId : null,
        groupId: entityType === 'grouping' ? joinId : null,
      });
    }

    return this.drizzleDB.transaction(async (tx) => {
      const col =
        entityType === 'grouping' ? EntityGenre.groupId : EntityGenre.programId;
      await tx.delete(EntityGenre).where(eq(col, joinId));
      if (newGenreNames.size > 0) {
        await tx
          .insert(Genre)
          .values(
            [...newGenreNames.values()].map((name) => incomingByName[name]!),
          )
          .onConflictDoNothing();
      }
      if (relations.length > 0) {
        await tx.insert(EntityGenre).values(relations).onConflictDoNothing();
      }
    });
  }

  async upsertProgramStudios(programId: string, studios: NewStudio[]) {
    return this.upsertProgramStudiosInternal('program', programId, studios);
  }

  async upsertProgramGroupingStudios(groupingId: string, studios: NewStudio[]) {
    return this.upsertProgramStudiosInternal('grouping', groupingId, studios);
  }

  private async upsertProgramStudiosInternal(
    entityType: 'program' | 'grouping',
    joinId: string,
    studios: NewStudio[],
  ) {
    if (studios.length === 0) {
      return;
    }

    const incomingByName = groupByUniq(studios, (g) => g.name);
    const existingStudiosByName: Dictionary<Studio> = {};
    for (const studioChunk of chunk(studios, 100)) {
      const names = studioChunk.map((g) => g.name);
      const results = await this.drizzleDB
        .select()
        .from(Studio)
        .where(inArray(Studio.name, names));
      for (const result of results) {
        existingStudiosByName[result.name] = result;
      }
    }

    const newStudioNames = new Set(
      difference(keys(incomingByName), keys(existingStudiosByName)),
    );

    const relations: NewStudioEntity[] = [];
    for (const name of Object.keys(incomingByName)) {
      const studioId = newStudioNames.has(name)
        ? incomingByName[name]!.uuid
        : existingStudiosByName[name]!.uuid;
      relations.push({
        studioId,
        programId: entityType === 'program' ? joinId : null,
        groupId: entityType === 'grouping' ? joinId : null,
      });
    }

    return this.drizzleDB.transaction(async (tx) => {
      const col =
        entityType === 'grouping'
          ? StudioEntity.groupId
          : StudioEntity.programId;
      await tx.delete(StudioEntity).where(eq(col, joinId));
      if (newStudioNames.size > 0) {
        await tx
          .insert(Studio)
          .values(
            [...newStudioNames.values()].map((name) => incomingByName[name]!),
          )
          .onConflictDoNothing();
      }
      if (relations.length > 0) {
        await tx.insert(StudioEntity).values(relations).onConflictDoNothing();
      }
    });
  }

  private async upsertSubtitles(subtitles: NewProgramSubtitles[]) {
    if (subtitles.length === 0) {
      return;
    }

    const grouped = groupBy(subtitles, (sub) => sub.programId);
    for (const [programId, programSubtitles] of Object.entries(grouped)) {
      const existingSubsForProgram =
        await this.drizzleDB.query.programSubtitles.findMany({
          where: (fields, { eq }) => eq(fields.programId, programId),
        });

      // Embedded subtitles are unique by stream index
      // Sidecar are unique by path.
      const [existingEmbedded, _] = partition(
        existingSubsForProgram,
        (sub) => !isNil(sub.streamIndex),
      );
      const [incomingEmbedded, incomingExternal] = partition(
        programSubtitles,
        (sub) => !isNil(sub.streamIndex),
      );

      const existingIndexes = new Set(
        seq.collect(existingEmbedded, (sub) => sub.streamIndex),
      );
      const incomingIndexes = new Set(
        seq.collect(incomingEmbedded, (sub) => sub.streamIndex),
      );

      const newIndexes = incomingIndexes.difference(existingIndexes);
      const removedIndexes = existingIndexes.difference(newIndexes);
      const updatedIndexes = incomingIndexes.difference(
        newIndexes.union(removedIndexes),
      );

      const inserts = incomingEmbedded.filter((s) =>
        newIndexes.has(s.streamIndex!),
      );
      const removes = existingEmbedded.filter((s) =>
        removedIndexes.has(s.streamIndex!),
      );

      const updates: ProgramSubtitles[] = [];
      for (const updatedIndex of updatedIndexes.values()) {
        const incoming = incomingEmbedded.find(
          (s) => s.streamIndex === updatedIndex,
        );
        const existing = existingEmbedded.find(
          (s) => s.streamIndex === updatedIndex,
        );
        if (!existing || !incoming) {
          continue; // Shouldn't happen
        }

        if (existing.isExtracted) {
          const needsExtraction =
            existing.subtitleType !== incoming.subtitleType ||
            existing.codec !== incoming.subtitleType ||
            existing.language !== incoming.language ||
            existing.forced !== incoming.forced ||
            existing.sdh !== incoming.sdh ||
            existing.default !== incoming.default;
          if (needsExtraction) {
            existing.isExtracted = false;
            existing.path = incoming.path ?? null;
          } else if (
            isNonEmptyString(incoming.path) &&
            existing.path !== incoming.path
          ) {
            existing.isExtracted = false;
            existing.path = incoming.path;
          }
        }

        existing.codec = incoming.codec;
        existing.language = incoming.language;
        existing.subtitleType = incoming.subtitleType;
        existing.updatedAt = incoming.updatedAt;
        if (isDefined(incoming.default)) {
          existing.default = incoming.default;
        }

        if (isDefined(incoming.sdh)) {
          existing.sdh = incoming.sdh;
        }

        if (isDefined(incoming.forced)) {
          existing.forced = incoming.forced;
        }

        updates.push(existing);
      }

      await this.drizzleDB.transaction(async (tx) => {
        if (inserts.length > 0) {
          await tx.insert(ProgramSubtitles).values(inserts);
        }
        if (removes.length > 0) {
          await tx.delete(ProgramSubtitles).where(
            inArray(
              ProgramSubtitles.uuid,
              removes.map((s) => s.uuid),
            ),
          );
        }

        if (updates.length > 0) {
          for (const update of updates) {
            await tx
              .update(ProgramSubtitles)
              .set(update)
              .where(eq(ProgramSubtitles.uuid, update.uuid));
          }
        }

        await tx
          .delete(ProgramSubtitles)
          .where(
            and(
              eq(ProgramSubtitles.subtitleType, 'sidecar'),
              eq(ProgramSubtitles.programId, programId),
            ),
          );

        if (incomingExternal.length > 0) {
          await tx.insert(ProgramSubtitles).values(incomingExternal);
        }
      });
    }
  }

  async upsertCredits(credits: NewCredit[]) {
    if (credits.length === 0) {
      return;
    }

    const programCredits = groupBy(
      credits.filter((credit) => isNonEmptyString(credit.programId)),
      (credit) => credit.programId,
    );
    const groupCredits = groupBy(
      credits.filter((credit) => isNonEmptyString(credit.groupingId)),
      (credit) => credit.groupingId,
    );

    return await this.drizzleDB.transaction(async (tx) => {
      for (const batch of chunk(keys(programCredits), 50)) {
        await tx.delete(Credit).where(inArray(Credit.programId, batch));
      }
      for (const batch of chunk(keys(groupCredits), 50)) {
        await tx.delete(Credit).where(inArray(Credit.groupingId, batch));
      }
      const inserted: Credit[] = [];
      for (const batch of chunk(credits, 50)) {
        const batchResult = await this.drizzleDB
          .insert(Credit)
          .values(batch)
          .returning();
        inserted.push(...batchResult);
      }
      return inserted;
    });
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
              // .onConflict((oc) =>
              //   oc
              //     .columns(['programUuid', 'sourceType', 'externalSourceId'])
              //     .where('externalSourceId', 'is', null)
              //     .doUpdateSet((eb) => ({
              //       updatedAt: eb.ref('excluded.updatedAt'),
              //       externalFilePath: eb.ref('excluded.externalFilePath'),
              //       directFilePath: eb.ref('excluded.directFilePath'),
              //       programUuid: eb.ref('excluded.programUuid'),
              //     })),
              // )
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
              // .onConflict((oc) =>
              //   oc
              //     .columns(['programUuid', 'sourceType', 'externalSourceId'])
              //     .where('externalSourceId', 'is not', null)
              //     .doUpdateSet((eb) => ({
              //       updatedAt: eb.ref('excluded.updatedAt'),
              //       externalFilePath: eb.ref('excluded.externalFilePath'),
              //       directFilePath: eb.ref('excluded.directFilePath'),
              //       programUuid: eb.ref('excluded.programUuid'),
              //     })),
              // )
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

  async getProgramsForMediaSource(
    mediaSourceId: MediaSourceId,
    type?: ProgramType,
  ) {
    return this.db
      .selectFrom('mediaSource')
      .where('mediaSource.uuid', '=', mediaSourceId)
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('program')
            .select(AllProgramFields)
            .$if(isDefined(type), (eb) => eb.where('program.type', '=', type!))
            .whereRef('mediaSource.uuid', '=', 'program.mediaSourceId'),
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

  async getProgramInfoForMediaSource(
    mediaSourceId: MediaSourceId,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ) {
    const results = await this.drizzleDB.query.program.findMany({
      where: (fields, { eq, and, isNotNull }) => {
        const parentField = match([type, parentFilter?.[0]])
          .with(['episode', 'show'], () => fields.tvShowUuid)
          .with(['episode', 'season'], () => fields.seasonUuid)
          .with(['track', 'album'], () => fields.albumUuid)
          .with(['track', 'artist'], () => fields.artistUuid)
          .otherwise(() => null);

        return and(
          eq(fields.mediaSourceId, mediaSourceId),
          eq(fields.type, type),
          isNotNull(fields.canonicalId),
          parentField && parentFilter
            ? eq(parentField, parentFilter[1])
            : undefined,
        );
      },
    });

    const grouped: Dictionary<ProgramCanonicalIdLookupResult> = {};
    for (const result of results) {
      if (!result.canonicalId || !result.libraryId) {
        continue;
      }
      grouped[result.externalKey] = {
        canonicalId: result.canonicalId,
        externalKey: result.externalKey,
        libraryId: result.libraryId,
        uuid: result.uuid,
      };
    }

    return grouped;
  }

  async getProgramInfoForMediaSourceLibrary(
    mediaSourceLibraryId: string,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ) {
    const grouped: Dictionary<ProgramCanonicalIdLookupResult> = {};
    for await (const result of this.getProgramInfoForMediaSourceLibraryAsync(
      mediaSourceLibraryId,
      type,
      parentFilter,
    )) {
      grouped[result.externalKey] = {
        canonicalId: result.canonicalId,
        externalKey: result.externalKey,
        libraryId: result.libraryId,
        uuid: result.uuid,
      };
    }

    return grouped;
  }

  async *getProgramInfoForMediaSourceLibraryAsync(
    mediaSourceLibraryId: string,
    type: ProgramType,
    parentFilter?: [ProgramGroupingType, string],
  ): AsyncGenerator<ProgramCanonicalIdLookupResult> {
    let lastId: Maybe<string>;
    for (;;) {
      const page = await this.drizzleDB.query.program.findMany({
        where: (fields, { eq, and, isNotNull, gt }) => {
          const parentField = match([type, parentFilter?.[0]])
            .with(['episode', 'show'], () => fields.tvShowUuid)
            .with(['episode', 'season'], () => fields.seasonUuid)
            .with(['track', 'album'], () => fields.albumUuid)
            .with(['track', 'artist'], () => fields.artistUuid)
            .otherwise(() => null);

          return and(
            eq(fields.libraryId, mediaSourceLibraryId),
            eq(fields.type, type),
            isNotNull(fields.canonicalId),
            parentField && parentFilter
              ? eq(parentField, parentFilter[1])
              : undefined,
            lastId ? gt(fields.uuid, lastId) : undefined,
          );
        },
        orderBy: (fields, ops) => ops.asc(fields.uuid),
        columns: {
          uuid: true,
          canonicalId: true,
          libraryId: true,
          externalKey: true,
        },
        limit: 500,
      });

      if (page.length === 0) {
        return;
      }

      lastId = last(page)?.uuid;
      for (const item of page) {
        yield {
          externalKey: item.externalKey,
          canonicalId: item.canonicalId,
          uuid: item.uuid,
          libraryId: item.libraryId,
        };
      }
    }
  }

  async getExistingProgramGroupingDetails(
    mediaSourceLibraryId: string,
    type: ProgramGroupingType,
    sourceType: StrictExclude<MediaSourceType, 'local'>,
    parentFilter?: string,
  ) {
    const results = await this.drizzleDB.query.programGrouping.findMany({
      where: (fields, { and, eq, isNotNull }) => {
        const parentField = match(type)
          // .returnType<ProgramGroupingType | null>()
          .with('album', () => fields.artistUuid)
          .with('season', () => fields.showUuid)
          .otherwise(() => null);
        return and(
          eq(fields.libraryId, mediaSourceLibraryId),
          eq(fields.type, type),
          isNotNull(fields.canonicalId),
          parentField && parentFilter
            ? eq(parentField, parentFilter)
            : undefined,
        );
      },
      with: {
        externalIds: {
          where: (fields, { eq }) => eq(fields.sourceType, sourceType),
        },
      },
      columns: {
        uuid: true,
        canonicalId: true,
        libraryId: true,
        externalKey: true,
      },
    });

    const grouped: Dictionary<ProgramGroupingCanonicalIdLookupResult> = {};
    for (const result of results) {
      const key = result.externalKey ?? head(result.externalIds)?.externalKey;
      if (!key) {
        continue;
      }

      grouped[key] = {
        canonicalId: result.canonicalId,
        externalKey: key,
        libraryId: result.libraryId!,
        uuid: result.uuid,
      };
    }

    return grouped;
  }

  async upsertProgramGrouping(
    newGroupingAndRelations: NewProgramGroupingWithRelations,
    forceUpdate: boolean = false,
  ): Promise<UpsertResult<ProgramGroupingOrmWithRelations>> {
    let entity: Maybe<ProgramGroupingOrmWithRelations> =
      await this.getProgramGrouping(
        newGroupingAndRelations.programGrouping.uuid,
      );
    let shouldUpdate = forceUpdate;
    let wasInserted = false,
      wasUpdated = false;
    const { programGrouping: dao, externalIds } = newGroupingAndRelations;

    if (!entity && dao.sourceType === 'local') {
      const incomingYear = newGroupingAndRelations.programGrouping.year;
      entity = await this.drizzleDB.query.programGrouping.findFirst({
        where: (fields, { eq, and, isNull }) => {
          const parentClause = match(newGroupingAndRelations.programGrouping)
            .with({ type: 'season', showUuid: P.nonNullable }, (season) =>
              compact([
                eq(fields.showUuid, season.showUuid),
                season.index ? eq(fields.index, season.index) : null,
              ]),
            )
            .with({ type: 'album', artistUuid: P.nonNullable }, (album) => [
              eq(fields.artistUuid, album.artistUuid),
            ])
            .otherwise(() => []);
          return and(
            eq(
              fields.libraryId,
              newGroupingAndRelations.programGrouping.libraryId,
            ),
            eq(fields.title, newGroupingAndRelations.programGrouping.title),
            eq(fields.type, newGroupingAndRelations.programGrouping.type),
            eq(fields.sourceType, 'local'),
            isNil(incomingYear)
              ? isNull(fields.year)
              : eq(fields.year, incomingYear),
            ...parentClause,
          );
        },
        with: {
          externalIds: true,
        },
      });
    } else if (!entity && dao.sourceType !== 'local') {
      entity = await this.getProgramGroupingByExternalId({
        sourceType: dao.sourceType,
        externalKey: dao.externalKey,
        externalSourceId: dao.mediaSourceId,
      });
      if (entity) {
        // let wasUpdated = false;
        const missingAssociation =
          (entity.type === 'season' &&
            isDefined(dao.showUuid) &&
            dao.showUuid !== entity.showUuid) ||
          (entity.type === 'album' &&
            isDefined(dao.artistUuid) &&
            dao.artistUuid !== entity.artistUuid);
        const differentVersion = entity.canonicalId !== dao.canonicalId;
        shouldUpdate ||= differentVersion || missingAssociation;
      }
    }

    if (entity && shouldUpdate) {
      newGroupingAndRelations.programGrouping.uuid = entity.uuid;
      for (const externalId of newGroupingAndRelations.externalIds) {
        externalId.groupUuid = entity.uuid;
      }
      entity = await this.drizzleDB.transaction(async (tx) => {
        const updated = await this.updateProgramGrouping(
          newGroupingAndRelations,
          entity!,
          tx,
        );
        const upsertedExternalIds = await this.updateProgramGroupingExternalIds(
          entity!.externalIds,
          externalIds,
          tx,
        );
        return {
          ...updated,
          externalIds: upsertedExternalIds,
        } satisfies ProgramGroupingOrmWithRelations;
      });

      wasUpdated = true;
    } else if (!entity) {
      entity = await this.drizzleDB.transaction(async (tx) => {
        const grouping = head(
          await tx
            .insert(ProgramGrouping)
            .values(omit(dao, 'externalIds'))
            .returning(),
        )!;
        const insertedExternalIds: ProgramGroupingExternalIdOrm[] = [];
        if (externalIds.length > 0) {
          insertedExternalIds.push(
            ...(await tx
              .insert(ProgramGroupingExternalId)
              .values(
                externalIds.map((eid) =>
                  this.singleOrMultiProgramGroupingExternalIdToDao(eid),
                ),
              )
              .returning()
              .execute()),
          );
        }

        return {
          ...grouping,
          externalIds: insertedExternalIds,
        } satisfies ProgramGroupingOrmWithRelations;
      });

      wasInserted = true;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      newGroupingAndRelations.credits.forEach((credit) => {
        credit.credit.groupingId = entity.uuid;
      });

      newGroupingAndRelations.artwork.forEach((artwork) => {
        artwork.groupingId = entity.uuid;
      });

      await this.upsertCredits(
        newGroupingAndRelations.credits.map(({ credit }) => credit),
      );

      await this.upsertArtwork(
        newGroupingAndRelations.artwork.concat(
          newGroupingAndRelations.credits.flatMap(({ artwork }) => artwork),
        ),
      );

      await this.upsertProgramGroupingGenres(
        entity.uuid,
        newGroupingAndRelations.genres,
      );

      await this.upsertProgramGroupingStudios(
        entity.uuid,
        newGroupingAndRelations.studios,
      );
    }

    return {
      entity,
      wasInserted,
      wasUpdated,
    };
  }

  private singleOrMultiProgramGroupingExternalIdToDao(
    externalId: NewSingleOrMultiProgramGroupingExternalId,
  ): NewProgramGroupingExternalId {
    switch (externalId.type) {
      case 'single':
        return {
          externalKey: externalId.externalKey,
          groupUuid: externalId.groupUuid,
          sourceType: externalId.sourceType,
          uuid: externalId.uuid,
          createdAt: externalId.createdAt,
          externalFilePath: externalId.externalFilePath,
          libraryId: externalId.libraryId,
          updatedAt: externalId.updatedAt,
        };
      case 'multi':
        return {
          externalKey: externalId.externalKey,
          groupUuid: externalId.groupUuid,
          sourceType: externalId.sourceType,
          uuid: externalId.uuid,
          createdAt: externalId.createdAt,
          externalFilePath: externalId.externalFilePath,
          externalSourceId: externalId.externalSourceId,
          libraryId: externalId.libraryId,
          mediaSourceId: externalId.mediaSourceId,
          updatedAt: externalId.updatedAt,
        };
    }
  }

  private async updateProgramGrouping(
    { programGrouping: incoming }: NewProgramGroupingWithRelations,
    existing: ProgramGroupingOrmWithRelations,
    tx: BaseSQLiteDatabase<'sync', RunResult, typeof schema> = this.drizzleDB,
  ): Promise<ProgramGroupingOrm> {
    const update: NewProgramGroupingOrm = {
      ...omit(existing, 'externalIds'),
      index: incoming.index,
      title: incoming.title,
      summary: incoming.summary,
      icon: incoming.icon,
      year: incoming.year,
      // relations
      artistUuid: incoming.artistUuid,
      showUuid: incoming.showUuid,
      canonicalId: incoming.canonicalId,
      mediaSourceId: incoming.mediaSourceId,
      libraryId: incoming.libraryId,
      sourceType: incoming.sourceType,
      externalKey: incoming.externalKey,
      plot: incoming.plot,
      rating: incoming.rating,
      releaseDate: incoming.releaseDate,
      tagline: incoming.tagline,
      updatedAt: incoming.updatedAt,
    };

    return head(
      await tx
        .update(ProgramGrouping)
        .set(update)
        .where(eq(ProgramGrouping.uuid, existing.uuid))
        .limit(1)
        .returning(),
    )!;
  }

  private async updateProgramGroupingExternalIds(
    existingIds: ProgramGroupingExternalId[],
    newIds: NewSingleOrMultiProgramGroupingExternalId[],
    tx: BaseSQLiteDatabase<'sync', RunResult, typeof schema> = this.drizzleDB,
  ): Promise<ProgramGroupingExternalIdOrm[]> {
    devAssert(
      uniq(seq.collect(existingIds, (id) => id.mediaSourceId)).length <= 1,
    );
    devAssert(uniq(existingIds.map((id) => id.libraryId)).length <= 1);
    devAssert(uniq(newIds.map((id) => id.libraryId)).length <= 1);

    const newByUniqueId: Record<
      string,
      NewSingleOrMultiProgramGroupingExternalId
    > = groupByUniq(newIds, (id) => {
      switch (id.type) {
        case 'single':
          return id.sourceType;
        case 'multi':
          return `${id.sourceType}|${id.mediaSourceId}`;
      }
    });
    const newUniqueIds = new Set(keys(newByUniqueId));

    const existingByUniqueId: Record<string, ProgramGroupingExternalId> =
      groupByUniq(existingIds, (id) => {
        if (isValidSingleExternalIdType(id.sourceType)) {
          return id.sourceType;
        } else {
          return `${id.sourceType}|${id.mediaSourceId}`;
        }
      });
    const existingUniqueIds = new Set(keys(existingByUniqueId));

    const deletedUniqueKeys = existingUniqueIds.difference(newUniqueIds);
    const addedUniqueKeys = newUniqueIds.difference(existingUniqueIds);
    const updatedKeys = existingUniqueIds.intersection(newUniqueIds);

    // TODO: This stinks, consider adding a unique ID
    const deletedIds = [...deletedUniqueKeys.values()].map(
      (key) => existingByUniqueId[key]!,
    );
    await Promise.all(
      chunk(deletedIds, 100).map((idChunk) => {
        const clauses = idChunk.map((id) =>
          and(
            id.mediaSourceId
              ? eq(ProgramGroupingExternalId.mediaSourceId, id.mediaSourceId)
              : dbIsNull(ProgramGroupingExternalId.mediaSourceId),
            id.libraryId
              ? eq(ProgramGroupingExternalId.libraryId, id.libraryId)
              : dbIsNull(ProgramGroupingExternalId.libraryId),
            eq(ProgramGroupingExternalId.externalKey, id.externalKey),
            id.externalSourceId
              ? eq(
                  ProgramGroupingExternalId.externalSourceId,
                  id.externalSourceId,
                )
              : dbIsNull(ProgramGroupingExternalId.externalSourceId),
            eq(ProgramGroupingExternalId.sourceType, id.sourceType),
          ),
        );

        return tx
          .delete(ProgramGroupingExternalId)
          .where(or(...clauses))
          .execute();
      }),
    );

    const addedIds = [...addedUniqueKeys.union(updatedKeys).values()].map(
      (key) => newByUniqueId[key]!,
    );

    return await Promise.all(
      chunk(addedIds, 100).map((idChunk) =>
        this.upsertProgramGroupingExternalIdsChunkOrm(idChunk, tx),
      ),
    ).then((_) => _.flat());
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
  ): Promise<ProgramWithRelationsOrm[]> {
    return this.drizzleDB.query.program.findMany({
      where: (fields, { or, eq }) => {
        if (groupTypeHint) {
          switch (groupTypeHint) {
            case 'show':
              return eq(fields.tvShowUuid, groupId);
            case 'season':
              return eq(fields.seasonUuid, groupId);
            case 'artist':
              return eq(fields.artistUuid, groupId);
            case 'album':
              return eq(fields.albumUuid, groupId);
          }
        } else {
          return or(
            eq(fields.albumUuid, groupId),
            eq(fields.artistUuid, groupId),
            eq(fields.tvShowUuid, groupId),
            eq(fields.seasonUuid, groupId),
          );
        }
      },
      with: {
        album:
          isUndefined(groupTypeHint) ||
          groupTypeHint === 'album' ||
          groupTypeHint === 'artist'
            ? true
            : undefined,
        artist:
          isUndefined(groupTypeHint) ||
          groupTypeHint === 'album' ||
          groupTypeHint === 'artist'
            ? true
            : undefined,
        season:
          isUndefined(groupTypeHint) ||
          groupTypeHint === 'show' ||
          groupTypeHint === 'season'
            ? true
            : undefined,
        show:
          isUndefined(groupTypeHint) ||
          groupTypeHint === 'show' ||
          groupTypeHint === 'season'
            ? true
            : undefined,
        externalIds: true,
      },
    });
  }

  async updateProgramsState(
    programIds: string[],
    newState: ProgramState,
  ): Promise<void> {
    if (programIds.length === 0) {
      return;
    }

    for (const idChunk of chunk(programIds, 100)) {
      await this.drizzleDB
        .update(Program)
        .set({
          state: newState,
        })
        .where(inArray(Program.uuid, idChunk))
        .execute();
    }
  }

  async updateGroupingsState(
    groupingIds: string[],
    newState: ProgramState,
  ): Promise<void> {
    if (groupingIds.length === 0) {
      return;
    }

    for (const idChunk of chunk(groupingIds, 100)) {
      await this.drizzleDB
        .update(ProgramGrouping)
        .set({
          state: newState,
        })
        .where(inArray(ProgramGrouping.uuid, idChunk))
        .execute();
    }
  }

  async emptyTrashPrograms() {
    await this.drizzleDB.delete(Program).where(eq(Program.state, 'missing'));
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
          serverId as MediaSourceId, // We know this is true above, types get lost from Object.entries
        );
      }
    }
  }

  private async handleSingleSourceProgramGroupings(
    upsertedPrograms: MarkNonNullable<ProgramDao, 'mediaSourceId'>[],
    programInfos: Record<string, MintedNewProgramInfo>,
    mediaSourceType: ProgramSourceType,
    mediaSourceName: MediaSourceName,
    mediaSourceId: MediaSourceId,
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
          info.apiProgram.subtype === ProgramType.Movie ||
          info.apiProgram.subtype === ProgramType.MusicVideo ||
          info.apiProgram.subtype === ProgramType.OtherVideo
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
        this.drizzleDB.query.programGroupingExternalId.findMany({
          where: (fields, { eq, and, inArray }) =>
            and(
              eq(fields.sourceType, mediaSourceType),
              eq(fields.mediaSourceId, mediaSourceId),
              inArray(fields.externalKey, allGroupingKeys),
            ),
          with: {
            grouping: true,
          },
        }),
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
        matchingPrograms[0]!.programWithHierarchy,
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
          programs[0]!.programWithHierarchy,
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
            programs[0]!.programWithHierarchy,
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
          matchingPrograms[0]!.programWithHierarchy,
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
                          .then(upsertedProgramById[curr]!.tvShowUuid),
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
                          .then(upsertedProgramById[curr]!.seasonUuid),
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
                          .then(upsertedProgramById[curr]!.artistUuid),
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
                          .then(upsertedProgramById[curr]!.albumUuid),
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

  private async upsertProgramGroupingExternalIdsChunkOrm(
    ids: (
      | NewSingleOrMultiProgramGroupingExternalId
      | NewProgramGroupingExternalId
    )[],
    tx: BaseSQLiteDatabase<'sync', RunResult, typeof schema> = this.drizzleDB,
  ): Promise<ProgramGroupingExternalIdOrm[]> {
    if (ids.length === 0) {
      return [];
    }

    const [singles, multiples] = partition(ids, (id) =>
      isValidSingleExternalIdType(id.sourceType),
    );

    const promises: Promise<ProgramGroupingExternalIdOrm[]>[] = [];

    if (singles.length > 0) {
      promises.push(
        tx
          .insert(ProgramGroupingExternalId)
          .values(singles.map(toInsertableProgramGroupingExternalId))
          .onConflictDoUpdate({
            target: [
              ProgramGroupingExternalId.groupUuid,
              ProgramGroupingExternalId.sourceType,
            ],
            targetWhere: sql`media_source_id is null`,
            set: {
              updatedAt: sql`excluded.updated_at`,
              externalFilePath: sql`excluded.external_file_path`,
              groupUuid: sql`excluded.group_uuid`,
              externalKey: sql`excluded.external_key`,
            },
          })
          .returning()
          .execute(),
        // .onConflict((oc) =>
        //   oc
        //     .columns(['groupUuid', 'sourceType'])
        //     .where('mediaSourceId', 'is', null)
        //     .doUpdateSet((eb) => ({
        //       updatedAt: eb.ref('excluded.updatedAt'),
        //       externalFilePath: eb.ref('excluded.externalFilePath'),
        //       groupUuid: eb.ref('excluded.groupUuid'),
        //       externalKey: eb.ref('excluded.externalKey'),
        //     })),
        // )
        // .executeTakeFirstOrThrow(),
      );
    }

    if (multiples.length > 0) {
      promises.push(
        tx
          .insert(ProgramGroupingExternalId)
          .values(multiples.map(toInsertableProgramGroupingExternalId))
          .onConflictDoUpdate({
            target: [
              ProgramGroupingExternalId.groupUuid,
              ProgramGroupingExternalId.sourceType,
              ProgramGroupingExternalId.mediaSourceId,
            ],
            targetWhere: sql`media_source_id is not null`,
            set: {
              updatedAt: sql`excluded.updated_at`,
              externalFilePath: sql`excluded.external_file_path`,
              groupUuid: sql`excluded.group_uuid`,
              externalKey: sql`excluded.external_key`,
            },
          })
          .returning()
          .execute(),
        // .onConflict((oc) =>
        //   oc
        //     .columns(['groupUuid', 'sourceType', 'mediaSourceId'])
        //     .where('mediaSourceId', 'is not', null)
        //     .doUpdateSet((eb) => ({
        //       updatedAt: eb.ref('excluded.updatedAt'),
        //       externalFilePath: eb.ref('excluded.externalFilePath'),
        //       groupUuid: eb.ref('excluded.groupUuid'),
        //       externalKey: eb.ref('excluded.externalKey'),
        //     })),
        // )
        // .executeTakeFirstOrThrow(),
      );
    }

    return (await Promise.all(promises)).flat();
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
                'Error saving external IDs for program %O',
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
        filter(upsertedPrograms, (p) => p.sourceType === 'jellyfin'),
        (program) => {
          try {
            const task = this.saveJellyfinProgramExternalIdsTask(program.uuid);
            JellyfinTaskQueue.add(task).catch((e) => {
              this.logger.error(
                e,
                'Error saving external IDs for program %O',
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
