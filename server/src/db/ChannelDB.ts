import { ChannelQueryBuilder } from '@/db/ChannelQueryBuilder.js';
import { ProgramConverter } from '@/db/converters/ProgramConverter.js';
import {
  ChannelAndLineup,
  ChannelAndRawLineup,
  type IChannelDB,
} from '@/db/interfaces/IChannelDB.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { globalOptions } from '@/globals.js';
import { FileSystemService } from '@/services/FileSystemService.js';
import { CacheImageService } from '@/services/cacheImageService.js';
import { ChannelNotFoundError } from '@/types/errors.js';
import { KEYS } from '@/types/inject.js';
import { typedProperty } from '@/types/path.js';
import { Result } from '@/types/result.js';
import { jsonSchema } from '@/types/schemas.js';
import { Maybe, PagedResult } from '@/types/util.js';
import { Timer } from '@/util/Timer.js';
import { asyncPool } from '@/util/asyncPool.js';
import dayjs from '@/util/dayjs.js';
import { fileExists } from '@/util/fsUtil.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { MutexMap } from '@/util/mutexMap.js';
import { booleanToNumber } from '@/util/sqliteUtil.js';
import { seq } from '@tunarr/shared/util';
import {
  ChannelProgram,
  ChannelProgramming,
  CondensedChannelProgram,
  CondensedChannelProgramming,
  ContentProgram,
  SaveableChannel,
  Watermark,
} from '@tunarr/types';
import { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import { ContentProgramType } from '@tunarr/types/schemas';
import { and, asc, count, countDistinct, eq, isNotNull } from 'drizzle-orm';
import { inject, injectable, interfaces } from 'inversify';
import { Kysely } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import {
  chunk,
  drop,
  entries,
  filter,
  flatten,
  forEach,
  groupBy,
  head,
  isEmpty,
  isNil,
  isNull,
  isNumber,
  isString,
  isUndefined,
  map,
  mapValues,
  nth,
  omit,
  omitBy,
  partition,
  reject,
  sum,
  sumBy,
  take,
  uniq,
  uniqBy,
} from 'lodash-es';
import { Low } from 'lowdb';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { MarkRequired } from 'ts-essentials';
import { match } from 'ts-pattern';
import { v4 } from 'uuid';
import { MaterializeLineupCommand } from '../commands/MaterializeLineupCommand.ts';
import { IWorkerPool } from '../interfaces/IWorkerPool.ts';
import {
  createManyRelationAgg,
  mapRawJsonRelationResult,
} from '../util/drizzleUtil.ts';
import {
  asyncMapToRecord,
  groupByFunc,
  groupByUniqProp,
  isDefined,
  isNonEmptyString,
  mapReduceAsyncSeq,
  programExternalIdString,
  run,
} from '../util/index.ts';
import {
  ContentItem,
  CurrentLineupSchemaVersion,
  isContentItem,
  isOfflineItem,
  isRedirectItem,
  Lineup,
  LineupItem,
  LineupSchema,
  PendingProgram,
} from './derived_types/Lineup.ts';
import {
  PageParams,
  UpdateChannelLineupRequest,
} from './interfaces/IChannelDB.ts';
import { SchemaBackedDbAdapter } from './json/SchemaBackedJsonDBAdapter.ts';
import { calculateStartTimeOffsets } from './lineupUtil.ts';
import {
  AllProgramGroupingFields,
  withFallbackPrograms,
  withPrograms,
  withTrackAlbum,
  withTrackArtist,
  withTvSeason,
  withTvShow,
} from './programQueryHelpers.ts';
import { Artwork } from './schema/Artwork.ts';
import {
  Channel,
  ChannelOrm,
  ChannelUpdate,
  NewChannel,
} from './schema/Channel.ts';
import { NewChannelFillerShow } from './schema/ChannelFillerShow.ts';
import {
  ChannelPrograms,
  NewChannelProgram,
} from './schema/ChannelPrograms.ts';
import { Program, ProgramType } from './schema/Program.ts';
import {
  ProgramGrouping,
  ProgramGroupingType,
} from './schema/ProgramGrouping.ts';
import { ProgramGroupingExternalIdOrm } from './schema/ProgramGroupingExternalId.ts';
import {
  ChannelSubtitlePreferences,
  NewChannelSubtitlePreference,
} from './schema/SubtitlePreferences.ts';
import { DB } from './schema/db.ts';
import {
  ChannelOrmWithPrograms,
  ChannelOrmWithRelations,
  ChannelWithPrograms,
  ChannelWithRelations,
  MusicAlbumOrm,
  MusicArtistOrm,
  MusicArtistWithExternalIds,
  ProgramGroupingOrmWithRelations,
  ProgramWithRelationsOrm,
  TvSeasonOrm,
  TvShowOrm,
} from './schema/derivedTypes.js';
import { DrizzleDBAccess } from './schema/index.ts';

// We use this to chunk super huge channel / program relation updates because
// of the way that mikro-orm generates these (e.g. "delete from XYZ where () or () ...").
// When updating a _huge_ channel, we hit internal sqlite limits, so we must chunk these
// operations ourselves.
const SqliteMaxDepthLimit = 1000;

type ProgramRelationOperation = { operation: 'add' | 'remove'; id: string };

function sanitizeChannelWatermark(
  watermark: Maybe<Watermark>,
): Maybe<Watermark> {
  if (isUndefined(watermark)) {
    return;
  }

  const validFadePoints = filter(
    watermark.fadeConfig,
    (conf) => conf.periodMins > 0,
  );

  return {
    ...watermark,
    fadeConfig: isEmpty(validFadePoints) ? undefined : validFadePoints,
  };
}

function updateRequestToChannel(updateReq: SaveableChannel): ChannelUpdate {
  const sanitizedWatermark = sanitizeChannelWatermark(updateReq.watermark);

  return {
    number: updateReq.number,
    watermark: sanitizedWatermark
      ? JSON.stringify(sanitizedWatermark)
      : undefined,
    icon: JSON.stringify(updateReq.icon),
    guideMinimumDuration: updateReq.guideMinimumDuration,
    groupTitle: updateReq.groupTitle,
    disableFillerOverlay: booleanToNumber(updateReq.disableFillerOverlay),
    startTime: updateReq.startTime,
    offline: JSON.stringify(updateReq.offline),
    name: updateReq.name,
    duration: updateReq.duration,
    stealth: booleanToNumber(updateReq.stealth),
    fillerRepeatCooldown: updateReq.fillerRepeatCooldown,
    guideFlexTitle: updateReq.guideFlexTitle,
    transcodeConfigId: updateReq.transcodeConfigId,
    streamMode: updateReq.streamMode,
    subtitlesEnabled: booleanToNumber(updateReq.subtitlesEnabled),
  } satisfies ChannelUpdate;
}

function createRequestToChannel(saveReq: SaveableChannel): NewChannel {
  const now = +dayjs();

  return {
    uuid: v4(),
    createdAt: now,
    updatedAt: now,
    number: saveReq.number,
    watermark: saveReq.watermark ? JSON.stringify(saveReq.watermark) : null,
    icon: JSON.stringify(saveReq.icon),
    guideMinimumDuration: saveReq.guideMinimumDuration,
    groupTitle: saveReq.groupTitle,
    disableFillerOverlay: saveReq.disableFillerOverlay ? 1 : 0,
    startTime: saveReq.startTime,
    offline: JSON.stringify(saveReq.offline),
    name: saveReq.name,
    duration: saveReq.duration,
    stealth: saveReq.stealth ? 1 : 0,
    fillerRepeatCooldown: saveReq.fillerRepeatCooldown,
    guideFlexTitle: saveReq.guideFlexTitle,
    streamMode: saveReq.streamMode,
    transcodeConfigId: saveReq.transcodeConfigId,
    subtitlesEnabled: booleanToNumber(saveReq.subtitlesEnabled),
  } satisfies NewChannel;
}

// Let's see if this works... in so we can have many ChannelDb objects flying around.
const fileDbCache: Record<string | number, Low<Lineup>> = {};
const fileDbLocks = new MutexMap();

@injectable()
export class ChannelDB implements IChannelDB {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  private timer = new Timer(this.logger, 'trace');

  constructor(
    @inject(ProgramConverter) private programConverter: ProgramConverter,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(CacheImageService) private cacheImageService: CacheImageService,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.WorkerPoolFactory)
    private workerPoolProvider: interfaces.AutoFactory<IWorkerPool>,
    @inject(FileSystemService) private fileSystemService: FileSystemService,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
    @inject(MaterializeLineupCommand)
    private materializeLineupCommand: MaterializeLineupCommand,
  ) {}

  async channelExists(channelId: string) {
    const channel = await this.db
      .selectFrom('channel')
      .where('channel.uuid', '=', channelId)
      .select('uuid')
      .executeTakeFirst();
    return !isNil(channel);
  }

  getChannelOrm(id: string | number): Promise<Maybe<ChannelOrm>> {
    return this.drizzleDB.query.channels.findFirst({
      where: (channel, { eq }) => {
        return isString(id) ? eq(channel.uuid, id) : eq(channel.number, id);
      },
    });
  }

  getChannel(id: string | number): Promise<Maybe<ChannelWithRelations>>;
  getChannel(
    id: string | number,
    includeFiller: true,
  ): Promise<Maybe<MarkRequired<ChannelWithRelations, 'fillerShows'>>>;
  async getChannel(
    id: string | number,
    includeFiller: boolean = false,
  ): Promise<Maybe<ChannelWithRelations>> {
    // return this.drizzleDB.query.channels.findFirst({
    //   where: (fields, { eq }) => {
    //     if (isString(id)) {
    //       return eq(fields.uuid, id);
    //     } else {
    //       return eq(fields.number, id);
    //     }
    //   },
    //   with: {
    //     channelFillerShow: includeFiller
    //       ? {
    //           with: {
    //             filler: true,
    //           },
    //         }
    //       : undefined,
    //   },
    // });
    return this.db
      .selectFrom('channel')
      .$if(isString(id), (eb) => eb.where('channel.uuid', '=', id as string))
      .$if(isNumber(id), (eb) => eb.where('channel.number', '=', id as number))
      .$if(includeFiller, (eb) =>
        eb.select((qb) =>
          jsonArrayFrom(
            qb
              .selectFrom('channelFillerShow')
              .whereRef('channel.uuid', '=', 'channelFillerShow.channelUuid')
              .select([
                'channelFillerShow.channelUuid',
                'channelFillerShow.fillerShowUuid',
                'channelFillerShow.cooldown',
                'channelFillerShow.weight',
              ]),
          ).as('fillerShows'),
        ),
      )
      .selectAll()
      .executeTakeFirst();
  }

  getChannelBuilder(id: string | number) {
    return ChannelQueryBuilder.createForIdOrNumber(this.db, id);
  }

  async getChannelAndPrograms(
    uuid: string,
  ): Promise<Maybe<MarkRequired<ChannelOrmWithRelations, 'programs'>>> {
    const channelsAndPrograms = await this.drizzleDB.query.channels.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, uuid),
      with: {
        channelPrograms: {
          with: {
            program: {
              with: {
                show: true,
                season: true,
                artist: true,
                album: true,
                externalIds: true,
              },
            },
          },
        },
      },
      orderBy: (fields, { asc }) => asc(fields.number),
    });

    if (channelsAndPrograms) {
      return {
        ...channelsAndPrograms,
        programs: channelsAndPrograms.channelPrograms.map(
          ({ program }) => program,
        ),
      } satisfies MarkRequired<ChannelOrmWithRelations, 'programs'>;
    }

    return;
  }

  async getChannelAndProgramsOld(
    uuid: string,
  ): Promise<ChannelWithPrograms | undefined> {
    return this.db
      .selectFrom('channel')
      .selectAll(['channel'])
      .where('channel.uuid', '=', uuid)
      .leftJoin(
        'channelPrograms',
        'channel.uuid',
        'channelPrograms.channelUuid',
      )
      .select((eb) =>
        withPrograms(eb, {
          joins: {
            customShows: true,
            tvShow: [
              'programGrouping.uuid',
              'programGrouping.title',
              'programGrouping.summary',
              'programGrouping.type',
            ],
            tvSeason: [
              'programGrouping.uuid',
              'programGrouping.title',
              'programGrouping.summary',
              'programGrouping.type',
            ],
            trackArtist: [
              'programGrouping.uuid',
              'programGrouping.title',
              'programGrouping.summary',
              'programGrouping.type',
            ],
            trackAlbum: [
              'programGrouping.uuid',
              'programGrouping.title',
              'programGrouping.summary',
              'programGrouping.type',
            ],
          },
        }),
      )
      .groupBy('channel.uuid')
      .orderBy('channel.number asc')
      .executeTakeFirst();
  }

  async getChannelTvShows(
    id: string,
    pageParams?: PageParams,
  ): Promise<PagedResult<TvShowOrm>> {
    const groups = await this.drizzleDB
      .select({
        programGrouping: ProgramGrouping,
        artwork: createManyRelationAgg(
          this.drizzleDB
            .select()
            .from(Artwork)
            .where(eq(ProgramGrouping.uuid, Artwork.groupingId))
            .as('artwork'),
          'artwork',
        ),
      })
      .from(ChannelPrograms)
      .where(
        and(
          eq(ChannelPrograms.channelUuid, id),
          eq(Program.type, ProgramType.Episode),
          isNotNull(Program.tvShowUuid),
          eq(ProgramGrouping.type, ProgramGroupingType.Show),
        ),
      )
      .groupBy(Program.tvShowUuid)
      .orderBy(asc(ProgramGrouping.uuid))
      .innerJoin(Program, eq(Program.uuid, ChannelPrograms.programUuid))
      .innerJoin(ProgramGrouping, eq(ProgramGrouping.uuid, Program.tvShowUuid))
      .offset(pageParams?.offset ?? 0)
      .limit(pageParams?.limit ?? 1_000_000);

    const countPromise = this.drizzleDB
      .select({
        count: countDistinct(ProgramGrouping.uuid),
      })
      .from(ChannelPrograms)
      .where(
        and(
          eq(ChannelPrograms.channelUuid, id),
          eq(Program.type, ProgramType.Episode),
          isNotNull(Program.tvShowUuid),
          eq(ProgramGrouping.type, ProgramGroupingType.Show),
        ),
      )
      .innerJoin(Program, eq(Program.uuid, ChannelPrograms.programUuid))
      .innerJoin(ProgramGrouping, eq(ProgramGrouping.uuid, Program.tvShowUuid));

    // Populate external ids
    const externalIdQueries: Promise<ProgramGroupingExternalIdOrm[]>[] = [];
    const seasonQueries: Promise<ProgramGroupingOrmWithRelations[]>[] = [];
    for (const groupChunk of chunk(groups, 100)) {
      const ids = groupChunk.map(({ programGrouping }) => programGrouping.uuid);
      externalIdQueries.push(
        this.drizzleDB.query.programGroupingExternalId.findMany({
          where: (fields, { inArray }) => inArray(fields.groupUuid, ids),
        }),
      );
      seasonQueries.push(
        this.drizzleDB.query.programGrouping.findMany({
          where: (fields, { eq, and, inArray }) =>
            and(
              eq(fields.type, ProgramGroupingType.Season),
              inArray(fields.showUuid, ids),
            ),
          with: {
            externalIds: true,
          },
        }),
      );
    }

    const [externalIdResults, seasonResults] = await Promise.all([
      Promise.all(externalIdQueries).then(flatten),
      Promise.all(seasonQueries).then(flatten),
    ]);

    const externalIdsByGroupId = groupBy(
      externalIdResults,
      (id) => id.groupUuid,
    );
    const seasonByGroupId = groupBy(seasonResults, (season) => season.showUuid);

    const shows: TvShowOrm[] = [];
    for (const { programGrouping, artwork } of groups) {
      if (programGrouping.type === 'show') {
        const seasons =
          seasonByGroupId[programGrouping.uuid]?.filter(
            (group): group is TvSeasonOrm => group.type === 'season',
          ) ?? [];
        shows.push({
          ...programGrouping,
          type: 'show',
          externalIds: externalIdsByGroupId[programGrouping.uuid] ?? [],
          seasons,
          artwork: mapRawJsonRelationResult(artwork, Artwork),
        });
      }
    }

    return {
      total: sum((await countPromise).map(({ count }) => count)),
      results: shows,
    };
  }

  async getChannelMusicArtists(
    id: string,
    pageParams?: PageParams,
  ): Promise<PagedResult<MusicArtistWithExternalIds>> {
    const groups = await this.drizzleDB
      .select({
        programGrouping: ProgramGrouping,
      })
      .from(ChannelPrograms)
      .where(
        and(
          eq(ChannelPrograms.channelUuid, id),
          eq(Program.type, ProgramType.Track),
          isNotNull(Program.artistUuid),
          eq(ProgramGrouping.type, ProgramGroupingType.Artist),
        ),
      )
      .groupBy(Program.artistUuid)
      .orderBy(asc(ProgramGrouping.uuid))
      .innerJoin(Program, eq(Program.uuid, ChannelPrograms.programUuid))
      .innerJoin(ProgramGrouping, eq(ProgramGrouping.uuid, Program.artistUuid))
      .offset(pageParams?.offset ?? 0)
      .limit(pageParams?.limit ?? 1_000_000);

    const countPromise = this.drizzleDB
      .select({
        count: count(),
      })
      .from(ChannelPrograms)
      .where(
        and(
          eq(ChannelPrograms.channelUuid, id),
          eq(Program.type, ProgramType.Episode),
          isNotNull(Program.tvShowUuid),
          eq(ProgramGrouping.type, ProgramGroupingType.Show),
        ),
      )
      .innerJoin(Program, eq(Program.uuid, ChannelPrograms.programUuid))
      .innerJoin(ProgramGrouping, eq(ProgramGrouping.uuid, Program.tvShowUuid));

    // Populate external ids
    const externalIdQueries: Promise<ProgramGroupingExternalIdOrm[]>[] = [];
    const seasonQueries: Promise<ProgramGroupingOrmWithRelations[]>[] = [];
    for (const groupChunk of chunk(groups, 100)) {
      const ids = groupChunk.map(({ programGrouping }) => programGrouping.uuid);
      externalIdQueries.push(
        this.drizzleDB.query.programGroupingExternalId.findMany({
          where: (fields, { inArray }) => inArray(fields.groupUuid, ids),
        }),
      );
      seasonQueries.push(
        this.drizzleDB.query.programGrouping.findMany({
          where: (fields, { eq, and, inArray }) =>
            and(
              eq(fields.type, ProgramGroupingType.Season),
              inArray(fields.showUuid, ids),
            ),
          with: {
            externalIds: true,
          },
        }),
      );
    }

    const [externalIdResults, seasonResults] = await Promise.all([
      Promise.all(externalIdQueries).then(flatten),
      Promise.all(seasonQueries).then(flatten),
    ]);

    const externalIdsByGroupId = groupBy(
      externalIdResults,
      (id) => id.groupUuid,
    );
    const seasonByGroupId = groupBy(seasonResults, (season) => season.showUuid);

    const artists: MusicArtistOrm[] = [];
    for (const { programGrouping } of groups) {
      if (programGrouping.type === 'artist') {
        const albums =
          seasonByGroupId[programGrouping.uuid]?.filter(
            (group): group is MusicAlbumOrm => group.type === 'album',
          ) ?? [];
        artists.push({
          ...programGrouping,
          type: 'artist',
          externalIds: externalIdsByGroupId[programGrouping.uuid] ?? [],
          albums,
        });
      }
    }

    return {
      total: sum((await countPromise).map(({ count }) => count)),
      results: artists,
    };
  }

  async getChannelPrograms(
    id: string,
    pageParams?: PageParams,
    typeFilter?: ContentProgramType,
  ): Promise<PagedResult<ProgramWithRelationsOrm>> {
    let query = this.drizzleDB
      .select({ programId: ChannelPrograms.programUuid, count: count() })
      .from(ChannelPrograms)
      .where(
        and(
          eq(ChannelPrograms.channelUuid, id),
          typeFilter ? eq(Program.type, typeFilter) : undefined,
        ),
      )
      .innerJoin(Program, eq(ChannelPrograms.programUuid, Program.uuid))
      .orderBy(asc(ChannelPrograms.programUuid))
      .$dynamic();

    const countResult = head(await query.execute())?.count ?? 0;

    if (pageParams) {
      query = query.offset(pageParams.offset).limit(pageParams.limit);
    }

    const results = await query.execute();

    const materialized: ProgramWithRelationsOrm[] = [];
    for (const idChunk of chunk(
      results.map(({ programId }) => programId),
      100,
    )) {
      materialized.push(
        ...(await this.drizzleDB.query.program.findMany({
          where: (fields, { inArray }) => inArray(fields.uuid, idChunk),
          with: {
            externalIds: true,
            album: true,
            artist: true,
            season: true,
            show: true,
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
          orderBy: (fields, { asc }) => asc(fields.uuid),
        })),
      );
    }

    return { results: materialized, total: countResult };
  }

  getChannelProgramExternalIds(uuid: string) {
    return this.db
      .selectFrom('channelPrograms')
      .where('channelUuid', '=', uuid)
      .innerJoin(
        'programExternalId',
        'channelPrograms.programUuid',
        'programExternalId.programUuid',
      )
      .selectAll('programExternalId')
      .execute();
  }

  async getChannelFallbackPrograms(uuid: string) {
    const result = await this.db
      .selectFrom('channelFallback')
      .where('channelFallback.channelUuid', '=', uuid)
      .select(withFallbackPrograms)
      .groupBy('channelFallback.channelUuid')
      .executeTakeFirst();
    return result?.programs ?? [];
  }

  async saveChannel(createReq: SaveableChannel) {
    const existing = await this.getChannel(createReq.number);
    if (!isNil(existing)) {
      throw new Error(
        `Channel with number ${createReq.number} already exists: ${existing.name}`,
      );
    }

    const channel = await this.db.transaction().execute(async (tx) => {
      const channel = await tx
        .insertInto('channel')
        .values(createRequestToChannel(createReq))
        .returningAll()
        .executeTakeFirst();

      if (!channel) {
        throw new Error('Error while saving new channel.');
      }

      if (!isEmpty(createReq.fillerCollections)) {
        await tx
          .insertInto('channelFillerShow')
          .values(
            map(
              createReq.fillerCollections,
              (fc) =>
                ({
                  channelUuid: channel.uuid,
                  cooldown: fc.cooldownSeconds,
                  fillerShowUuid: fc.id,
                  weight: fc.weight,
                }) satisfies NewChannelFillerShow,
            ),
          )
          .execute();
      }

      const subtitlePreferences = createReq.subtitlePreferences?.map(
        (pref) =>
          ({
            channelId: channel.uuid,
            uuid: v4(),
            languageCode: pref.langugeCode,
            allowExternal: booleanToNumber(pref.allowExternal),
            allowImageBased: booleanToNumber(pref.allowImageBased),
            filterType: pref.filter,
            priority: pref.priority,
          }) satisfies NewChannelSubtitlePreference,
      );
      if (subtitlePreferences) {
        await tx
          .insertInto('channelSubtitlePreferences')
          .values(subtitlePreferences)
          .executeTakeFirstOrThrow();
      }

      return channel;
    });

    await this.createLineup(channel.uuid);

    if (isDefined(createReq.onDemand) && createReq.onDemand.enabled) {
      const db = await this.getFileDb(channel.uuid);
      await db.update((lineup) => {
        lineup.onDemandConfig = {
          state: 'paused',
          cursor: 0,
        };
      });
    }

    // TODO: convert everything to use kysely
    return {
      channel,
      lineup: (await this.getFileDb(channel.uuid)).data,
    };
  }

  async updateChannel(id: string, updateReq: SaveableChannel) {
    const channel = await this.getChannel(id);

    if (isNil(channel)) {
      throw new ChannelNotFoundError(id);
    }

    const update = updateRequestToChannel(updateReq);

    if (
      isNonEmptyString(updateReq.watermark?.url) &&
      URL.canParse(updateReq.watermark.url)
    ) {
      const url = updateReq.watermark?.url;
      const parsed = new URL(url);
      if (!parsed.hostname.includes('localhost')) {
        // Attempt to download the watermark and cache it.
        const cacheWatermarkResult = await Result.attemptAsync(() =>
          this.cacheImageService.getOrDownloadImageUrl(url),
        );
        if (cacheWatermarkResult.isFailure()) {
          this.logger.warn(
            cacheWatermarkResult.error,
            'Was unable to cache watermark URL at %s',
            url,
          );
        }
      }
    }

    await this.db.transaction().execute(async (tx) => {
      await tx
        .updateTable('channel')
        .where('channel.uuid', '=', id)
        // TODO: Blocked on https://github.com/oven-sh/bun/issues/16909
        // .limit(1)
        .set(update)
        .executeTakeFirstOrThrow();

      if (!isEmpty(updateReq.fillerCollections)) {
        const channelFillerShows = map(
          updateReq.fillerCollections,
          (filler) =>
            ({
              cooldown: filler.cooldownSeconds,
              channelUuid: channel.uuid,
              fillerShowUuid: filler.id,
              weight: filler.weight,
            }) satisfies NewChannelFillerShow,
        );

        await tx
          .deleteFrom('channelFillerShow')
          .where('channelFillerShow.channelUuid', '=', channel.uuid)
          .executeTakeFirstOrThrow();
        await tx
          .insertInto('channelFillerShow')
          .values(channelFillerShows)
          .executeTakeFirstOrThrow();
      }
      const subtitlePreferences = updateReq.subtitlePreferences?.map(
        (pref) =>
          ({
            channelId: channel.uuid,
            uuid: v4(),
            languageCode: pref.langugeCode,
            allowExternal: booleanToNumber(pref.allowExternal),
            allowImageBased: booleanToNumber(pref.allowImageBased),
            filterType: pref.filter,
            priority: pref.priority,
          }) satisfies NewChannelSubtitlePreference,
      );
      await tx
        .deleteFrom('channelSubtitlePreferences')
        .where('channelSubtitlePreferences.channelId', '=', channel.uuid)
        .executeTakeFirstOrThrow();
      if (subtitlePreferences) {
        await tx
          .insertInto('channelSubtitlePreferences')
          .values(subtitlePreferences)
          .executeTakeFirstOrThrow();
      }
    });

    if (isDefined(updateReq.onDemand)) {
      const db = await this.getFileDb(id);
      await db.update((lineup) => {
        if (updateReq.onDemand?.enabled ?? false) {
          lineup.onDemandConfig = {
            state: 'paused',
            cursor: 0,
          };
        } else {
          delete lineup['onDemandConfig'];
        }
      });
    }

    return {
      channel: (await this.getChannel(id, true))!,
      lineup: await this.loadLineup(id),
    };
  }

  private updateChannelDuration(id: string, newDur: number) {
    return this.drizzleDB
      .update(Channel)
      .set({
        duration: newDur,
      })
      .where(eq(Channel.uuid, id))
      .limit(1)
      .execute();
  }

  async copyChannel(id: string): Promise<ChannelAndLineup<Channel>> {
    const channel = await this.getChannel(id);
    if (!channel) {
      throw new Error(`Cannot copy channel: channel ID: ${id} not found`);
    }

    const lineup = await this.loadLineup(id);

    const newChannelId = v4();
    const now = +dayjs();
    // have to get all channel relations...
    const newChannel = await this.db.transaction().execute(async (tx) => {
      const { number: maxId } = await tx
        .selectFrom('channel')
        .select('number')
        .orderBy('number desc')
        .limit(1)
        .executeTakeFirstOrThrow();
      const newChannel = await tx
        .insertInto('channel')
        .values({
          ...channel,
          uuid: newChannelId,
          name: `${channel.name} - Copy`,
          number: maxId + 1,
          icon: JSON.stringify(channel.icon),
          offline: JSON.stringify(channel.offline),
          watermark: JSON.stringify(channel.watermark),
          createdAt: now,
          updatedAt: now,
          transcoding: null, // Deprecated
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Copy filler shows
      await tx
        .insertInto('channelFillerShow')
        .columns(['channelUuid', 'cooldown', 'fillerShowUuid', 'weight'])
        .expression((eb) =>
          eb
            .selectFrom('channelFillerShow')
            .select([
              eb.val(newChannelId).as('channelUuid'),
              'channelFillerShow.cooldown',
              'channelFillerShow.fillerShowUuid',
              'channelFillerShow.weight',
            ])
            .where('channelFillerShow.channelUuid', '=', channel.uuid),
        )
        .executeTakeFirstOrThrow();

      // Copy programs
      await tx
        .insertInto('channelPrograms')
        .columns(['channelUuid', 'programUuid'])
        .expression((eb) =>
          eb
            .selectFrom('channelPrograms')
            .select([
              eb.val(newChannelId).as('channelUuid'),
              'channelPrograms.programUuid',
            ])
            .where('channelPrograms.channelUuid', '=', channel.uuid),
        )
        .executeTakeFirstOrThrow();

      // Copy custom shows
      await tx
        .insertInto('channelCustomShows')
        .columns(['channelUuid', 'customShowUuid'])
        .expression((eb) =>
          eb
            .selectFrom('channelCustomShows')
            .select([
              eb.val(newChannelId).as('channelUuid'),
              'channelCustomShows.customShowUuid',
            ])
            .where('channelCustomShows.channelUuid', '=', channel.uuid),
        )
        .executeTakeFirstOrThrow();

      return newChannel;
    });

    const newLineup = await this.saveLineup(newChannel.uuid, lineup);

    return {
      channel: newChannel,
      lineup: newLineup,
    };
  }

  async updateChannelStartTime(id: string, newTime: number): Promise<void> {
    return this.db
      .updateTable('channel')
      .where('channel.uuid', '=', id)
      .set('startTime', newTime)
      .executeTakeFirst()
      .then(() => {});
  }

  async syncChannelDuration(id: string) {
    const channelAndLineup = await this.loadChannelAndLineup(id);
    if (!channelAndLineup) {
      return false;
    }
    const { channel, lineup } = channelAndLineup;
    const lineupDuration = sum(map(lineup.items, (item) => item.durationMs));
    if (lineupDuration !== channel.duration) {
      await this.db
        .updateTable('channel')
        .where('channel.uuid', '=', id)
        .set('duration', lineupDuration)
        .executeTakeFirst();
      return true;
    }
    return false;
  }

  async deleteChannel(
    channelId: string,
    blockOnLineupUpdates: boolean = false,
  ) {
    let marked = false;
    try {
      await this.markLineupFileForDeletion(channelId);
      marked = true;

      await this.db.transaction().execute(async (tx) => {
        await tx
          .deleteFrom('channelSubtitlePreferences')
          .where('channelId', '=', channelId)
          .executeTakeFirstOrThrow();
        await tx
          .deleteFrom('channel')
          .where('uuid', '=', channelId)
          .limit(1)
          .executeTakeFirstOrThrow();
      });

      // Best effort remove references to this channel
      const removeRefs = () =>
        this.removeRedirectReferences(channelId).catch((e) => {
          this.logger.error(e, 'Error while removing redirect references');
        });

      if (blockOnLineupUpdates) {
        await removeRefs();
      } else {
        setTimeout(() => {
          removeRefs().catch((e) => {
            this.logger.error(
              e,
              'Error while removing channel references in background.',
            );
          });
        });
      }
    } catch (e) {
      // If we failed at the DB level for some reason,
      // try to restore the lineup file.
      if (marked) {
        await this.restoreLineupFile(channelId);
      }

      this.logger.error(
        e,
        'Error while attempting to delete channel %s',
        channelId,
      );

      throw e;
    }
  }

  getAllChannels(): Promise<ChannelOrm[]> {
    return this.drizzleDB.query.channels
      .findMany({
        orderBy: (fields, { asc }) => asc(fields.number),
      })
      .execute();
    // return this.db
    //   .selectFrom('channel')
    //   .selectAll()
    //   .orderBy('channel.number asc')
    //   .$if(isDefined(pageParams) && pageParams.offset >= 0, (qb) =>
    //     qb
    //       .offset(pageParams!.offset)
    //       .$if(pageParams!.limit >= 0, (qb) => qb.limit(pageParams!.limit)),
    //   )
    //   .execute();
  }

  async getAllChannelsAndPrograms(): Promise<ChannelOrmWithPrograms[]> {
    return await this.drizzleDB.query.channels
      .findMany({
        with: {
          channelPrograms: {
            with: {
              program: {
                with: {
                  album: true,
                  artist: true,
                  show: true,
                  season: true,
                  externalIds: true,
                },
              },
            },
          },
        },
        orderBy: (fields, { asc }) => asc(fields.number),
      })
      .then((result) => {
        return result.map((channel) => {
          const withoutJoinTable = omit(channel, 'channelPrograms');
          return {
            ...withoutJoinTable,
            programs: channel.channelPrograms.map((cp) => cp.program),
          } satisfies ChannelOrmWithPrograms;
        });
      });
    // return await this.db
    //   .selectFrom('channel')
    //   .selectAll(['channel'])
    //   .leftJoin(
    //     'channelPrograms',
    //     'channelPrograms.channelUuid',
    //     'channel.uuid',
    //   )
    //   .select((eb) => [
    //     withPrograms(eb, {
    //       joins: {
    //         trackAlbum: MinimalProgramGroupingFields,
    //         trackArtist: MinimalProgramGroupingFields,
    //         tvShow: MinimalProgramGroupingFields,
    //         tvSeason: MinimalProgramGroupingFields,
    //       },
    //     }),
    //   ])
    //   .groupBy('channel.uuid')
    //   .orderBy('channel.number asc')
    //   .execute();
  }

  async updateLineup(id: string, req: UpdateChannelProgrammingRequest) {
    const channel = await this.db
      .selectFrom('channel')
      .selectAll()
      .where('channel.uuid', '=', id)
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('channelPrograms')
            .whereRef('channelPrograms.channelUuid', '=', 'channel.uuid')
            .select(['channelPrograms.programUuid as uuid']),
        ).as('programs'),
      )
      .groupBy('channel.uuid')
      .executeTakeFirst();

    const lineup = await this.loadLineup(id);

    if (isNil(channel)) {
      return null;
    }

    const updateChannel = async (
      lineup: readonly LineupItem[],
      startTime?: number,
    ) => {
      return await this.db.transaction().execute(async (tx) => {
        await tx
          .updateTable('channel')
          .where('channel.uuid', '=', id)
          .set({
            startTime,
            duration: sumBy(lineup, typedProperty('durationMs')),
          })
          .limit(1)
          .executeTakeFirstOrThrow();

        const allNewIds = new Set([
          ...uniq(map(filter(lineup, isContentItem), (p) => p.id)),
        ]);

        const existingIds = new Set([
          ...channel.programs.map((program) => program.uuid),
        ]);

        // Create our remove operations
        const removeOperations: ProgramRelationOperation[] = map(
          reject([...existingIds], (existingId) => allNewIds.has(existingId)),
          (removalId) => ({
            operation: 'remove' as const,
            id: removalId,
          }),
        );

        // Create addition operations
        const addOperations: ProgramRelationOperation[] = map(
          reject([...allNewIds], (newId) => existingIds.has(newId)),
          (addId) => ({
            operation: 'add' as const,
            id: addId,
          }),
        );

        // TODO: See if this is still necessary w/ kysely building
        // This is busted....wtf
        for (const ops of chunk(
          [...addOperations, ...removeOperations],
          SqliteMaxDepthLimit / 2,
        )) {
          const [adds, removes] = partition(
            ops,
            ({ operation }) => operation === 'add',
          );

          if (!isEmpty(removes)) {
            await tx
              .deleteFrom('channelPrograms')
              .where('channelPrograms.programUuid', 'in', map(removes, 'id'))
              .where('channelPrograms.channelUuid', '=', id)
              .execute();
          }

          if (!isEmpty(adds)) {
            await tx
              .insertInto('channelPrograms')
              .values(
                map(
                  adds,
                  ({ id }) =>
                    ({
                      channelUuid: channel.uuid,
                      programUuid: id,
                    }) satisfies NewChannelProgram,
                ),
              )
              .execute();
          }
        }
        return channel;
      });
    };

    const createNewLineup = async (
      programs: ChannelProgram[],
      lineup: ChannelProgram[] = programs,
    ) => {
      const upsertedPrograms =
        await this.programDB.upsertContentPrograms(programs);
      const dbIdByUniqueId = groupByFunc(
        upsertedPrograms,
        programExternalIdString,
        (p) => p.uuid,
      );
      return map(lineup, channelProgramToLineupItemFunc(dbIdByUniqueId));
    };

    const upsertPrograms = async (programs: ChannelProgram[]) => {
      const upsertedPrograms =
        await this.programDB.upsertContentPrograms(programs);
      return groupByFunc(
        upsertedPrograms,
        programExternalIdString,
        (p) => p.uuid,
      );
    };

    if (req.type === 'manual') {
      const newLineupItems = await run(async () => {
        const newItems = await this.timer.timeAsync(
          'createNewLineup',
          async () => {
            const programs = req.programs;
            const dbIdByUniqueId = await upsertPrograms(programs);
            const convertFunc = channelProgramToLineupItemFunc(dbIdByUniqueId);
            return seq.collect(req.lineup, (lineupItem) => {
              switch (lineupItem.type) {
                // Lookup the item in the program lookup list
                case 'index': {
                  const program = nth(programs, lineupItem.index);
                  if (program) {
                    return convertFunc({
                      ...program,
                      duration: lineupItem.duration ?? program.duration,
                    });
                  }
                  return null;
                }
                case 'persisted': {
                  return {
                    type: 'content',
                    id: lineupItem.programId,
                    customShowId: lineupItem.customShowId,
                    durationMs: lineupItem.duration,
                  } satisfies ContentItem;
                }
              }
            });
          },
        );
        if (req.append) {
          const existingLineup = await this.loadLineup(channel.uuid);
          return [...existingLineup.items, ...newItems];
        } else {
          return newItems;
        }
      });

      const updatedChannel = await this.timer.timeAsync('updateChannel', () =>
        updateChannel(newLineupItems),
      );

      await this.timer.timeAsync('saveLineup', () =>
        this.saveLineup(id, {
          items: newLineupItems,
          onDemandConfig: isDefined(lineup.onDemandConfig)
            ? {
                ...lineup.onDemandConfig,
                cursor: 0,
              }
            : undefined,
        }),
      );

      return {
        channel: updatedChannel,
        newLineup: newLineupItems,
      };
    } else if (req.type === 'time' || req.type === 'random') {
      let programs: ChannelProgram[];
      let startTime: number;
      if (req.type === 'time') {
        const { result } = await this.workerPoolProvider().queueTask({
          type: 'time-slots',
          request: {
            type: 'programs',
            programIds: seq.collect(req.programs, (p) => {
              switch (p.type) {
                case 'custom':
                case 'content':
                case 'filler':
                  return p.id;
                case 'redirect':
                case 'flex':
                  return;
              }
            }),
            schedule: req.schedule,
            seed: req.seed,
          },
        });

        startTime = result.startTime;
        programs = MaterializeLineupCommand.expandLineup(
          result.lineup,
          await this.materializeLineupCommand.execute({
            lineup: result.lineup,
          }),
        );
      } else {
        const { result } = await this.workerPoolProvider().queueTask({
          type: 'schedule-slots',
          request: {
            type: 'programs',
            programIds: seq.collect(req.programs, (p) => {
              switch (p.type) {
                case 'custom':
                case 'content':
                case 'filler':
                  return p.id;
                case 'redirect':
                case 'flex':
                  return;
              }
            }),
            schedule: req.schedule,
            seed: req.seed,
          },
        });
        startTime = result.startTime;
        programs = MaterializeLineupCommand.expandLineup(
          result.lineup,
          await this.materializeLineupCommand.execute({
            lineup: result.lineup,
          }),
        );
      }

      const newLineup = await createNewLineup(programs);

      const updatedChannel = await updateChannel(newLineup, startTime);
      await this.saveLineup(id, {
        items: newLineup,
        schedule: req.schedule,
      });

      return {
        channel: updatedChannel,
        newLineup,
      };
    }

    return null;
  }

  /**
   * Like {@link ChannelDB#saveLineup} but only allows updating config-based information in the lineup
   */
  async updateLineupConfig<
    Key extends keyof Omit<
      Lineup,
      'items' | 'startTimeOffsets' | 'pendingPrograms'
    >,
  >(id: string, key: Key, conf: Lineup[Key]) {
    const lineupDb = await this.getFileDb(id);
    return await lineupDb.update((existing) => {
      existing[key] = conf;
    });
  }

  async setChannelPrograms(
    channel: Channel,
    lineup: readonly LineupItem[],
  ): Promise<Channel | null>;
  async setChannelPrograms(
    channel: string | Channel,
    lineup: readonly LineupItem[],
    startTime?: number,
  ): Promise<Channel | null> {
    const loadedChannel = await run(async () => {
      if (isString(channel)) {
        return await this.getChannel(channel);
      } else {
        return channel;
      }
    });

    if (isNil(loadedChannel)) {
      return null;
    }

    const allIds = uniq(map(filter(lineup, isContentItem), 'id'));

    return await this.db.transaction().execute(async (tx) => {
      // await tx
      if (!isUndefined(startTime)) {
        loadedChannel.startTime = startTime;
      }
      loadedChannel.duration = sumBy(lineup, typedProperty('durationMs'));
      const updatedChannel = await tx
        .updateTable('channel')
        .where('channel.uuid', '=', loadedChannel.uuid)
        .set('duration', sumBy(lineup, typedProperty('durationMs')))
        .$if(isDefined(startTime), (_) => _.set('startTime', startTime!))
        .returningAll()
        .executeTakeFirst();

      for (const idChunk of chunk(allIds, 500)) {
        await tx
          .deleteFrom('channelPrograms')
          .where('channelUuid', '=', loadedChannel.uuid)
          .where('programUuid', 'not in', idChunk)
          .execute();
      }

      for (const idChunk of chunk(allIds, 500)) {
        await tx
          .insertInto('channelPrograms')
          .values(
            map(idChunk, (id) => ({
              programUuid: id,
              channelUuid: loadedChannel.uuid,
            })),
          )
          .onConflict((oc) => oc.doNothing())
          .executeTakeFirst();
      }

      return updatedChannel ?? null;
    });
  }

  async addPendingPrograms(
    channelId: string,
    pendingPrograms: PendingProgram[],
  ) {
    if (pendingPrograms.length === 0) {
      return;
    }

    const db = await this.getFileDb(channelId);
    return await db.update((data) => {
      if (isUndefined(data.pendingPrograms)) {
        data.pendingPrograms = [...pendingPrograms];
      } else {
        data.pendingPrograms.push(...pendingPrograms);
      }
    });
  }

  async loadAllLineups() {
    return mapReduceAsyncSeq(
      await this.getAllChannels(),
      async (channel) => {
        return {
          channel,
          lineup: await this.loadLineup(channel.uuid),
        };
      },
      (prev, { channel, lineup }) => {
        prev[channel.uuid] = { channel, lineup };
        return prev;
      },
      {} as Record<string, { channel: ChannelOrm; lineup: Lineup }>,
    );
  }

  async loadAllLineupConfigs(forceRead: boolean = false) {
    return asyncMapToRecord(
      await this.getAllChannels(),
      async (channel) => ({
        channel,
        lineup: await this.loadLineup(channel.uuid, forceRead),
      }),
      ({ channel }) => channel.uuid,
    );
  }

  async loadAllRawLineups(): Promise<Record<string, ChannelAndRawLineup>> {
    return asyncMapToRecord(
      await this.getAllChannels(),
      async (channel) => ({
        channel,
        lineup: jsonSchema.parse(
          JSON.parse(
            (
              await fs.readFile(
                this.fileSystemService.getChannelLineupPath(channel.uuid),
              )
            ).toString('utf-8'),
          ),
        ),
      }),
      ({ channel }) => channel.uuid,
    );
  }

  async loadChannelAndLineup(
    channelId: string,
  ): Promise<ChannelAndLineup<Channel> | null> {
    const channel = await this.getChannel(channelId);
    if (isNil(channel)) {
      return null;
    }

    return {
      channel,
      lineup: await this.loadLineup(channelId),
    };
  }

  async loadChannelWithProgamsAndLineup(
    channelId: string,
  ): Promise<{ channel: ChannelOrmWithPrograms; lineup: Lineup } | null> {
    const channel = await this.getChannelAndPrograms(channelId);
    if (isNil(channel)) {
      return null;
    }

    return {
      channel,
      lineup: await this.loadLineup(channelId),
    };
  }

  async loadLineup(channelId: string, forceRead: boolean = false) {
    const db = await this.getFileDb(channelId, forceRead);
    return db.data;
  }

  async loadAndMaterializeLineup(
    channelId: string,
    offset: number = 0,
    limit: number = -1,
  ): Promise<ChannelProgramming | null> {
    const channel = await this.getChannelAndProgramsOld(channelId);
    if (isNil(channel)) {
      return null;
    }

    const lineup = await this.loadLineup(channelId);
    const len = lineup.items.length;
    const cleanOffset = offset < 0 ? 0 : offset;
    const cleanLimit = limit < 0 ? len : limit;

    const { lineup: apiLineup, offsets } = await this.buildApiLineup(
      channel,
      take(drop(lineup.items, cleanOffset), cleanLimit),
    );

    return {
      icon: channel.icon,
      name: channel.name,
      number: channel.number,
      totalPrograms: len,
      programs: apiLineup,
      startTimeOffsets: offsets,
    };
  }

  async loadCondensedLineup(
    channelId: string,
    offset: number = 0,
    limit: number = -1,
  ): Promise<CondensedChannelProgramming | null> {
    const lineup = await this.timer.timeAsync('loadLineup', () =>
      this.loadLineup(channelId),
    );

    const len = lineup.items.length;
    const cleanOffset = offset < 0 ? 0 : offset;
    const cleanLimit = limit < 0 ? len : limit;
    const pagedLineup = take(drop(lineup.items, cleanOffset), cleanLimit);

    const channel = await this.timer.timeAsync('select channel', () =>
      this.getChannel(channelId),
    );

    if (isNil(channel)) {
      return null;
    }

    const contentItems = filter(pagedLineup, isContentItem);

    const directPrograms = await this.timer.timeAsync('direct', () =>
      this.db
        .selectFrom('channelPrograms')
        .where('channelUuid', '=', channelId)
        .innerJoin('program', 'channelPrograms.programUuid', 'program.uuid')
        .selectAll('program')
        .select((eb) => [
          withTvShow(eb, AllProgramGroupingFields, true),
          withTvSeason(eb, AllProgramGroupingFields, true),
          withTrackAlbum(eb, AllProgramGroupingFields, true),
          withTrackArtist(eb, AllProgramGroupingFields, true),
        ])
        .execute(),
    );

    const externalIds = await this.timer.timeAsync('eids', () =>
      this.getChannelProgramExternalIds(channelId),
    );

    const externalIdsByProgramId = groupBy(
      externalIds,
      (eid) => eid.programUuid,
    );

    const programsById = groupByUniqProp(directPrograms, 'uuid');

    const materializedPrograms = this.timer.timeSync('program convert', () => {
      const ret: Record<string, ContentProgram> = {};
      forEach(uniqBy(contentItems, 'id'), (item) => {
        const program = programsById[item.id];
        if (!program) {
          return;
        }

        const converted = this.programConverter.programDaoToContentProgram(
          program,
          externalIdsByProgramId[program.uuid] ?? [],
        );

        if (converted) {
          ret[converted.id] = converted;
        }
      });

      return ret;
    });

    const { lineup: condensedLineup, offsets } = await this.timer.timeAsync(
      'build condensed lineup',
      () =>
        this.buildCondensedLineup(
          channel,
          new Set([...seq.collect(directPrograms, (p) => p.uuid)]),
          pagedLineup,
        ),
    );

    let apiOffsets: number[];
    if (lineup.startTimeOffsets) {
      apiOffsets = take(drop(lineup.startTimeOffsets, cleanOffset), cleanLimit);
    } else {
      const scale = sumBy(
        take(lineup.items, cleanOffset - 1),
        (i) => i.durationMs,
      );
      apiOffsets = map(offsets, (o) => o + scale);
    }

    return {
      icon: channel.icon,
      name: channel.name,
      number: channel.number,
      totalPrograms: len,
      programs: omitBy(materializedPrograms, isNil),
      lineup: condensedLineup,
      startTimeOffsets: apiOffsets,
      schedule: lineup.schedule,
    };
  }

  /**
   * Updates the lineup config for a channel
   * Some values accept 'null', which will clear their value
   * Other values can be left undefined, which will leave them untouched
   */
  async saveLineup(
    channelId: string,
    newLineup: UpdateChannelLineupRequest,
  ): Promise<Lineup> {
    const db = await this.getFileDb(channelId);
    await db.update((data) => {
      if (isDefined(newLineup.items)) {
        data.items = newLineup.items;
        data.startTimeOffsets =
          newLineup.startTimeOffsets ??
          calculateStartTimeOffsets(newLineup.items);
      }

      if (isDefined(newLineup.schedule)) {
        if (isNull(newLineup.schedule)) {
          data.schedule = undefined;
        } else {
          data.schedule = newLineup.schedule;
        }
      }

      if (isDefined(newLineup.pendingPrograms)) {
        data.pendingPrograms =
          newLineup.pendingPrograms === null
            ? undefined
            : newLineup.pendingPrograms;
      }

      if (isDefined(newLineup.onDemandConfig)) {
        data.onDemandConfig =
          newLineup.onDemandConfig === null
            ? undefined
            : newLineup.onDemandConfig;
      }

      data.version = newLineup?.version ?? data.version;

      data.lastUpdated = dayjs().valueOf();
    });

    if (isDefined(newLineup.items)) {
      const newDur = sum(newLineup.items.map((item) => item.durationMs));
      await this.updateChannelDuration(channelId, newDur);
    }
    return db.data;
  }

  async removeProgramsFromLineup(channelId: string, programIds: string[]) {
    if (programIds.length === 0) {
      return;
    }

    const idSet = new Set(programIds);
    const lineup = await this.loadLineup(channelId);
    lineup.items = map(lineup.items, (item) => {
      if (isContentItem(item) && idSet.has(item.id)) {
        return {
          type: 'offline',
          durationMs: item.durationMs,
        };
      } else {
        return item;
      }
    });
    await this.saveLineup(channelId, lineup);
  }

  async removeProgramsFromAllLineups(programIds: string[]): Promise<void> {
    if (isEmpty(programIds)) {
      return;
    }

    const lineups = await this.loadAllLineups();

    const programsToRemove = new Set(programIds);
    for (const [channelId, { lineup }] of Object.entries(lineups)) {
      const newLineupItems: LineupItem[] = lineup.items.map((item) => {
        switch (item.type) {
          case 'content': {
            if (programsToRemove.has(item.id)) {
              return {
                type: 'offline',
                durationMs: item.durationMs,
              };
            }
            return item;
          }
          case 'offline':
          case 'redirect':
            return item;
        }
      });

      await this.saveLineup(channelId, {
        ...lineup,
        items: newLineupItems,
      });

      const duration = sum(newLineupItems.map((item) => item.durationMs));

      await this.db
        .updateTable('channel')
        .set({
          duration,
        })
        .where('uuid', '=', channelId)
        .limit(1)
        .executeTakeFirst();
    }
  }

  async getChannelSubtitlePreferences(
    id: string,
  ): Promise<ChannelSubtitlePreferences[]> {
    return this.db
      .selectFrom('channelSubtitlePreferences')
      .selectAll()
      .where('channelId', '=', id)
      .orderBy('priority asc')
      .execute();
  }

  findChannelsForProgramId(programId: string) {
    return this.drizzleDB.query.channelPrograms
      .findMany({
        where: (cp, { eq }) => eq(cp.programUuid, programId),
        with: {
          channel: true,
        },
      })
      .then((result) => result.map((row) => row.channel));
  }

  private async createLineup(channelId: string) {
    const db = await this.getFileDb(channelId);
    await db.write();
  }

  private async getFileDb(channelId: string, forceRead: boolean = false) {
    return await fileDbLocks.getOrCreateLock(channelId).then((lock) =>
      lock.runExclusive(async () => {
        const existing = fileDbCache[channelId];
        if (isDefined(existing)) {
          if (forceRead) {
            await existing.read();
          }
          return existing;
        }

        const defaultValue = {
          items: [],
          startTimeOffsets: [],
          lastUpdated: dayjs().valueOf(),
          version: CurrentLineupSchemaVersion,
        };
        const db = new Low<Lineup>(
          new SchemaBackedDbAdapter(
            LineupSchema,
            this.fileSystemService.getChannelLineupPath(channelId),
            defaultValue,
          ),
          defaultValue,
        );
        await db.read();
        fileDbCache[channelId] = db;
        return db;
      }),
    );
  }

  private async restoreLineupFile(channelId: string) {
    return this.markLineupFileForDeletion(channelId, false);
  }

  private async markLineupFileForDeletion(
    channelId: string,
    isDelete: boolean = true,
  ) {
    const path = join(
      globalOptions().databaseDirectory,
      `channel-lineups/${channelId}.json${isDelete ? '' : '.bak'}`,
    );
    try {
      if (await fileExists(path)) {
        const newPath = isDelete ? `${path}.bak` : path.replace('.bak', '');
        await fs.rename(path, newPath);
      }
      if (isDelete) {
        delete fileDbCache[channelId];
      } else {
        // Reload the file into the DB cache
        await this.getFileDb(channelId);
      }
    } catch (e) {
      this.logger.error(
        e,
        `Error while trying to ${
          isDelete ? 'mark' : 'unmark'
        } Channel %s lineup json for deletion`,
        channelId,
      );
    }
  }

  private async buildApiLineup(
    channel: ChannelWithPrograms,
    lineup: LineupItem[],
  ): Promise<{ lineup: ChannelProgram[]; offsets: number[] }> {
    const allChannels = await this.db
      .selectFrom('channel')
      .select(['channel.uuid', 'channel.number', 'channel.name'])
      .execute();
    let lastOffset = 0;
    const offsets: number[] = [];

    const programsById = groupByUniqProp(channel.programs, 'uuid');

    const programs: ChannelProgram[] = [];

    for (const item of lineup) {
      const apiItem = match(item)
        .with({ type: 'content' }, (contentItem) => {
          const fullProgram = programsById[contentItem.id];
          if (!fullProgram) {
            return null;
          }
          return this.programConverter.programDaoToContentProgram(
            fullProgram,
            fullProgram.externalIds ?? [],
          );
        })
        .otherwise((item) =>
          this.programConverter.lineupItemToChannelProgram(
            channel,
            item,
            allChannels,
          ),
        );

      if (apiItem) {
        offsets.push(lastOffset);
        lastOffset += item.durationMs;
        programs.push(apiItem);
      }
    }

    return { lineup: programs, offsets };
  }

  private async buildCondensedLineup(
    channel: Channel,
    dbProgramIds: Set<string>,
    lineup: LineupItem[],
  ): Promise<{ lineup: CondensedChannelProgram[]; offsets: number[] }> {
    let lastOffset = 0;
    const offsets: number[] = [];

    const customShowLineupItemsByShowId = mapValues(
      groupBy(
        filter(
          lineup,
          (l): l is MarkRequired<ContentItem, 'customShowId'> =>
            l.type === 'content' && isNonEmptyString(l.customShowId),
        ),
        (i) => i.customShowId,
      ),
      (items) => uniqBy(items, 'id'),
    );

    const customShowIndexes: Record<string, Record<string, number>> = {};
    for (const [customShowId, items] of entries(
      customShowLineupItemsByShowId,
    )) {
      customShowIndexes[customShowId] = {};

      const results = await this.db
        .selectFrom('customShowContent')
        .select(['customShowContent.contentUuid', 'customShowContent.index'])
        .where('customShowContent.contentUuid', 'in', map(items, 'id'))
        .where('customShowContent.customShowUuid', '=', customShowId)
        .groupBy('customShowContent.contentUuid')
        .execute();

      const byItemId: Record<string, number> = {};
      for (const { contentUuid, index } of results) {
        byItemId[contentUuid] = index;
      }

      customShowIndexes[customShowId] = byItemId;
    }

    const allChannels = await this.db
      .selectFrom('channel')
      .select(['uuid', 'name', 'number'])
      .execute();

    const channelsById = groupByUniqProp(allChannels, 'uuid');

    const programs = seq.collect(lineup, (item) => {
      let p: CondensedChannelProgram | null = null;
      if (isOfflineItem(item)) {
        p = this.programConverter.offlineLineupItemToProgram(channel, item);
      } else if (isRedirectItem(item)) {
        if (channelsById[item.channel]) {
          p = this.programConverter.redirectLineupItemToProgram(
            item,
            channelsById[item.channel]!,
          );
        } else {
          this.logger.warn(
            'Found dangling redirect program. Bad ID = %s',
            item.channel,
          );
          p = {
            persisted: true,
            type: 'flex',
            duration: item.durationMs,
          };
        }
      } else if (item.customShowId) {
        p = {
          persisted: true,
          type: 'custom',
          customShowId: item.customShowId,
          duration: item.durationMs,
          index: customShowIndexes[item.customShowId]![item.id] ?? -1,
          id: item.id,
        };
      } else if (item.fillerListId) {
        p = {
          persisted: true,
          type: 'filler',
          fillerListId: item.fillerListId,
          fillerType: item.fillerType,
          id: item.id,
          duration: item.durationMs,
        };
      } else {
        if (dbProgramIds.has(item.id)) {
          p = {
            persisted: true,
            type: 'content',
            id: item.id,
            duration: item.durationMs,
          };
        }
      }

      if (p) {
        offsets.push(lastOffset);
        lastOffset += item.durationMs;
      }

      return p;
    });
    return { lineup: programs, offsets };
  }

  private async removeRedirectReferences(toChannel: string) {
    const allChannels = await this.getAllChannels();

    const ops = asyncPool(
      reject(allChannels, { uuid: toChannel }),
      async (channel) => {
        const lineup = await this.loadLineup(channel.uuid);
        let changed = false;
        const newLineup: LineupItem[] = map(lineup.items, (item) => {
          if (item.type === 'redirect' && item.channel === toChannel) {
            changed = true;
            return {
              type: 'offline',
              durationMs: item.durationMs,
            };
          } else {
            return item;
          }
        });
        if (changed) {
          return this.saveLineup(channel.uuid, { ...lineup, items: newLineup });
        }
        return;
      },
      { concurrency: 2 },
    );

    for await (const updateResult of ops) {
      if (updateResult.isFailure()) {
        this.logger.error(
          'Error removing redirect references for channel %s from channel %s',
          toChannel,
          updateResult.error.input.uuid,
        );
      }
    }
  }
}

function channelProgramToLineupItemFunc(
  dbIdByUniqueId: Record<string, string>,
): (p: ChannelProgram) => LineupItem {
  return (p) =>
    match(p)
      .returnType<LineupItem>()
      .with({ type: 'content' }, (program) => ({
        type: 'content',
        id: program.persisted ? program.id! : dbIdByUniqueId[program.uniqueId]!,
        durationMs: program.duration,
      }))
      .with({ type: 'custom' }, (program) => ({
        type: 'content', // Custom program
        durationMs: program.duration,
        id: program.id,
        customShowId: program.customShowId,
      }))
      .with({ type: 'filler' }, (program) => ({
        type: 'content',
        durationMs: program.duration,
        id: program.id,
        fillerListId: program.fillerListId,
        fillerType: program.fillerType,
      }))
      .with({ type: 'redirect' }, (program) => ({
        type: 'redirect',
        channel: program.channel,
        durationMs: program.duration,
      }))
      .with({ type: 'flex' }, (program) => ({
        type: 'offline',
        durationMs: program.duration,
      }))
      .exhaustive();
}
