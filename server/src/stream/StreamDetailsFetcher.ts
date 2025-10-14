import { MediaSourceType } from '@/db/schema/base.js';
import {
  SpecificMediaSourceType,
  SpecificProgramSourceOrmType,
} from '@/db/schema/derivedTypes.js';
import { inject, injectable } from 'inversify';
import { match, P } from 'ts-pattern';
import type { StreamLineupProgram } from '../db/derived_types/StreamLineup.ts';
import { KEYS } from '../types/inject.ts';
import type { Nullable } from '../types/util.ts';
import { EmbyStreamDetails } from './emby/EmbyStreamDetails.ts';
import { JellyfinStreamDetails } from './jellyfin/JellyfinStreamDetails.ts';
import { PlexStreamDetails } from './plex/PlexStreamDetails.ts';
import type { ProgramStreamResult } from './types.ts';

export type StreamFetchRequest<Typ extends MediaSourceType = MediaSourceType> =
  {
    server: SpecificMediaSourceType<Typ>;
    lineupItem: SpecificProgramSourceOrmType<Typ, StreamLineupProgram>;
  };

export interface StreamDetailsFetcher<RequestType> {
  getStream(request: RequestType): Promise<Nullable<ProgramStreamResult>>;
}

export abstract class ExternalStreamDetailsFetcher<
  Typ extends MediaSourceType = MediaSourceType,
> implements StreamDetailsFetcher<StreamFetchRequest<Typ>>
{
  abstract getStream(
    request: StreamFetchRequest<Typ>,
  ): Promise<Nullable<ProgramStreamResult>>;
}

@injectable()
export class ExternalStreamDetailsFetcherFactory extends ExternalStreamDetailsFetcher {
  constructor(
    @inject(KEYS.PlexStreamDetailsFactory)
    private plexStreamDetailsFactory: () => PlexStreamDetails,
    @inject(KEYS.JellyfinStreamDetailsFactory)
    private jellyfinStreamDetailsFactory: () => JellyfinStreamDetails,
    @inject(KEYS.EmbyStreamDetailsFactory)
    private embyStreamDetailsFactory: () => EmbyStreamDetails,
  ) {
    super();
  }

  getStream(req: StreamFetchRequest): Promise<Nullable<ProgramStreamResult>> {
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
      .otherwise(() => Promise.resolve(null));
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
