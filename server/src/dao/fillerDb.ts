import { Loaded } from '@mikro-orm/core';
import {
  CreateFillerListRequest,
  UpdateFillerListRequest,
} from '@tunarr/types/api';
import { filter, isNil, isString, map } from 'lodash-es';
import { ChannelCache } from '../stream/ChannelCache.js';
import { isNonEmptyString, mapAsyncSeq } from '../util/index.js';
import { ProgramConverter } from './converters/programConverters.js';
import { getEm } from './dataSource.js';
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
    // const channels = await this.getFillerChannels(id);

    const em = getEm();
    // await em.nativeDelete(ChannelFillerShow, {fillerShow: id});

    // Remove references to filler collection.
    // await sequentialPromises(channels, undefined, async (channel) => {
    //   logger.debug(`Updating channel ${channel.number}, remove filler ${id}`);
    //   const fullChannel = await this.channelDB.getChannel(channel.number);
    //   await fullChannel?.fillers.init();

    //   if (!isNil(fullChannel) && !isEmpty(fullChannel.fillers)) {
    //     fullChannel.fillers.remove((filler) => filler.uuid === id);
    //     return this.channelDB.saveChannel(fullChannel);
    //   }

    //   return;
    // });

    await em.removeAndFlush(em.getReference(FillerShow, id));
    this.channelCache.clear();
    return;
  }

  // Specifically cast these down for now because our TaggedType type is not portable
  getAllFillerIds(): Promise<string[]> {
    return getEm()
      .repo(FillerShow)
      .findAll({ fields: ['uuid'] })
      .then((shows) => map(shows, 'uuid'));
  }

  getAllFillers() {
    return getEm()
      .repo(FillerShow)
      .findAll({ populate: ['*', 'content.uuid'] });
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
    channelId: string | number,
  ): Promise<Loaded<ChannelFillerShow, 'fillerShow' | 'fillerShow.content'>[]> {
    const em = getEm();
    return await em.find(
      ChannelFillerShow,
      {
        channel: isString(channelId)
          ? { uuid: channelId }
          : { number: channelId },
      },
      { populate: ['fillerShow', 'fillerShow.content'] },
    );
  }
}
