import type { ProgramGrouping } from '@tunarr/types';
import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import type {
  ExtractEpisodeType,
  ExtractSeasonType,
  ExtractShowType,
  MediaSourceApiClient,
} from '../../external/MediaSourceApiClient.ts';
import type { WrappedError } from '../../types/errors.ts';
import type { SeasonWithShow } from '../../types/Media.ts';
import type { Result } from '../../types/result.ts';
import type { ScanContext } from './MediaSourceScanner.ts';
import { MediaSourceTvShowLibraryScanner } from './MediaSourceTvShowLibraryScanner.ts';

/**
 * Shared abstract base for TV show scanners across all media sources (Plex, Jellyfin, Emby).
 *
 * All three sources expose the same MediaSourceApiClient method signatures for
 * retrieving shows, seasons, and episodes. This class provides default implementations
 * for all those methods, so concrete subclasses only need to supply:
 *   - mediaSourceType   – the 'plex' | 'jellyfin' | 'emby' discriminant
 *   - getApiClient      – which factory method to call
 *   - getLibrarySize    – Plex uses getLibraryCount; Jellyfin/Emby use getChildItemCount
 *
 * Subclasses may override:
 *   - getFullEpisodeMetadata – Jellyfin/Emby add null-check handling for missing episodes
 */
export abstract class MediaSourceCompatibleTvShowScanner<
  SourceTypeT extends RemoteMediaSourceType,
  ClientT extends MediaSourceApiClient,
> extends MediaSourceTvShowLibraryScanner<
  SourceTypeT,
  ClientT,
  ExtractShowType<ClientT>,
  ExtractSeasonType<ClientT>,
  ExtractEpisodeType<ClientT>
> {
  protected getTvShowLibraryContents(
    libraryId: string,
    context: ScanContext<ClientT>,
  ): AsyncIterable<ExtractShowType<ClientT>> {
    return context.apiClient.getTvShowLibraryContents(libraryId);
  }

  protected getTvShowSeasons(
    show: ExtractShowType<ClientT>,
    context: ScanContext<ClientT>,
  ): AsyncIterable<ExtractSeasonType<ClientT>> {
    return context.apiClient.getShowSeasons(show.externalId);
  }

  protected getSeasonEpisodes(
    season: SeasonWithShow<
      ExtractSeasonType<ClientT>,
      ExtractShowType<ClientT>
    >,
    context: ScanContext<ClientT>,
  ): AsyncIterable<ExtractEpisodeType<ClientT>> {
    return context.apiClient.getSeasonEpisodes(
      season.show.externalId,
      season.externalId,
    );
  }

  protected getFullEpisodeMetadata(
    episodeT: ExtractEpisodeType<ClientT>,
    context: ScanContext<ClientT>,
  ): Promise<Result<ExtractEpisodeType<ClientT>, WrappedError>> {
    return context.apiClient.getEpisode(
      episodeT.externalId,
    ) as unknown as Promise<Result<ExtractEpisodeType<ClientT>, WrappedError>>;
  }

  protected getFullTvShowMetadata(
    externalId: string,
    context: ScanContext<ClientT>,
  ): Promise<Result<ExtractShowType<ClientT>, WrappedError>> {
    return context.apiClient.getShow(externalId) as unknown as Promise<
      Result<ExtractShowType<ClientT>, WrappedError>
    >;
  }

  protected getFullTvSeasonMetadata(
    externalId: string,
    context: ScanContext<ClientT>,
  ): Promise<Result<ExtractSeasonType<ClientT>, WrappedError>> {
    return context.apiClient.getSeason(externalId) as unknown as Promise<
      Result<ExtractSeasonType<ClientT>, WrappedError>
    >;
  }

  protected getEntityExternalKey(
    show:
      | ExtractShowType<ClientT>
      | ExtractSeasonType<ClientT>
      | ExtractEpisodeType<ClientT>,
  ): string {
    return show.externalId;
  }

  protected isShowT(
    grouping: ProgramGrouping,
  ): grouping is ExtractShowType<ClientT> {
    return (
      grouping.sourceType === this.mediaSourceType && grouping.type === 'show'
    );
  }

  protected isSeasonT(
    grouping: ProgramGrouping,
  ): grouping is ExtractSeasonType<ClientT> {
    return (
      grouping.sourceType === this.mediaSourceType && grouping.type === 'season'
    );
  }
}
