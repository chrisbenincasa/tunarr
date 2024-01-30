import { Loaded } from '@mikro-orm/core';
import { CreateFillerListRequest } from '@tunarr/types/api';
import { filter, map } from 'lodash-es';
import { ChannelCache } from '../channelCache.js';
import { getEm } from './dataSource.js';
import { Channel as ChannelEntity } from './entities/Channel.js';
import { ChannelFillerShow } from './entities/ChannelFillerShow.js';
import { FillerListContent } from './entities/FillerListContent.js';
import { FillerShow } from './entities/FillerShow.js';
import {
  createPendingProgramIndexMap,
  upsertContentPrograms,
} from './programHelpers.js';
import { dbProgramToContentProgram } from './converters/programConverters.js';

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

  async saveFiller(filler: FillerShow): Promise<void> {
    const programIds = filler.content?.map((program) => program.uuid) ?? [];
    const em = getEm();
    await em.repo(FillerShow).upsert({
      uuid: filler.uuid,
      name: filler.name,
      content: programIds,
    });
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

    await em.persist(filler).flush();

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
      .findAll({ populate: ['content.uuid'] });
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
