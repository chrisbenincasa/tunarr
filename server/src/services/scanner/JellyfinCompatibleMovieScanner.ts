import type { MediaSourceApiClient } from '../../external/MediaSourceApiClient.ts';
import type { RemoteMediaSourceType } from '../../db/schema/MediaSource.ts';
import type { Movie, HasMediaSourceInfo } from '../../types/Media.ts';
import type { Result } from '../../types/result.ts';
import { MediaSourceMovieLibraryScanner } from './MediaSourceMovieLibraryScanner.ts';
import type { ScanContext } from './MediaSourceScanner.ts';

/**
 * Shared abstract base for Jellyfin and Emby movie scanners.
 * Both sources use the same API shape (getChildItemCount, getMovieLibraryContents,
 * getMovie), so this class provides a single implementation instead of duplicating
 * it across the two concrete scanner classes.
 */
export abstract class JellyfinCompatibleMovieScanner<
  SourceTypeT extends RemoteMediaSourceType,
  ClientT extends MediaSourceApiClient & {
    getChildItemCount(
      parentId: string,
      itemType: string,
    ): Promise<Result<number>>;
  },
  MovieT extends Movie & HasMediaSourceInfo,
> extends MediaSourceMovieLibraryScanner<SourceTypeT, ClientT, MovieT> {
  protected getLibrarySize(
    libraryKey: string,
    context: ScanContext<ClientT>,
  ): Promise<number> {
    return context.apiClient
      .getChildItemCount(libraryKey, 'Movie')
      .then((_) => _.getOrThrow());
  }

  protected getLibraryContents(
    libraryKey: string,
    context: ScanContext<ClientT>,
  ): AsyncIterable<MovieT> {
    // Safe: the concrete client returns MovieT items; base type is the wider Movie
    return context.apiClient.getMovieLibraryContents(
      libraryKey,
    ) as AsyncIterable<MovieT>;
  }

  protected async scanMovie(
    { apiClient }: ScanContext<ClientT>,
    apiMovie: MovieT,
  ): Promise<Result<MovieT>> {
    const fullMetadataResult = await apiClient.getMovie(apiMovie.externalId);
    if (fullMetadataResult.isFailure()) {
      throw fullMetadataResult.error;
    }
    return fullMetadataResult.map((fullMovie) => {
      if (!fullMovie) {
        throw new Error(`Movie (ID = ${apiMovie.externalId}) not found`);
      }
      // Safe: at runtime the client returns the concrete MovieT
      return fullMovie as MovieT;
    });
  }
}
