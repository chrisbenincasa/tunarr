import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import type {
  MediaSourceMusicAlbum,
  MediaSourceMusicArtist,
  MediaSourceMusicTrack,
} from '../../types/Media.ts';
import type { Result } from '../../types/result.ts';
import type { ProgramTypeMapForMusic } from './MediaSourceMusicArtistScanner.ts';
import { MediaSourceCompatibleMusicScanner } from './MediaSourceCompatibleMusicScanner.ts';
import type { ScanContext } from './MediaSourceScanner.ts';

/**
 * Shared abstract base for Jellyfin and Emby music scanners.
 *
 * Extends MediaSourceCompatibleMusicScanner (which covers all three sources),
 * adding Jellyfin/Emby-specific behaviour:
 *   - getLibrarySize via getChildItemCount (both sources expose this API)
 *
 * Subclasses must supply:
 *   - mediaSourceType  – the 'jellyfin' | 'emby' discriminant
 *   - getApiClient     – which factory method to call
 */
export abstract class JellyfinCompatibleMusicScanner<
  SourceTypeT extends RemoteMediaSourceType,
  ArtistT extends MediaSourceMusicArtist,
  AlbumT extends MediaSourceMusicAlbum<ArtistT>,
  TrackT extends MediaSourceMusicTrack<ArtistT, AlbumT>,
  ClientT extends MediaSourceApiClient<
    ProgramTypeMapForMusic<ArtistT, AlbumT, TrackT>
  > & {
    getChildItemCount(
      parentId: string,
      itemType: string,
    ): Promise<Result<number>>;
  },
> extends MediaSourceCompatibleMusicScanner<
  SourceTypeT,
  ArtistT,
  AlbumT,
  TrackT,
  ClientT
> {
  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<ClientT>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey, 'MusicArtist')
      .then((_) => _.getOrThrow());
  }
}
