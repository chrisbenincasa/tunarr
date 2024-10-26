import { Loaded } from '@mikro-orm/core';
import { DynamicContentConfigSource } from '@tunarr/types/api';
import { Channel } from '../../dao/entities/Channel.ts';
import { ContentSourceUpdater } from './ContentSourceUpdater.ts';
import { PlexContentSourceUpdater } from './PlexContentSourceUpdater.ts';

export class ContentSourceUpdaterFactory {
  static getUpdater(
    channel: Loaded<Channel>,
    config: DynamicContentConfigSource,
  ): ContentSourceUpdater<DynamicContentConfigSource> {
    switch (config.type) {
      case 'plex':
        return new PlexContentSourceUpdater(channel, config);
    }
  }
}
