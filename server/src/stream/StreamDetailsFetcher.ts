import { MediaSourceType } from '@/db/schema/base.js';
import { inject, injectable } from 'inversify';
import { match, P } from 'ts-pattern';
import { KEYS } from '../types/inject.ts';
import { Result } from '../types/result.ts';
import { EmbyStreamDetails } from './emby/EmbyStreamDetails.ts';
import {
  ExternalStreamDetailsFetcher,
  StreamFetchRequest,
} from './ExternalStreamDetailsFetcher.ts';
import { JellyfinStreamDetails } from './jellyfin/JellyfinStreamDetails.ts';
import { LocalProgramStreamDetails } from './local/LocalProgramStreamDetails.ts';
import { PlexStreamDetails } from './plex/PlexStreamDetails.ts';
import type { ProgramStreamResult } from './types.ts';

@injectable()
export class ExternalStreamDetailsFetcherFactory extends ExternalStreamDetailsFetcher {
  constructor(
    @inject(KEYS.PlexStreamDetailsFactory)
    private plexStreamDetailsFactory: () => PlexStreamDetails,
    @inject(KEYS.JellyfinStreamDetailsFactory)
    private jellyfinStreamDetailsFactory: () => JellyfinStreamDetails,
    @inject(KEYS.EmbyStreamDetailsFactory)
    private embyStreamDetailsFactory: () => EmbyStreamDetails,
    @inject(LocalProgramStreamDetails)
    private localProgramStreamDetails: LocalProgramStreamDetails,
  ) {
    super();
  }

  getStream(req: StreamFetchRequest): Promise<Result<ProgramStreamResult>> {
    return match(req)
      .with(P.when(isPlexStreamFetch), (plex) =>
        this.plexStreamDetailsFactory().getStream(plex),
      )
      .with(P.when(isJellyfinStreamFetch), (jf) =>
        this.jellyfinStreamDetailsFactory().getStream(jf),
      )
      .with(P.when(isEmbyStreamFetch), (emby) =>
        this.embyStreamDetailsFactory().getStream(emby),
      )
      .with(P.when(isLocalStreamFetch), (local) =>
        this.localProgramStreamDetails.getStream(local),
      )
      .otherwise(() =>
        Promise.resolve(
          Result.failure(
            `Could not get stream details for request: ${JSON.stringify(req)}`,
          ),
        ),
      );
  }
}

function isPlexStreamFetch(
  streamFetch: StreamFetchRequest,
): streamFetch is StreamFetchRequest<typeof MediaSourceType.Plex> {
  return (
    streamFetch.server.type === MediaSourceType.Plex &&
    streamFetch.lineupItem.sourceType === MediaSourceType.Plex
  );
}

function isJellyfinStreamFetch(
  streamFetch: StreamFetchRequest,
): streamFetch is StreamFetchRequest<typeof MediaSourceType.Jellyfin> {
  return (
    streamFetch.server.type === MediaSourceType.Jellyfin &&
    streamFetch.lineupItem.sourceType === MediaSourceType.Jellyfin
  );
}

function isEmbyStreamFetch(
  streamFetch: StreamFetchRequest,
): streamFetch is StreamFetchRequest<typeof MediaSourceType.Emby> {
  return (
    streamFetch.server.type === MediaSourceType.Emby &&
    streamFetch.lineupItem.sourceType === MediaSourceType.Emby
  );
}

function isLocalStreamFetch(
  streamFetch: StreamFetchRequest,
): streamFetch is StreamFetchRequest<typeof MediaSourceType.Local> {
  return (
    streamFetch.server.type === MediaSourceType.Local &&
    streamFetch.lineupItem.sourceType === MediaSourceType.Local
  );
}
