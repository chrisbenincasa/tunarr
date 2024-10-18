import { DynamicContentConfigSource } from '@tunarr/types/api';
import { Channel } from '../../dao/direct/schema/Channel';
import { ContentSourceUpdater } from './ContentSourceUpdater';
import { PlexContentSourceUpdater } from './PlexContentSourceUpdater';

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
