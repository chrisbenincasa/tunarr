import type { EmbyItem } from '@tunarr/types/emby';
import type { JellyfinItem } from '@tunarr/types/jellyfin';
import type { PlexMedia } from '@tunarr/types/plex';
import { ContainerModule } from 'inversify';
import type { Canonicalizer } from '../services/Canonicalizer.ts';
import { KEYS } from '../types/inject.ts';
import { bindFactoryFunc } from '../util/inject.ts';
import type { ApiClientOptions } from './BaseApiClient.js';
import { EmbyApiClient } from './emby/EmbyApiClient.ts';
import { JellyfinApiClient } from './jellyfin/JellyfinApiClient.ts';
import { PlexApiClient } from './plex/PlexApiClient.ts';

export const ExternalApiModule = new ContainerModule(({ bind }) => {
  bindFactoryFunc<PlexApiClient, [ApiClientOptions]>(
    bind,
    KEYS.PlexApiClientFactory,
    (ctx) => {
      return (opts) =>
        new PlexApiClient(
          ctx.get<Canonicalizer<PlexMedia>>(KEYS.PlexCanonicalizer),
          opts,
        );
    },
  );

  bindFactoryFunc<JellyfinApiClient, [ApiClientOptions]>(
    bind,
    KEYS.JellyfinApiClientFactory,
    (ctx) => {
      return (opts) =>
        new JellyfinApiClient(
          ctx.get<Canonicalizer<JellyfinItem>>(KEYS.JellyfinCanonicalizer),
          opts,
        );
    },
  );

  bindFactoryFunc<EmbyApiClient, [ApiClientOptions]>(
    bind,
    KEYS.EmbyApiClientFactory,
    (ctx) => {
      return (opts) =>
        new EmbyApiClient(
          ctx.get<Canonicalizer<EmbyItem>>(KEYS.EmbyCanonicalizer),
          opts,
        );
    },
  );
});
