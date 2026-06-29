import { KEYS } from '@/types/inject.js';
import type { Maybe } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import { booleanToNumber } from '@/util/sqliteUtil.js';
import { tag } from '@tunarr/types';
import type {
  InsertMediaSourceRequest,
  UpdateMediaSourceRequest,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { and, eq, inArray } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import {
  chunk,
  differenceWith,
  first,
  head,
  isEmpty,
  isNil,
  trimEnd,
} from 'lodash-es';
import type { MarkRequired } from 'ts-essentials';
import { v4 } from 'uuid';
import type { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.ts';
import type { MediaSourceLibraryRefresher } from '../services/MediaSourceLibraryRefresher.ts';

import type {
  MediaSourceId,
  MediaSourceName,
  MediaSourceType,
} from './schema/base.js';
import type { DB } from './schema/db.ts';
import type { MediaSourceWithRelations } from './schema/derivedTypes.js';
import type { DrizzleDBAccess } from './schema/index.ts';
import { MediaSource } from './schema/MediaSource.ts';
import type {
  MediaSourceLibraryUpdate,
  NewMediaSourceLibrary} from './schema/MediaSourceLibrary.ts';
import {
  MediaSourceLibrary
} from './schema/MediaSourceLibrary.ts';
import { MediaSourceLibraryReplacePath } from './schema/MediaSourceLibraryReplacePath.ts';
import { Program } from './schema/Program.ts';

type MediaSourceUserInfo = {
  userId?: string;
  username?: string;
};

@injectable()
export class MediaSourceDB {
  constructor(
    @inject(KEYS.MediaSourceApiFactory)
    private mediaSourceApiFactory: () => MediaSourceApiFactory,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.MediaSourceLibraryRefresher)
    private mediaSourceLibraryRefresher: () => MediaSourceLibraryRefresher,
    @inject(KEYS.DrizzleDB)
    private drizzleDB: DrizzleDBAccess,
  ) {}

  async getAll(): Promise<MediaSourceWithRelations[]> {
    return await this.drizzleDB.query.mediaSource.findMany({
      with: {
        libraries: true,
        paths: true,
        replacePaths: true,
      },
    });
  }

  async getById(id: MediaSourceId): Promise<Maybe<MediaSourceWithRelations>> {
    return head(await this.getByIds([id]));
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
    const deletedServer = await this.getById(id);
    if (isNil(deletedServer)) {
      throw new Error(`MediaSource not found: ${id}`);
    }

    // TODO: We need to update this to:
    // 1. handle different source types
    // 2. use program_external_id table
    // 3. not delete programs if they still have another reference via
    //    the external id table (program that exists on 2 servers)
    const allPrograms = await this.drizzleDB.query.program.findMany({
      where: (fields, { eq, and }) =>
        and(
          eq(fields.sourceType, deletedServer.type),
          eq(fields.mediaSourceId, deletedServer.uuid),
        ),
      columns: {
        uuid: true,
      },
    });

    const allGroupings = await this.db
      .selectFrom('programGrouping')
      .select('uuid')
      .where('sourceType', '=', deletedServer.type)
      .where('mediaSourceId', '=', deletedServer.uuid)
      .execute();

    // Remove all associations of this program
    for (const programChunk of chunk(allPrograms, 100)) {
      const programIds = programChunk.map((p) => p.uuid);
      this.drizzleDB.transaction((tx) => {
        tx.delete(Program).where(inArray(Program.uuid, programIds)).run();
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

    const programIds = allPrograms.map((p) => p.uuid);
    const groupingIds = allGroupings.map((p) => p.uuid);

    return { deletedServer, programIds, groupingIds };
  }

  async updateMediaSource(updateReq: UpdateMediaSourceRequest) {
    const id = tag<MediaSourceId>(updateReq.id);

    const mediaSource = await this.getById(id);

    if (isNil(mediaSource)) {
      throw new Error("Server doesn't exist.");
    }

    if (updateReq.type === 'local') {
      this.drizzleDB.transaction((tx) => {
        tx.update(MediaSource)
          .set({
            mediaType: updateReq.mediaType,
            name: tag<MediaSourceName>(updateReq.name),
          })
          .where(eq(MediaSource.uuid, id))
          .run();

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
          tx.delete(MediaSourceLibrary)
            .where(
              and(
                eq(MediaSourceLibrary, tag<MediaSourceId>(updateReq.id)),
                inArray(MediaSourceLibrary.externalKey, deletePaths),
              ),
            )
            .run();
        }

        if (newPaths.length > 0) {
          tx.insert(MediaSourceLibrary)
            .values(
              newPaths.map((path) => ({
                externalKey: path,
                mediaSourceId: mediaSource.uuid,
                mediaType: updateReq.mediaType,
                name: path,
                uuid: v4(),
                enabled: true,
                lastScannedAt: null,
              })),
            )
            .run();
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

  async setClientIdentifier(
    mediaSourceId: MediaSourceId,
    clientIdentifier: string,
  ) {
    return await this.drizzleDB
      .update(MediaSource)
      .set({
        clientIdentifier,
      })
      .where(eq(MediaSource.uuid, mediaSourceId));
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

  async addMediaSource(
    server: InsertMediaSourceRequest,
  ): Promise<MediaSourceId> {
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
    const newServer = this.drizzleDB.transaction((tx) => {
      const newServer = tx
        .insert(MediaSource)
        .values({
          uuid: tag<MediaSourceId>(v4()),
          name,
          uri: server.type === 'local' ? '' : trimEnd(server.uri, '/'),
          sendChannelUpdates: false,
          sendGuideUpdates: sendGuideUpdates,
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
          clientIdentifier:
            server.type === 'plex' ? server.clientIdentifier : null,
        } satisfies typeof MediaSource.$inferInsert)
        .returning({ uuid: MediaSource.uuid })
        .get();

      if (server.type === 'local') {
        tx.insert(MediaSourceLibrary)
          .values(
            server.paths.map(
              (path) =>
                ({
                  externalKey: path,
                  mediaSourceId: newServer.uuid,
                  mediaType: server.mediaType,
                  name: path,
                  uuid: v4(),
                  enabled: true,
                  lastScannedAt: null,
                }) satisfies typeof MediaSourceLibrary.$inferInsert,
            ),
          )
          .run();
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

  updateLibraries(updates: MediaSourceLibrariesUpdate) {
    this.drizzleDB.transaction((tx) => {
      if (!isEmpty(updates.addedLibraries)) {
        tx.insert(MediaSourceLibrary).values(updates.addedLibraries).run();
      }

      if (updates.updatedLibraries.length > 0) {
        for (const update of updates.updatedLibraries) {
          tx.update(MediaSourceLibrary)
            .set(update)
            .where(eq(MediaSourceLibrary.uuid, update.uuid))
            .run();
        }
      }

      if (updates.deletedLibraries.length > 0) {
        tx.delete(MediaSourceLibrary)
          .where(inArray(MediaSourceLibrary.uuid, updates.deletedLibraries))
          .run();
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

type MediaSourceLibrariesUpdate = {
  addedLibraries: NewMediaSourceLibrary[];
  updatedLibraries: MarkRequired<MediaSourceLibraryUpdate, 'uuid'>[];
  deletedLibraries: string[];
};
