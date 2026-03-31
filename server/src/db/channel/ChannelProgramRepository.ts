import { KEYS } from '@/types/inject.js';
import type { Maybe, PagedResult } from '@/types/util.js';
import type { ContentProgramType } from '@tunarr/types/schemas';
import { and, asc, count, countDistinct, eq, isNotNull } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import { chunk, flatten, groupBy, omit, sum, uniq } from 'lodash-es';
import type { MarkRequired } from 'ts-essentials';
import {
  createManyRelationAgg,
  mapRawJsonRelationResult,
} from '../../util/drizzleUtil.ts';
import type { PageParams } from '../interfaces/IChannelDB.ts';
import { withFallbackPrograms, withPrograms } from '../programQueryHelpers.ts';
import { Artwork } from '../schema/Artwork.ts';
import { ChannelOrm } from '../schema/Channel.ts';
import { ChannelPrograms } from '../schema/ChannelPrograms.ts';
import type { ProgramDao } from '../schema/Program.ts';
import { Program, ProgramType } from '../schema/Program.ts';
import type { ProgramExternalId } from '../schema/ProgramExternalId.ts';
import {
  ProgramGrouping,
  ProgramGroupingType,
} from '../schema/ProgramGrouping.ts';
import { ProgramGroupingExternalIdOrm } from '../schema/ProgramGroupingExternalId.ts';
import type { DB } from '../schema/db.ts';
import type {
  ChannelOrmWithPrograms,
  ChannelOrmWithRelations,
  ChannelWithPrograms,
  MusicAlbumOrm,
  MusicArtistOrm,
  MusicArtistWithExternalIds,
  ProgramGroupingOrmWithRelations,
  ProgramWithRelationsOrm,
  TvSeasonOrm,
  TvShowOrm,
} from '../schema/derivedTypes.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';

@injectable()
export class ChannelProgramRepository {
  constructor(
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
  ) {}

  async getChannelAndPrograms(
    uuid: string,
    typeFilter?: ContentProgramType,
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
      const programs = typeFilter
        ? channelsAndPrograms.channelPrograms
            .map(({ program }) => program)
            .filter((p) => p.type === typeFilter)
        : channelsAndPrograms.channelPrograms.map(({ program }) => program);
      return {
        ...channelsAndPrograms,
        programs,
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

    const externalIdQueries: Promise<ProgramGroupingExternalIdOrm[]>[] = [];
    const albumQueries: Promise<ProgramGroupingOrmWithRelations[]>[] = [];
    for (const groupChunk of chunk(groups, 100)) {
      const ids = groupChunk.map(({ programGrouping }) => programGrouping.uuid);
      externalIdQueries.push(
        this.drizzleDB.query.programGroupingExternalId.findMany({
          where: (fields, { inArray }) => inArray(fields.groupUuid, ids),
        }),
      );
      albumQueries.push(
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

    const [externalIdResults, albumResults] = await Promise.all([
      Promise.all(externalIdQueries).then(flatten),
      Promise.all(albumQueries).then(flatten),
    ]);

    const externalIdsByGroupId = groupBy(
      externalIdResults,
      (id) => id.groupUuid,
    );
    const seasonByGroupId = groupBy(albumResults, (season) => season.showUuid);

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
      .$dynamic();

    const countResult = (await query.execute())[0]?.count ?? 0;

    if (pageParams) {
      query = query
        .groupBy(Program.uuid)
        .orderBy(asc(Program.title))
        .offset(pageParams.offset)
        .limit(pageParams.limit);
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

  getChannelProgramExternalIds(uuid: string): Promise<ProgramExternalId[]> {
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

  async getChannelFallbackPrograms(uuid: string): Promise<ProgramDao[]> {
    const result = await this.db
      .selectFrom('channelFallback')
      .where('channelFallback.channelUuid', '=', uuid)
      .select(withFallbackPrograms)
      .groupBy('channelFallback.channelUuid')
      .executeTakeFirst();
    return result?.programs ?? [];
  }

  async replaceChannelPrograms(
    channelId: string,
    programIds: string[],
  ): Promise<void> {
    const uniqueIds = uniq(programIds);
    await this.drizzleDB.transaction(async (tx) => {
      await tx
        .delete(ChannelPrograms)
        .where(eq(ChannelPrograms.channelUuid, channelId));
      for (const c of chunk(uniqueIds, 250)) {
        await tx
          .insert(ChannelPrograms)
          .values(c.map((id) => ({ channelUuid: channelId, programUuid: id })));
      }
    });
  }

  findChannelsForProgramId(programId: string): Promise<ChannelOrm[]> {
    return this.drizzleDB.query.channelPrograms
      .findMany({
        where: (cp, { eq }) => eq(cp.programUuid, programId),
        with: {
          channel: true,
        },
      })
      .then((result) => result.map((row) => row.channel));
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
  }
}
