import { isNil } from 'lodash-es';
import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import type {
  ExtractEpisodeType,
  MediaSourceApiClient,
} from '../../external/MediaSourceApiClient.ts';
import type { WrappedError } from '../../types/errors.ts';
import { Result } from '../../types/result.ts';
import type { ScanContext } from './MediaSourceScanner.ts';
import { MediaSourceCompatibleTvShowScanner } from './MediaSourceCompatibleTvShowScanner.ts';

/**
 * Shared abstract base for Jellyfin and Emby TV show scanners.
 *
 * Extends MediaSourceCompatibleTvShowScanner (which covers all three sources),
 * adding Jellyfin/Emby-specific behaviour:
 *   - getLibrarySize via getChildItemCount (both sources expose this API)
 *   - getFullEpisodeMetadata with null-check handling (both sources may return
 *     null for a missing episode rather than an error)
 *
 * Subclasses must supply:
 *   - mediaSourceType  – the 'jellyfin' | 'emby' discriminant
 *   - getApiClient     – which factory method to call
 */
export abstract class JellyfinCompatibleTvShowScanner<
  SourceTypeT extends RemoteMediaSourceType,
  ClientT extends MediaSourceApiClient & {
    getChildItemCount(
      parentId: string,
      itemType: string,
    ): Promise<Result<number>>;
  },
> extends MediaSourceCompatibleTvShowScanner<SourceTypeT, ClientT> {
  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<ClientT>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey, 'Series')
      .then((_) => _.getOrThrow());
  }

  protected getFullEpisodeMetadata(
    episodeT: ExtractEpisodeType<ClientT>,
    context: ScanContext<ClientT>,
  ): Promise<Result<ExtractEpisodeType<ClientT>, WrappedError>> {
    return context.apiClient
      .getEpisode(episodeT.externalId)
      .then((_) =>
        _.flatMap((ep) =>
          isNil(ep)
            ? Result.forError(
                new Error(`Episode ID ${episodeT.externalId} not found`),
              )
            : Result.success(ep),
        ),
      );
  }
}
