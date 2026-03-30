import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type { HasMediaSourceInfo, OtherVideo } from '../../types/Media.ts';
import type { Result } from '../../types/result.ts';
import { MediaSourceOtherVideoScanner } from './MediaSourceOtherVideoScanner.ts';
import type { ScanContext } from './MediaSourceScanner.ts';

/**
 * Shared abstract base for Jellyfin and Emby OtherVideo scanners.
 *
 * Both sources use the same API shape (getChildItemCount, getOtherVideoLibraryContents,
 * getOtherVideo), so this class provides a single implementation instead of duplicating
 * it across the two concrete scanner classes.
 *
 * Subclasses must supply:
 *   - mediaSourceType  – the 'jellyfin' | 'emby' discriminant
 *   - getApiClient     – which factory method to call
 */
export abstract class JellyfinCompatibleOtherVideoScanner<
  SourceTypeT extends RemoteMediaSourceType,
  OtherVideoTypeT extends OtherVideo & HasMediaSourceInfo,
  ClientT extends MediaSourceApiClient & {
    getChildItemCount(
      parentId: string,
      itemType: string,
    ): Promise<Result<number>>;
    getOtherVideoLibraryContents(
      parentId: string,
      pageSize?: number,
    ): AsyncIterable<OtherVideoTypeT>;
    getOtherVideo(key: string): Promise<Result<OtherVideoTypeT>>;
  },
> extends MediaSourceOtherVideoScanner<SourceTypeT, ClientT, OtherVideoTypeT> {
  protected getVideos(
    libraryId: string,
    context: ScanContext<ClientT>,
  ): AsyncIterable<OtherVideoTypeT> {
    return context.apiClient.getOtherVideoLibraryContents(libraryId);
  }

  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<ClientT>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey, 'Video')
      .then((_) => _.getOrThrow());
  }

  protected scanVideo(
    context: ScanContext<ClientT>,
    incomingVideo: OtherVideoTypeT,
  ): Promise<Result<OtherVideoTypeT>> {
    return context.apiClient.getOtherVideo(
      incomingVideo.externalId,
    ) as unknown as Promise<Result<OtherVideoTypeT>>;
  }

  protected getExternalKey(video: OtherVideoTypeT): string {
    return video.externalId;
  }
}
