import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { KEYS } from '@/types/inject.js';
import { Maybe } from '@/types/util.js';
import { groupByUniqProp, isNonEmptyString } from '@/util/index.js';
import { booleanToNumber } from '@/util/sqliteUtil.js';
import { tag } from '@tunarr/types';
import type {
  InsertMediaSourceRequest,
  UpdateMediaSourceRequest,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { inject, injectable, interfaces } from 'inversify';
import { Kysely } from 'kysely';
import {
  chunk,
  differenceWith,
  first,
  isEmpty,
  isNil,
  keys,
  map,
  mapValues,
  some,
  trimEnd,
} from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
import { v4 } from 'uuid';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.ts';
import { MediaSourceLibraryRefresher } from '../services/MediaSourceLibraryRefresher.ts';
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
import { MediaSourceOrm } from './schema/MediaSource.ts';
import {
  MediaSourceLibraryUpdate,
  NewMediaSourceLibrary,
} from './schema/MediaSourceLibrary.ts';

type Report = {
  type: 'channel' | 'custom-show' | 'filler';
  id: string;
  channelNumber?: number;
  channelName?: string;
  destroyedPrograms: number;
  modifiedPrograms: number;
};

type MediaSourceUserInfo = {
  userId?: string;
  username?: string;
};

@injectable()
export class MediaSourceDB {
  constructor(
    @inject(KEYS.ChannelDB) private channelDb: IChannelDB,
    @inject(KEYS.MediaSourceApiFactory)
    private mediaSourceApiFactory: () => MediaSourceApiFactory,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.MediaSourceLibraryRefresher)
    private mediaSourceLibraryRefresher: interfaces.AutoFactory<MediaSourceLibraryRefresher>,
    @inject(KEYS.DrizzleDB)
    private drizzleDB: DrizzleDBAccess,
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

  async getById(id: MediaSourceId): Promise<Maybe<MediaSourceWithRelations>> {
    return this.drizzleDB.query.mediaSource.findFirst({
      where: (ms, { eq }) => eq(ms.uuid, id),
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
    const deletedServer = await this.getById(id);
    if (isNil(deletedServer)) {
      throw new Error(`MediaSource not found: ${id}`);
    }

    // This should cascade all relevant deletes across the DB
    const relatedProgramIds = await this.db
      .transaction()
      .execute(async (tx) => {
        const relatedProgramIds = await tx
          .selectFrom('program')
          .where('program.mediaSourceId', '=', id)
          .select('uuid')
          .execute()
          .then((_) => _.map(({ uuid }) => uuid));

        await tx
          .deleteFrom('mediaSource')
          .where('uuid', '=', id)
          .limit(1)
          .execute();
        return relatedProgramIds;
      });

    await this.channelDb.removeProgramsFromAllLineups(relatedProgramIds);

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
          name: updateReq.name,
          uri: trimEnd(updateReq.uri, '/'),
          accessToken: updateReq.accessToken,
          sendGuideUpdates: booleanToNumber(sendGuideUpdates),
          updatedAt: +dayjs(),
          // This allows clearing the values
          userId: updateReq.userId,
          username: updateReq.username,
        })
        .where('uuid', '=', updateReq.id)
        // TODO: Blocked on https://github.com/oven-sh/bun/issues/16909
        // .limit(1)
        .executeTakeFirst();

      this.mediaSourceApiFactory().deleteCachedClient(mediaSource);
    }

    const report = await this.fixupProgramReferences(
      tag(id),
      mediaSource.type,
      mediaSource,
    );

    return report;
  }

  async setMediaSourceUserInfo(
    mediaSourceId: MediaSourceId,
    info: MediaSourceUserInfo,
  ) {
    if (isNonEmptyString(info.userId) && isNonEmptyString(info.username)) {
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
    return this.db
      .updateTable('mediaSourceLibrary')
      .set({
        enabled: booleanToNumber(enabled),
      })
      .where('mediaSourceLibrary.mediaSourceId', '=', mediaSourceId)
      .where('uuid', '=', libraryId)
      .returningAll()
      .executeTakeFirstOrThrow();
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

  private async fixupProgramReferences(
    serverId: MediaSourceId,
    serverType: MediaSourceType,
    newServer?: MediaSourceOrm,
  ) {
    // TODO: We need to update this to:
    // 1. handle different source types
    // 2. use program_external_id table
    // 3. not delete programs if they still have another reference via
    //    the external id table (program that exists on 2 servers)
    const allPrograms = await this.db
      .selectFrom('program')
      .selectAll()
      .where('sourceType', '=', serverType)
      .where('mediaSourceId', '=', serverId)
      .select(withProgramChannels)
      .select(withProgramFillerShows)
      .select(withProgramCustomShows)
      .execute();

    const channelById = groupByUniqProp(
      allPrograms.flatMap((p) => p.channels),
      'uuid',
    );

    const customShowById = groupByUniqProp(
      allPrograms.flatMap((p) => p.customShows),
      'uuid',
    );

    const fillersById = groupByUniqProp(
      allPrograms.flatMap((p) => p.fillerShows),
      'uuid',
    );

    const channelToProgramCount = mapValues(
      channelById,
      ({ uuid }) =>
        allPrograms.filter((p) => some(p.channels, (f) => f.uuid === uuid))
          .length,
    );

    const customShowToProgramCount = mapValues(
      customShowById,
      ({ uuid }) =>
        allPrograms.filter((p) => some(p.customShows, (f) => f.uuid === uuid))
          .length,
    );

    const fillerToProgramCount = mapValues(
      fillersById,
      ({ uuid }) =>
        allPrograms.filter((p) => some(p.fillerShows, (f) => f.uuid === uuid))
          .length,
    );

    const isUpdate = newServer && newServer.uuid !== serverId;
    if (!isUpdate) {
      // Remove all associations of this program
      // TODO: See if we can just get this automatically with foreign keys...
      await this.db.transaction().execute(async (tx) => {
        for (const programChunk of chunk(allPrograms, 500)) {
          const programIds = map(programChunk, 'uuid');
          await tx
            .deleteFrom('channelPrograms')
            .where('channelPrograms.programUuid', 'in', programIds)
            .execute();
          await tx
            .deleteFrom('fillerShowContent')
            .where('fillerShowContent.programUuid', 'in', programIds)
            .execute();
          await tx
            .deleteFrom('customShowContent')
            .where('customShowContent.contentUuid', 'in', programIds)
            .execute();
          await tx
            .deleteFrom('program')
            .where('uuid', 'in', programIds)
            .execute();
        }

        for (const channel of keys(channelById)) {
          await this.channelDb.removeProgramsFromLineup(
            channel,
            map(allPrograms, 'uuid'),
          );
        }
      });
    }

    const channelReports: Report[] = map(
      channelById,
      ({ number, name }, id) => {
        return {
          type: 'channel',
          id,
          channelNumber: number,
          channelName: name,
          destroyedPrograms: isUpdate ? 0 : (channelToProgramCount[id] ?? 0),
          modifiedPrograms: isUpdate ? (channelToProgramCount[id] ?? 0) : 0,
        } as Report;
      },
    );

    const fillerReports: Report[] = map(fillersById, ({ uuid }) => ({
      type: 'filler',
      id: uuid,
      destroyedPrograms: isUpdate ? 0 : (fillerToProgramCount[uuid] ?? 0),
      modifiedPrograms: isUpdate ? (fillerToProgramCount[uuid] ?? 0) : 0,
    }));

    const customShowReports: Report[] = map(customShowById, ({ uuid }) => ({
      type: 'custom-show',
      id: uuid,
      destroyedPrograms: isUpdate ? 0 : (customShowToProgramCount[uuid] ?? 0),
      modifiedPrograms: isUpdate ? (customShowToProgramCount[uuid] ?? 0) : 0,
    }));

    return [...channelReports, ...fillerReports, ...customShowReports];
  }
}

export type MediaSourceLibrariesUpdate = {
  addedLibraries: NewMediaSourceLibrary[];
  updatedLibraries: MarkRequired<MediaSourceLibraryUpdate, 'uuid'>[];
  deletedLibraries: string[];
};
