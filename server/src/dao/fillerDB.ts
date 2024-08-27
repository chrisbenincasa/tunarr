import {
  CreateFillerListRequest,
  UpdateFillerListRequest,
} from '@tunarr/types/api';
import { jsonArrayFrom, jsonBuildObject } from 'kysely/helpers/sqlite';
import {
  filter,
  find,
  forEach,
  groupBy,
  isNil,
  isUndefined,
  map,
  reject,
  round,
  uniq,
  values,
} from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
import { ChannelCache } from '../stream/ChannelCache.js';
import { isNonEmptyString, mapAsyncSeq } from '../util/index.js';
import { ProgramConverter } from './converters/programConverters.js';
import { getEm } from './dataSource.js';
import { ChannelFillerShow as RawChannelFillerShow } from './direct/derivedTypes.js';
import { directDbAccess } from './direct/directDbAccess.js';
import { withFillerPrograms } from './direct/programQueryHelpers.js';
import { Channel as ChannelEntity } from './entities/Channel.js';
import { ChannelFillerShow } from './entities/ChannelFillerShow.js';
import { FillerListContent } from './entities/FillerListContent.js';
import { FillerShow, FillerShowId } from './entities/FillerShow.js';
import {
  createPendingProgramIndexMap,
  upsertContentPrograms,
} from './programHelpers.js';

export class FillerDB {
  private channelCache: ChannelCache;
  #programConverter: ProgramConverter = new ProgramConverter();

  constructor(channelCache: ChannelCache) {
    this.channelCache = channelCache;
  }

  getFiller(id: FillerShowId) {
    return getEm()
      .repo(FillerShow)
      .findOne(id, { populate: ['content.uuid'] });
  }

  async saveFiller(id: FillerShowId, updateRequest: UpdateFillerListRequest) {
    const em = getEm();
    const filler = await this.getFiller(id);

    if (isNil(filler)) {
      return null;
    }

    if (updateRequest.programs) {
      const programIndexById = createPendingProgramIndexMap(
        updateRequest.programs,
      );

      const persisted = filter(
        updateRequest.programs,
        (p) => p.persisted && isNonEmptyString(p.id),
      );

      const upsertedPrograms = await upsertContentPrograms(
        updateRequest.programs,
      );

      const persistedCustomShowContent = map(persisted, (p) =>
        em.create(FillerListContent, {
          fillerList: filler.uuid,
          content: p.id!,
          index: programIndexById[p.id!],
        }),
      );
      const newCustomShowContent = map(upsertedPrograms, (p) =>
        em.create(FillerListContent, {
          fillerList: filler.uuid,
          content: p.uuid,
          index: programIndexById[p.uniqueId()],
        }),
      );

      await em.nativeDelete(FillerListContent, { fillerList: filler.uuid });
      await em.persistAndFlush([
        ...persistedCustomShowContent,
        ...newCustomShowContent,
      ]);
    }

    if (updateRequest.name) {
      em.assign(filler, { name: updateRequest.name });
    }

    await em.flush();

    return await em.refresh(filler);
  }

  async createFiller(createRequest: CreateFillerListRequest): Promise<string> {
    const em = getEm();
    const filler = em.repo(FillerShow).create({
      name: createRequest.name,
    });

    const programIndexById = createPendingProgramIndexMap(
      createRequest.programs,
    );

    const persisted = filter(createRequest.programs, (p) => p.persisted);

    const upsertedPrograms = await upsertContentPrograms(
      createRequest.programs,
    );

    await em.persistAndFlush(filler);

    const persistedCustomShowContent = map(persisted, (p) =>
      em.create(FillerListContent, {
        fillerList: filler.uuid,
        content: p.id!,
        index: programIndexById[p.id!],
      }),
    );
    const newCustomShowContent = map(upsertedPrograms, (p) =>
      em.create(FillerListContent, {
        fillerList: filler.uuid,
        content: p.uuid,
        index: programIndexById[p.uniqueId()],
      }),
    );

    await em
      .persist([...persistedCustomShowContent, ...newCustomShowContent])
      .flush();

    return filler.uuid;
  }

  // Returns all channels a given filler list is a part of
  async getFillerChannels(id: string) {
    const channels = await getEm()
      .createQueryBuilder(ChannelEntity, 'channel')
      .select(['number', 'name'], true)
      .where({ fillers: { uuid: id } })
      .execute();
    return channels.map((channel) => ({
      name: channel.name,
      number: channel.number,
    }));
  }

  async deleteFiller(id: FillerShowId): Promise<void> {
    const em = getEm();

    await em.transactional(async (em) => {
      const relevantChannelFillers = await em.find(ChannelFillerShow, {
        fillerShow: id,
      });
      const allRelevantChannelFillers = await em.find(ChannelFillerShow, {
        channel: {
          $in: uniq(map(relevantChannelFillers, (cf) => cf.channel.uuid)),
        },
      });
      const fillersByChannel = groupBy(
        allRelevantChannelFillers,
        (cf) => cf.channel.uuid,
      );

      forEach(values(fillersByChannel), (cfs) => {
        const removedWeight = find(cfs, (cf) => cf.fillerShow.uuid === id)
          ?.weight;
        if (isUndefined(removedWeight)) {
          return;
        }
        const remainingFillers = reject(cfs, (cf) => cf.fillerShow.uuid === id);
        const distributeWeight =
          remainingFillers.length > 0
            ? round(removedWeight / remainingFillers.length, 2)
            : 0;
        forEach(remainingFillers, (filler) => {
          filler.weight += distributeWeight;
        });
      });

      await em.removeAndFlush([
        ...relevantChannelFillers,
        em.getReference(FillerShow, id),
      ]);
      await em.flush();
    });

    this.channelCache.clear();
    return;
  }

  // Specifically cast these down for now because our TaggedType type is not portable
  async getAllFillerIds(): Promise<string[]> {
    const ids = await directDbAccess()
      .selectFrom('fillerShow')
      .select(['uuid'])
      .execute();
    return map(ids, 'uuid');
  }

  async getAllFillers() {
    return await directDbAccess()
      .selectFrom('fillerShow')
      .selectAll()
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('fillerShowContent')
            .whereRef(
              'fillerShowContent.fillerShowUuid',
              '=',
              'fillerShow.uuid',
            )
            .leftJoin(
              'fillerShow',
              'fillerShowContent.fillerShowUuid',
              'fillerShow.uuid',
            )
            .select('fillerShowContent.programUuid'),
        ).as('content'),
      )
      .execute();
  }

  async getFillerPrograms(id: FillerShowId) {
    const programs = await getEm()
      .repo(FillerListContent)
      .find(
        { fillerList: id },
        {
          populate: [
            'content',
            'content.album',
            'content.artist',
            'content.tvShow',
            'content.season',
          ],
          orderBy: { index: 'DESC' },
        },
      );

    return await mapAsyncSeq(programs, async (fillerContent) =>
      this.#programConverter.entityToContentProgram(fillerContent.content),
    );
  }

  async getFillersFromChannel(
    channelId: string,
  ): Promise<MarkRequired<RawChannelFillerShow, 'fillerContent'>[]> {
    const result = await directDbAccess()
      .selectFrom('channelFillerShow')
      .where('channelFillerShow.channelUuid', '=', channelId)
      .innerJoin(
        'fillerShow',
        'channelFillerShow.fillerShowUuid',
        'fillerShow.uuid',
      )
      .select((eb) =>
        // Build the JSON object manually so we don't have to deal with
        // nulls down the line from a nested select query
        jsonBuildObject({
          uuid: eb.ref('fillerShow.uuid'),
          name: eb.ref('fillerShow.name'),
          createdAt: eb.ref('fillerShow.createdAt'),
          updatedAt: eb.ref('fillerShow.updatedAt'),
        }).as('fillerShow'),
      )
      .innerJoin(
        'fillerShowContent',
        'fillerShowContent.fillerShowUuid',
        'fillerShow.uuid',
      )
      .selectAll(['channelFillerShow'])
      .select(withFillerPrograms)
      .groupBy('fillerShow.uuid')
      .orderBy('fillerShowContent.index asc')
      .execute();

    return result;
  }
}
