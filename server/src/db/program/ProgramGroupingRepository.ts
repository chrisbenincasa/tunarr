import type {
  ProgramGroupingExternalIdLookup,
  WithChannelIdFilter,
} from '@/db/interfaces/IProgramDB.js';
import { KEYS } from '@/types/inject.js';
import type { Maybe, PagedResult } from '@/types/util.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import { untag } from '@tunarr/types';
import {
  and,
  asc,
  count,
  countDistinct,
  eq,
} from 'drizzle-orm';
import type { SelectedFields, SQLiteSelectBuilder } from 'drizzle-orm/sqlite-core';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import { chunk, isEmpty, isUndefined, orderBy, sum, uniq } from 'lodash-es';
import { Artwork } from '../schema/Artwork.ts';
import { ChannelPrograms } from '../schema/ChannelPrograms.ts';
import { Program, ProgramType } from '../schema/Program.ts';
import {
  ProgramGrouping,
  ProgramGroupingType,
  type ProgramGroupingTypes,
} from '../schema/ProgramGrouping.ts';
import { ProgramExternalId } from '../schema/ProgramExternalId.ts';
import { ProgramGroupingExternalId } from '../schema/ProgramGroupingExternalId.ts';
import type { MediaSourceId, RemoteSourceType } from '../schema/base.ts';
import type { DB } from '../schema/db.ts';
import type {
  MusicAlbumOrm,
  ProgramGroupingOrmWithRelations,
  ProgramGroupingWithExternalIds,
  ProgramWithRelationsOrm,
  TvSeasonOrm,
} from '../schema/derivedTypes.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import type { MarkRequired } from 'ts-essentials';
import {
  createManyRelationAgg,
  mapRawJsonRelationResult,
} from '../../util/drizzleUtil.ts';
import { selectProgramsBuilder } from '../programQueryHelpers.ts';
import type { PageParams } from '../interfaces/IChannelDB.ts';
import type {
  ProgramGroupingChildCounts,
} from '../interfaces/IProgramDB.ts';

@injectable()
export class ProgramGroupingRepository {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
  ) {}

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
            tags: {
              with: {
                tag: true,
              },
            },
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

  async getProgramGroupingsByExternalIds(
    eids:
      | Set<[RemoteSourceType, MediaSourceId, string]>
      | Set<readonly [RemoteSourceType, MediaSourceId, string]>,
    chunkSize: number = 100,
  ) {
    const allIds = [...eids];
    const programs: MarkRequired<
      ProgramGroupingOrmWithRelations,
      'externalIds'
    >[] = [];
    for (const idChunk of chunk(allIds, chunkSize)) {
      const results =
        await this.drizzleDB.query.programGroupingExternalId.findMany({
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
          columns: {},
          with: {
            grouping: {
              with: {
                artist: true,
                show: true,
                externalIds: true,
              },
            },
          },
        });
      programs.push(...seq.collect(results, (r) => r.grouping));
    }

    return programs;
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
    ).orderBy(asc(Program.seasonNumber), asc(Program.episode));

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

  async getProgramGroupingChildCounts(
    groupingIds: string[],
  ): Promise<Record<string, ProgramGroupingChildCounts>> {
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
    const programs = await this.drizzleDB.query.program.findMany({
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

    return orderBy(
      programs,
      [(p) => p.season?.index ?? p.seasonNumber ?? 1, (p) => p.episode ?? 1],
      ['asc', 'asc'],
    );
  }
}
