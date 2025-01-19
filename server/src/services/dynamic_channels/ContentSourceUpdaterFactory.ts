import { Channel } from '@/db/schema/Channel.js';
import { DynamicContentConfigSource } from '@tunarr/types/api';
import { ContentSourceUpdater } from './ContentSourceUpdater.ts';
import { PlexContentSourceUpdater } from './PlexContentSourceUpdater.ts';

export class ContentSourceUpdaterFactory {
  static getUpdater(
    channel: Channel,
    config: DynamicContentConfigSource,
  ): ContentSourceUpdater<DynamicContentConfigSource> {
    switch (config.type) {
      case 'plex':
        return new PlexContentSourceUpdater(channel, config);
    }
  }
}
