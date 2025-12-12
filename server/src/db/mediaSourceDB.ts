import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { KEYS } from '@/types/inject.js';
import { Maybe, Nullable } from '@/types/util.js';
import { groupByUniq, isNonEmptyString } from '@/util/index.js';
import { booleanToNumber } from '@/util/sqliteUtil.js';
import { tag } from '@tunarr/types';
import type {
  InsertMediaSourceRequest,
  UpdateMediaSourceRequest,
} from '@tunarr/types/api';
import DataLoader from 'dataloader';
import dayjs from 'dayjs';
import { and, eq } from 'drizzle-orm';
import { inject, injectable, interfaces } from 'inversify';
import { Kysely } from 'kysely';
import {
  chunk,
  differenceWith,
  first,
  head,
  isEmpty,
  isNil,
  trimEnd,
} from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
import { v4 } from 'uuid';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.ts';
import { MediaSourceLibraryRefresher } from '../services/MediaSourceLibraryRefresher.ts';
import { MeilisearchService } from '../services/MeilisearchService.ts';
import {
  withProgramChannels,
  withProgramCustomShows,
  withProgramFillerShows,
} from './programQueryHelpers.ts';
import {
  MediaSourceId,
  MediaSourceName,
  MediaSourceType,
} from './schema/base.js';
import { DB } from './schema/db.ts';
import {
  EmbyMediaSource,
  JellyfinMediaSource,
  MediaSourceWithRelations,
  PlexMediaSource,
} from './schema/derivedTypes.js';
import { DrizzleDBAccess } from './schema/index.ts';
import {
  MediaSourceLibrary,
  MediaSourceLibraryUpdate,
  NewMediaSourceLibrary,
} from './schema/MediaSourceLibrary.ts';
import { MediaSourceLibraryReplacePath } from './schema/MediaSourceLibraryReplacePath.ts';

type MediaSourceUserInfo = {
  userId?: string;
  username?: string;
};

@injectable()
export class MediaSourceDB {
  private mediaSourceByIdLoader = new DataLoader<
    MediaSourceId,
    MediaSourceWithRelations | null
  >(
    async (batch) => {
      const results = await this.getByIds([...batch]);
      const byId = groupByUniq(results, (result) => result.uuid);
      const resultList: Nullable<MediaSourceWithRelations>[] = [];
      for (const id of batch) {
        resultList.push(byId[id] ?? null);
      }
      return resultList;
    },
    { maxBatchSize: 100, cache: false },
  );

  constructor(
    @inject(KEYS.ChannelDB) private channelDb: IChannelDB,
    @inject(KEYS.MediaSourceApiFactory)
    private mediaSourceApiFactory: () => MediaSourceApiFactory,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.MediaSourceLibraryRefresher)
    private mediaSourceLibraryRefresher: interfaces.AutoFactory<MediaSourceLibraryRefresher>,
    @inject(KEYS.DrizzleDB)
    private drizzleDB: DrizzleDBAccess,
    @inject(MeilisearchService)
    private searchService: MeilisearchService,
  ) {}

  async getAll(): Promise<MediaSourceWithRelations[]> {
    return this.drizzleDB.query.mediaSource.findMany({
      with: {
        libraries: true,
        paths: true,
        replacePaths: true,
      },
    });
  }

  async getById(
    id: MediaSourceId,
    useLoader: boolean = true,
  ): Promise<Maybe<MediaSourceWithRelations>> {
    if (!useLoader) {
      return head(await this.getByIds([id]));
    }
    return (await this.mediaSourceByIdLoader.load(id)) ?? undefined;
  }

  private async getByIds(
    ids: MediaSourceId[],
  ): Promise<MediaSourceWithRelations[]> {
    return await this.drizzleDB.query.mediaSource.findMany({
      where: (ms, { inArray }) => inArray(ms.uuid, ids),
      with: {
        libraries: true,
        paths: true,
        replacePaths: true,
      },
    });
  }

  async getLibrary(id: string) {
    return this.drizzleDB.query.mediaSourceLibrary.findFirst({
      where: (lib, { eq }) => eq(lib.uuid, id),
      with: {
        mediaSource: {
          with: {
            paths: true,
            replacePaths: true,
          },
        },
      },
    });
  }

  async findByType(
    type: typeof MediaSourceType.Plex,
    nameOrId: MediaSourceId,
  ): Promise<PlexMediaSource | undefined>;
  async findByType(
    type: typeof MediaSourceType.Jellyfin,
    nameOrId: MediaSourceId,
  ): Promise<JellyfinMediaSource | undefined>;
  async findByType(
    type: typeof MediaSourceType.Emby,
    nameOrId: MediaSourceId,
  ): Promise<EmbyMediaSource | undefined>;
  async findByType(
    type: MediaSourceType,
    nameOrId: MediaSourceId,
  ): Promise<MediaSourceWithRelations | undefined>;
  async findByType(type: MediaSourceType): Promise<MediaSourceWithRelations[]>;
  async findByType(
    type: MediaSourceType,
    nameOrId?: MediaSourceId,
  ): Promise<MediaSourceWithRelations[] | Maybe<MediaSourceWithRelations>> {
    const found = await this.drizzleDB.query.mediaSource.findMany({
      where: (ms, { eq, and }) => {
        if (isNonEmptyString(nameOrId)) {
          return and(eq(ms.type, type), eq(ms.uuid, nameOrId));
        } else {
          return eq(ms.type, type);
        }
      },
      with: {
        libraries: true,
        paths: true,
        replacePaths: true,
      },
    });

    if (isNonEmptyString(nameOrId)) {
      return first(found);
    } else {
      return found;
    }
  }

  async deleteMediaSource(id: MediaSourceId) {
    const deletedServer = await this.getById(id, false);
    if (isNil(deletedServer)) {
      throw new Error(`MediaSource not found: ${id}`);
    }

    // TODO: We need to update this to:
    // 1. handle different source types
    // 2. use program_external_id table
    // 3. not delete programs if they still have another reference via
    //    the external id table (program that exists on 2 servers)
    const allPrograms = await this.db
      .selectFrom('program')
      .select('uuid')
      .where('sourceType', '=', deletedServer.type)
      .where('mediaSourceId', '=', deletedServer.uuid)
      .select(withProgramChannels)
      .select(withProgramFillerShows)
      .select(withProgramCustomShows)
      .execute();

    const allGroupings = await this.db
      .selectFrom('programGrouping')
      .select('uuid')
      .where('sourceType', '=', deletedServer.type)
      .where('mediaSourceId', '=', deletedServer.uuid)
      .execute();

    // Remove all associations of this program
    for (const programChunk of chunk(allPrograms, 100)) {
      const programIds = programChunk.map((p) => p.uuid);
      await this.db.transaction().execute(async (tx) => {
        await tx
          .deleteFrom('program')
          .where('uuid', 'in', programIds)
          .execute();
      });
    }

    for (const programChunk of chunk(allGroupings, 100)) {
      await this.db
        .deleteFrom('programGrouping')
        .where(
          'uuid',
          'in',
          programChunk.map(({ uuid }) => uuid),
        )
        .execute();
    }
    await this.db
      .deleteFrom('mediaSource')
      .where('uuid', '=', id)
      .limit(1)
      .execute();

    // This cannot happen in the transaction because the DB would be locked.
    const programIds = allPrograms.map((p) => p.uuid);
    await this.channelDb.removeProgramsFromAllLineups(programIds);
    const groupingIds = allGroupings.map((p) => p.uuid);
    await this.searchService.deleteByIds(programIds.concat(groupingIds));

    this.mediaSourceApiFactory().deleteCachedClient(deletedServer);

    return { deletedServer };
  }

  async updateMediaSource(updateReq: UpdateMediaSourceRequest) {
    const id = tag<MediaSourceId>(updateReq.id);

    const mediaSource = await this.getById(id);

    if (isNil(mediaSource)) {
      throw new Error("Server doesn't exist.");
    }

    if (updateReq.type === 'local') {
      await this.db.transaction().execute(async (tx) => {
        await tx
          .updateTable('mediaSource')
          .set({
            mediaType: updateReq.mediaType,
            name: tag<MediaSourceName>(updateReq.name),
          })
          .where('mediaSource.uuid', '=', id)
          .executeTakeFirstOrThrow();

        const newPaths = differenceWith(
          updateReq.paths,
          mediaSource.libraries,
          (incomingPath, { externalKey }) => incomingPath === externalKey,
        );
        const deletePaths = differenceWith(
          mediaSource.libraries,
          updateReq.paths,
          ({ externalKey }, incomingPath) => externalKey === incomingPath,
        ).map(({ externalKey }) => externalKey);

        if (deletePaths.length > 0) {
          await tx
            .deleteFrom('mediaSourceLibrary')
            .where(
              'mediaSourceLibrary.mediaSourceId',
              '=',
              tag<MediaSourceId>(updateReq.id),
            )
            .where('mediaSourceLibrary.externalKey', 'in', deletePaths)
            .executeTakeFirstOrThrow();
        }

        if (newPaths.length > 0) {
          await tx
            .insertInto('mediaSourceLibrary')
            .values(
              newPaths.map((path) => ({
                externalKey: path,
                mediaSourceId: mediaSource.uuid,
                mediaType: updateReq.mediaType,
                name: path,
                uuid: v4(),
                enabled: booleanToNumber(true),
                lastScannedAt: null,
              })),
            )
            .executeTakeFirstOrThrow();
        }
      });
    } else {
      const sendGuideUpdates =
        updateReq.type === 'plex'
          ? (updateReq.sendGuideUpdates ?? false)
          : false;

      await this.db
        .updateTable('mediaSource')
        .set({
          name: tag<MediaSourceName>(updateReq.name),
          uri: trimEnd(updateReq.uri, '/'),
          accessToken: updateReq.accessToken,
          sendGuideUpdates: booleanToNumber(sendGuideUpdates),
          updatedAt: +dayjs(),
          // This allows clearing the values
          userId: updateReq.userId,
          username: updateReq.username,
        })
        .where('uuid', '=', id)
        .limit(1)
        .executeTakeFirst();

      await this.drizzleDB
        .delete(MediaSourceLibraryReplacePath)
        .where(eq(MediaSourceLibraryReplacePath.mediaSourceId, id));
      if (updateReq.pathReplacements.length > 0) {
        await this.drizzleDB.insert(MediaSourceLibraryReplacePath).values(
          updateReq.pathReplacements.map((path) => ({
            localPath: path.localPath,
            mediaSourceId: id,
            serverPath: path.serverPath,
            uuid: v4(),
          })),
        );
      }

      this.mediaSourceApiFactory().deleteCachedClient(mediaSource);
    }
  }

  async setMediaSourceUserInfo(
    mediaSourceId: MediaSourceId,
    info: MediaSourceUserInfo,
  ) {
    if (isEmpty(info.userId) && isEmpty(info.username)) {
      return;
    }

    await this.db
      .updateTable('mediaSource')
      .$if(isNonEmptyString(info.userId), (eb) => eb.set('userId', info.userId))
      .$if(isNonEmptyString(info.username), (eb) =>
        eb.set('username', info.username),
      )
      .where('uuid', '=', mediaSourceId)
      .executeTakeFirstOrThrow();
  }

  async addMediaSource(server: InsertMediaSourceRequest): Promise<string> {
    const name = tag<MediaSourceName>(server.name);
    const sendGuideUpdates =
      server.type === 'plex' ? (server.sendGuideUpdates ?? false) : false;

    if (server.type === 'local' && isEmpty(server.paths)) {
      throw new Error(
        'Must have at least one path specified for a local media source',
      );
    }

    const index = await this.db
      .selectFrom('mediaSource')
      .select((eb) => eb.fn.count<number>('uuid').as('count'))
      .executeTakeFirst()
      .then((_) => _?.count ?? 0);

    const now = +dayjs();
    const newServer = await this.db.transaction().execute(async (tx) => {
      const newServer = await tx
        .insertInto('mediaSource')
        .values({
          // ...server,
          uuid: tag<MediaSourceId>(v4()),
          name,
          uri: server.type === 'local' ? '' : trimEnd(server.uri, '/'),
          sendChannelUpdates: booleanToNumber(false),
          sendGuideUpdates: booleanToNumber(sendGuideUpdates),
          createdAt: now,
          updatedAt: now,
          index,
          type: server.type,
          userId:
            server.type === 'local'
              ? null
              : isNonEmptyString(server.userId)
                ? server.userId
                : null,
          username:
            server.type === 'local'
              ? null
              : isNonEmptyString(server.username)
                ? server.username
                : null,
          accessToken: server.type === 'local' ? '' : server.accessToken,
          mediaType: server.type === 'local' ? server.mediaType : null,
        })
        .returning('uuid')
        .executeTakeFirstOrThrow();

      if (server.type === 'local') {
        await tx
          .insertInto('mediaSourceLibrary')
          .values(
            server.paths.map(
              (path) =>
                ({
                  externalKey: path,
                  mediaSourceId: newServer.uuid,
                  mediaType: server.mediaType,
                  name: path,
                  uuid: v4(),
                  enabled: booleanToNumber(true),
                  lastScannedAt: null,
                }) satisfies NewMediaSourceLibrary,
            ),
          )
          .executeTakeFirstOrThrow();
      }

      return newServer;
    });

    if (server.pathReplacements.length > 0) {
      await this.drizzleDB.insert(MediaSourceLibraryReplacePath).values(
        server.pathReplacements.map((path) => ({
          localPath: path.localPath,
          mediaSourceId: newServer.uuid,
          serverPath: path.serverPath,
          uuid: v4(),
        })),
      );
    }

    await this.mediaSourceLibraryRefresher().refreshMediaSource(newServer.uuid);

    return newServer?.uuid;
  }

  async updateLibraries(updates: MediaSourceLibrariesUpdate) {
    return this.db.transaction().execute(async (tx) => {
      if (!isEmpty(updates.addedLibraries)) {
        await tx
          .insertInto('mediaSourceLibrary')
          .values(updates.addedLibraries)
          .execute();
      }

      if (updates.updatedLibraries.length > 0) {
        for (const update of updates.updatedLibraries) {
          await tx
            .updateTable('mediaSourceLibrary')
            .set(update)
            .where('uuid', '=', update.uuid)
            .executeTakeFirstOrThrow();
        }
      }

      if (updates.deletedLibraries.length > 0) {
        await tx
          .deleteFrom('mediaSourceLibrary')
          .where('uuid', 'in', updates.deletedLibraries)
          .execute();
      }
    });
  }

  async setLibraryEnabled(
    mediaSourceId: MediaSourceId,
    libraryId: string,
    enabled: boolean,
  ) {
    return await this.drizzleDB
      .update(MediaSourceLibrary)
      .set({
        enabled,
      })
      .where(
        and(
          eq(MediaSourceLibrary.mediaSourceId, mediaSourceId),
          eq(MediaSourceLibrary.uuid, libraryId),
        ),
      )
      .limit(1)
      .returning()
      .then((_) => head(_)!);
  }

  setLibraryLastScannedTime(libraryId: string, lastScannedAt: dayjs.Dayjs) {
    return this.db
      .updateTable('mediaSourceLibrary')
      .set({
        lastScannedAt: +lastScannedAt,
      })
      .where('uuid', '=', libraryId)
      .executeTakeFirstOrThrow();
  }
}

export type MediaSourceLibrariesUpdate = {
  addedLibraries: NewMediaSourceLibrary[];
  updatedLibraries: MarkRequired<MediaSourceLibraryUpdate, 'uuid'>[];
  deletedLibraries: string[];
};
