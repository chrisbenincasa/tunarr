import { DynamicContentConfigSource } from '@tunarr/types/api';
import { Channel } from '../../dao/direct/schema/Channel.ts';
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
