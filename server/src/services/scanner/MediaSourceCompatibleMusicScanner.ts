import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type {
  MediaSourceMusicAlbum,
  MediaSourceMusicArtist,
  MediaSourceMusicTrack,
} from '../../types/Media.ts';
import {
  MediaSourceMusicArtistScanner,
  type ProgramTypeMapForMusic,
} from './MediaSourceMusicArtistScanner.ts';
import type { ScanContext } from './MediaSourceScanner.ts';

/**
 * Shared abstract base for music scanners across all media sources (Plex, Jellyfin, Emby).
 *
 * All three sources expose the same MediaSourceApiClient method signatures for
 * retrieving artists, albums, and tracks. This class provides default implementations
 * for all those methods, so concrete subclasses only need to supply:
 *   - mediaSourceType   – the 'plex' | 'jellyfin' | 'emby' discriminant
 *   - getApiClient      – which factory method to call
 *   - getLibrarySize    – Plex uses getLibraryCount; Jellyfin/Emby use getChildItemCount
 */
export abstract class MediaSourceCompatibleMusicScanner<
  SourceTypeT extends RemoteMediaSourceType,
  ArtistT extends MediaSourceMusicArtist,
  AlbumT extends MediaSourceMusicAlbum<ArtistT>,
  TrackT extends MediaSourceMusicTrack<ArtistT, AlbumT>,
  ClientT extends MediaSourceApiClient<
    ProgramTypeMapForMusic<ArtistT, AlbumT, TrackT>
  >,
> extends MediaSourceMusicArtistScanner<
  SourceTypeT,
  ArtistT,
  AlbumT,
  TrackT,
  ClientT
> {
  protected getArtists(
    libraryId: string,
    context: ScanContext<ClientT>,
  ): AsyncIterable<ArtistT> {
    return context.apiClient.getMusicLibraryContents(libraryId, 50);
  }

  protected getAlbums(
    artist: ArtistT,
    context: ScanContext<ClientT>,
  ): AsyncIterable<AlbumT> {
    return context.apiClient.getArtistAlbums(artist.externalId, 50);
  }

  protected getAlbumTracks(
    album: AlbumT,
    context: ScanContext<ClientT>,
  ): AsyncIterable<TrackT> {
    return context.apiClient.getAlbumTracks(album.externalId, 50);
  }

  protected getEntityExternalKey(entity: ArtistT | AlbumT | TrackT): string {
    return entity.externalId;
  }
}
