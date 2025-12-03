import type { DynamicContentConfigSource } from '@tunarr/types/api';
import { ContainerModule } from 'inversify';
import type { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { ChannelOrm } from '../../db/schema/Channel.ts';
import { KEYS } from '../../types/inject.ts';
import { bindFactoryFunc } from '../../util/inject.ts';
import type { ContentSourceUpdater } from './ContentSourceUpdater.ts';
import { PlexContentSourceUpdater } from './PlexContentSourceUpdater.ts';

export type ContentSourceUpdaterFactory = (
  channel: ChannelOrm,
  config: DynamicContentConfigSource,
) => ContentSourceUpdater<DynamicContentConfigSource>;

const DynamicChannelsModule = new ContainerModule((bind) => {
  bindFactoryFunc<ContentSourceUpdaterFactory>(
    bind,
    KEYS.ContentSourceUpdateFactory,
    (ctx) => {
      return (channel, config) =>
        ctx.container.getNamed<ContentSourceUpdaterFactory>(
          KEYS.ContentSourceUpdateFactory,
          config.type,
        )(channel, config);
    },
  ).whenTargetIsDefault();

  bindFactoryFunc<ContentSourceUpdaterFactory>(
    bind,
    KEYS.ContentSourceUpdateFactory,
    (ctx) => {
      const channelDB = ctx.container.get<IChannelDB>(KEYS.ChannelDB);
      const programDB = ctx.container.get<IProgramDB>(KEYS.ProgramDB);
      const mediaSourceDB = ctx.container.get(MediaSourceDB);
      return (channel, config) => {
        return new PlexContentSourceUpdater(
          channelDB,
          programDB,
          mediaSourceDB,
          channel,
          config,
        );
      };
    },
  ).whenTargetNamed('plex');
});

export { DynamicChannelsModule };
