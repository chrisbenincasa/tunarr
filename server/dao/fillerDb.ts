import { Loaded } from '@mikro-orm/core';
import {
  CreateFillerListRequest,
  UpdateFillerListRequest,
} from '@tunarr/types/api';
import { filter, isNil, map } from 'lodash-es';
import { ChannelCache } from '../channelCache.js';
import { dbProgramToContentProgram } from './converters/programConverters.js';
import { getEm } from './dataSource.js';
import { Channel as ChannelEntity } from './entities/Channel.js';
import { ChannelFillerShow } from './entities/ChannelFillerShow.js';
import { FillerListContent } from './entities/FillerListContent.js';
import { FillerShow } from './entities/FillerShow.js';
import {
  createPendingProgramIndexMap,
  upsertContentPrograms,
} from './programHelpers.js';

export class FillerDB {
  private channelCache: ChannelCache;

  constructor(channelCache: ChannelCache) {
    this.channelCache = channelCache;
  }

  getFiller(id: string) {
    return getEm()
      .repo(FillerShow)
      .findOne(id, { populate: ['content.uuid'] });
  }

  async saveFiller(id: string, updateRequest: UpdateFillerListRequest) {
    const em = getEm();
    const filler = await em.repo(FillerShow).findOne({ uuid: id });

    if (isNil(filler)) {
      return null;
    }

    if (updateRequest.programs) {
      const programIndexById = createPendingProgramIndexMap(
        updateRequest.programs,
      );

      const persisted = filter(updateRequest.programs, (p) => p.persisted);

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

      console.log('programs update');
    }

    if (updateRequest.name) {
      console.log('assigning filter');
      em.assign(filler, { name: updateRequest.name });
      em.persist(filler);
    }

    console.log('flushing filler', filler);

    await em.flush();

    return em.findOne(
      FillerShow,
      { uuid: filler.uuid },
      { populate: ['*', 'content.uuid'] },
    );
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

  async deleteFiller(id: string): Promise<void> {
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

  getAllFillerIds() {
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

  async getFillerPrograms(id: string) {
    const programs = await getEm()
      .repo(FillerListContent)
      .find(
        { fillerList: id },
        { populate: ['content'], orderBy: { index: 'DESC' } },
      );

    return programs.map((p) => dbProgramToContentProgram(p.content, true));
  }

  async getFillersFromChannel(
    channelNumber: number,
  ): Promise<Loaded<ChannelFillerShow, 'fillerShow' | 'fillerShow.content'>[]> {
    const em = getEm();
    return await em.find(
      ChannelFillerShow,
      {
        channel: { number: channelNumber },
      },
      { populate: ['fillerShow', 'fillerShow.content'] },
    );
  }
}
