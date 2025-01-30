import { Maybe } from '@/types/util.js';
import { groupByUniqProp, isNonEmptyString } from '@/util/index.js';
import {
  InsertMediaSourceRequest,
  UpdateMediaSourceRequest,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import {
  chunk,
  first,
  isNil,
  isUndefined,
  keys,
  map,
  mapValues,
  some,
  trimEnd,
} from 'lodash-es';
import { v4 } from 'uuid';

import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { KEYS } from '@/types/inject.js';
import { booleanToNumber } from '@/util/sqliteUtil.js';
import { inject, injectable } from 'inversify';
import { getDatabase } from './DBAccess.ts';
import {
  withProgramChannels,
  withProgramCustomShows,
  withProgramFillerShows,
} from './programQueryHelpers.ts';
import { MediaSource, MediaSourceType } from './schema/MediaSource.ts';

type Report = {
  type: 'channel' | 'custom-show' | 'filler';
  id: string;
  channelNumber?: number;
  channelName?: string;
  destroyedPrograms: number;
  modifiedPrograms: number;
};

@injectable()
export class MediaSourceDB {
  constructor(@inject(KEYS.ChannelDB) private channelDb: IChannelDB) {}

  async getAll(): Promise<MediaSource[]> {
    return getDatabase().selectFrom('mediaSource').selectAll().execute();
  }

  async getById(id: string) {
    return getDatabase()
      .selectFrom('mediaSource')
      .selectAll()
      .where('mediaSource.uuid', '=', id)
      .executeTakeFirst();
  }

  async getByName(name: string) {
    return getDatabase()
      .selectFrom('mediaSource')
      .selectAll()
      .where('mediaSource.name', '=', name)
      .executeTakeFirst();
  }

  async findByType(
    type: MediaSourceType,
    nameOrId: string,
  ): Promise<MediaSource | undefined>;
  async findByType(type: MediaSourceType): Promise<MediaSource[]>;
  async findByType(
    type: MediaSourceType,
    nameOrId?: string,
  ): Promise<MediaSource[] | Maybe<MediaSource>> {
    const found = await getDatabase()
      .selectFrom('mediaSource')
      .selectAll()
      .where('mediaSource.type', '=', type)
      .$if(isNonEmptyString(nameOrId), (qb) =>
        qb.where((eb) =>
          eb.or([
            eb('mediaSource.name', '=', nameOrId!),
            eb('mediaSource.uuid', '=', nameOrId!),
          ]),
        ),
      )
      .execute();

    if (isNonEmptyString(nameOrId)) {
      return first(found);
    } else {
      return found;
    }
  }

  async getByExternalId(
    sourceType: MediaSourceType,
    nameOrClientId: string,
  ): Promise<Maybe<MediaSource>> {
    return getDatabase()
      .selectFrom('mediaSource')
      .selectAll()
      .where((eb) =>
        eb.and([
          eb('type', '=', sourceType),
          eb.or([
            eb('name', '=', nameOrClientId),
            eb('clientIdentifier', '=', nameOrClientId),
          ]),
        ]),
      )
      .executeTakeFirst();
  }

  async deleteMediaSource(id: string, removePrograms: boolean = true) {
    const deletedServer = await this.getById(id);
    if (isNil(deletedServer)) {
      throw new Error(`MediaSource not found: ${id}`);
    }

    await getDatabase()
      .deleteFrom('mediaSource')
      .where('uuid', '=', id)
      // TODO: Blocked on https://github.com/oven-sh/bun/issues/16909
      // .limit(1)
      .execute();

    let reports: Report[];
    if (!removePrograms) {
      reports = [];
    } else {
      reports = await this.fixupProgramReferences(
        deletedServer.name,
        deletedServer.type,
      );
    }

    return { deletedServer, reports };
  }

  async updateMediaSource(server: UpdateMediaSourceRequest) {
    const id = server.id;

    const s = await this.getById(id);

    if (isNil(s)) {
      throw new Error("Server doesn't exist.");
    }

    const sendGuideUpdates =
      server.type === 'plex' ? server.sendGuideUpdates ?? false : false;
    const sendChannelUpdates =
      server.type === 'plex' ? server.sendChannelUpdates ?? false : false;

    await getDatabase()
      .updateTable('mediaSource')
      .set({
        name: server.name,
        uri: trimEnd(server.uri, '/'),
        accessToken: server.accessToken,
        sendGuideUpdates: booleanToNumber(sendGuideUpdates),
        sendChannelUpdates: booleanToNumber(sendChannelUpdates),
        updatedAt: +dayjs(),
      })
      .where('uuid', '=', server.id)
      // TODO: Blocked on https://github.com/oven-sh/bun/issues/16909
      // .limit(1)
      .executeTakeFirst();

    const report = await this.fixupProgramReferences(id, s.type, s);

    return report;
  }

  async addMediaSource(server: InsertMediaSourceRequest): Promise<string> {
    const name = isUndefined(server.name) ? 'plex' : server.name;
    const sendGuideUpdates =
      server.type === 'plex' ? server.sendGuideUpdates ?? false : false;
    const sendChannelUpdates =
      server.type === 'plex' ? server.sendChannelUpdates ?? false : false;
    const index = await getDatabase()
      .selectFrom('mediaSource')
      .select((eb) => eb.fn.count<number>('uuid').as('count'))
      .executeTakeFirst()
      .then((_) => _?.count ?? 0);

    const now = +dayjs();
    const newServer = await getDatabase()
      .insertInto('mediaSource')
      .values({
        ...server,
        uuid: v4(),
        name,
        uri: trimEnd(server.uri, '/'),
        sendChannelUpdates: sendChannelUpdates ? 1 : 0,
        sendGuideUpdates: sendGuideUpdates ? 1 : 0,
        createdAt: now,
        updatedAt: now,
        index,
        type: server.type,
      })
      .returning('uuid')
      .executeTakeFirstOrThrow();

    return newServer?.uuid;
  }

  // private async removeDanglingPrograms(mediaSource: MediaSource) {
  //   const knownProgramIds = await directDbAccess()
  //     .selectFrom('programExternalId as p1')
  //     .where(({ eb, and }) =>
  //       and([
  //         eb('p1.externalSourceId', '=', mediaSource.name),
  //         eb('p1.sourceType', '=', mediaSource.type),
  //       ]),
  //     )
  //     .selectAll('p1')
  //     .select((eb) =>
  //       jsonArrayFrom(
  //         eb
  //           .selectFrom('programExternalId as p2')
  //           .whereRef('p2.programUuid', '=', 'p1.programUuid')
  //           .whereRef('p2.uuid', '!=', 'p1.uuid')
  //           .select(['p2.sourceType', 'p2.externalSourceId', 'p2.externalKey']),
  //       ).as('otherExternalIds'),
  //     )
  //     .groupBy('p1.uuid')
  //     .execute();

  //   const mediaSourceTypes = map(enumValues(MediaSourceType), (typ) =>
  //     typ.toString(),
  //   );
  //   const danglingPrograms = reject(knownProgramIds, (program) => {
  //     some(program.otherExternalIds, (eid) =>
  //       mediaSourceTypes.includes(eid.sourceType),
  //     );
  //   });
  // }

  private async fixupProgramReferences(
    serverName: string,
    serverType: MediaSourceType,
    newServer?: MediaSource,
  ) {
    // TODO: We need to update this to:
    // 1. handle different source types
    // 2. use program_external_id table
    // 3. not delete programs if they still have another reference via
    //    the external id table (program that exists on 2 servers)
    const allPrograms = await getDatabase()
      .selectFrom('program')
      .selectAll()
      .where('sourceType', '=', serverType)
      .where('externalSourceId', '=', serverName)
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

    const isUpdate = newServer && newServer.uuid !== serverName;
    if (!isUpdate) {
      // Remove all associations of this program
      // TODO: See if we can just get this automatically with foreign keys...
      await getDatabase()
        .transaction()
        .execute(async (tx) => {
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
          destroyedPrograms: isUpdate ? 0 : channelToProgramCount[id] ?? 0,
          modifiedPrograms: isUpdate ? channelToProgramCount[id] ?? 0 : 0,
        } as Report;
      },
    );

    const fillerReports: Report[] = map(fillersById, ({ uuid }) => ({
      type: 'filler',
      id: uuid,
      destroyedPrograms: isUpdate ? 0 : fillerToProgramCount[uuid] ?? 0,
      modifiedPrograms: isUpdate ? fillerToProgramCount[uuid] ?? 0 : 0,
    }));

    const customShowReports: Report[] = map(customShowById, ({ uuid }) => ({
      type: 'custom-show',
      id: uuid,
      destroyedPrograms: isUpdate ? 0 : customShowToProgramCount[uuid] ?? 0,
      modifiedPrograms: isUpdate ? customShowToProgramCount[uuid] ?? 0 : 0,
    }));

    return [...channelReports, ...fillerReports, ...customShowReports];
  }
}
