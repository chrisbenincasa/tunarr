import { Loaded } from '@mikro-orm/core';
import { DynamicContentConfigSource } from '@tunarr/types/api';
import { Channel } from '../../dao/entities/Channel';
import { ContentSourceUpdater } from './ContentSourceUpdater';
import { PlexContentSourceUpdater } from './PlexContentSourceUpdater';

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
