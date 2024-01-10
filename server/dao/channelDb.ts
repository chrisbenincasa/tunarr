import { Loaded, QueryOrder } from '@mikro-orm/core';
import {
  ChannelProgram,
  ContentProgram,
  FlexProgram,
  RedirectProgram,
  UpdateChannelRequest,
} from 'dizquetv-types';
import { chain, isNil, isNull } from 'lodash-es';
import { Low } from 'lowdb';
import { JSONPreset } from 'lowdb/node';
import { join } from 'path';
import { globalOptions } from '../globals.js';
import { Nullable } from '../types.js';
import { getEm } from './dataSource.js';
import {
  ContentItem,
  Lineup,
  LineupItem,
  OfflineItem,
  isOfflineItem,
  isRedirectItem,
} from './derived_types/Lineup.js';
import { Channel } from './entities/Channel.js';
import { ProgramType } from './entities/Program.js';

export class ChannelDB {
  private fileDbCache: Record<number, Low<Lineup>> = {};

  getChannel(channelNumber: number): Promise<Nullable<Channel>> {
    return getEm().repo(Channel).findOne({ number: channelNumber });
  }

  getChannelAndPrograms(number: number) {
    return getEm()
      .repo(Channel)
      .findOne({ number }, { populate: ['programs'] });
  }

  async saveChannel(channel: UpdateChannelRequest) {
    const em = getEm();
    const existing = await em.findOne(Channel, { number: channel.number });
    if (!isNull(existing)) {
      throw new Error(
        `Channel with number ${channel.number} already exists: ${existing.name}`,
      );
    }

    const entity = em.create(Channel, { ...channel });
    em.persist(entity);
    await this.createLineup(entity.number);
    await em.flush();
    return entity.uuid;
  }

  async updateChannel(id: string, channel: UpdateChannelRequest) {
    const em = getEm();
    await em.nativeUpdate(Channel, { uuid: id }, channel);
    await em.flush();
  }

  async deleteChannel(channelNumber: number) {
    const em = getEm();
    await em.repo(Channel).nativeDelete({ number: channelNumber });
    await em.flush();
  }

  async getAllChannelNumbers() {
    const channels = await getEm().findAll(Channel, {
      fields: ['number'],
      orderBy: { number: QueryOrder.DESC },
    });
    return channels.map((channel) => channel.number);
  }

  async getAllChannels() {
    return getEm().repo(Channel).findAll();
  }

  async getAllChannelsAndPrograms() {
    return getEm()
      .repo(Channel)
      .findAll({ populate: ['programs'] });
  }

  async loadLineup(channelNumber: number) {
    const db = await this.getFileDb(channelNumber);
    return db.data;
  }

  async loadAndMaterializeLineup(channelNumber: number) {
    const channel = await this.getChannelAndPrograms(channelNumber);
    if (isNil(channel)) {
      return null;
    }

    const lineup = await this.loadLineup(channelNumber);

    return buildApiLineup(channel, lineup.items);
  }

  async saveLineup(channelNumber: number, lineup: Lineup) {
    const db = await this.getFileDb(channelNumber);
    db.data = lineup;
    return await db.write();
  }

  private async createLineup(channelNumber: number) {
    const db = await this.getFileDb(channelNumber);
    await db.write();
  }

  private async getFileDb(channel: number) {
    if (!this.fileDbCache[channel]) {
      this.fileDbCache[channel] = await JSONPreset<Lineup>(
        join(globalOptions().database, `channel-lineups/${channel}.json`),
        { items: [] },
      );
      await this.fileDbCache[channel].read();
    }

    return this.fileDbCache[channel];
  }
}

export function buildApiLineup(
  channel: Loaded<Channel, 'programs'>,
  lineup: LineupItem[],
) {
  const baseItem: Partial<ChannelProgram> = {
    persisted: true,
  };

  return chain(lineup)
    .map((p) => {
      if (isOfflineItem(p)) {
        return offlineLineupItemToProgram(channel, p);
      } else if (isRedirectItem(p)) {
        // TODO: Materialize the redirected program???
        return {
          ...baseItem,
          type: 'redirect',
          channel: p.channel,
        } as RedirectProgram;
      } else {
        return contentLineupItemToProgram(channel, p);
      }
    })
    .compact()
    .value();
}

function offlineLineupItemToProgram(
  channel: Loaded<Channel>,
  p: OfflineItem,
  persisted: boolean = true,
): FlexProgram {
  return {
    persisted,
    type: 'flex',
    icon: channel.icon?.path,
    duration: p.durationMs,
  };
}

function contentLineupItemToProgram(
  channel: Loaded<Channel, 'programs'>,
  p: ContentItem,
  persisted: boolean = true,
): ContentProgram | null {
  const program = channel.programs.find((x) => x.uuid === p.id);
  if (isNil(program)) {
    return null;
  }

  return {
    persisted,
    summary: program.summary,
    date: program.originalAirDate,
    rating: program.rating,
    icon: program.showIcon ?? program.episodeIcon ?? program.icon,
    title: program.showTitle ?? program.title,
    duration: program?.duration,
    type: 'content',
    id: program.uuid,
    subtype: program.type,
    seasonNumber:
      program.type === ProgramType.Episode ? program.season : undefined,
    episodeNumber:
      program.type === ProgramType.Episode ? program.episode : undefined,
    episodeTitle:
      program.type === ProgramType.Episode ? program.title : undefined,
  };
}
