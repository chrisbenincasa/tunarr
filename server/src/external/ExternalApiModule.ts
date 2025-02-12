import type { EmbyItem } from '@tunarr/types/emby';
import type { JellyfinItem } from '@tunarr/types/jellyfin';
import type { PlexMedia } from '@tunarr/types/plex';
import { ContainerModule } from 'inversify';
import type { Canonicalizer } from '../services/Canonicalizer.ts';
import { KEYS } from '../types/inject.ts';
import { bindFactoryFunc } from '../util/inject.ts';
import type { MediaSourceApiClientFactory } from './MediaSourceApiClient.ts';
import { EmbyApiClient } from './emby/EmbyApiClient.ts';
import { JellyfinApiClient } from './jellyfin/JellyfinApiClient.ts';
import type { PlexApiClientFactory } from './plex/PlexApiClient.ts';
import { PlexApiClient } from './plex/PlexApiClient.ts';

export const ExternalApiModule = new ContainerModule((bind) => {
  bindFactoryFunc<PlexApiClientFactory>(
    bind,
    KEYS.PlexApiClientFactory,
    (ctx) => {
      return (opts) =>
        new PlexApiClient(
          ctx.container.get<Canonicalizer<PlexMedia>>(KEYS.PlexCanonicalizer),
          opts,
        );
    },
  );

  bindFactoryFunc<MediaSourceApiClientFactory<JellyfinApiClient>>(
    bind,
    KEYS.JellyfinApiClientFactory,
    (ctx) => {
      return (opts) =>
        new JellyfinApiClient(
          ctx.container.get<Canonicalizer<JellyfinItem>>(
            KEYS.JellyfinCanonicalizer,
          ),
          opts,
        );
    },
  );

  bindFactoryFunc<MediaSourceApiClientFactory<EmbyApiClient>>(
    bind,
    KEYS.EmbyApiClientFactory,
    (ctx) => {
      return (opts) =>
        new EmbyApiClient(
          ctx.container.get<Canonicalizer<EmbyItem>>(KEYS.EmbyCanonicalizer),
          opts,
        );
    },
  );
});
