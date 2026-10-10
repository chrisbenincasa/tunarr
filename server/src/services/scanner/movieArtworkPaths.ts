import path from 'node:path';
import type { Maybe } from '../../types/util.ts';
import { locateImageFile } from './imageFileLookup.ts';

/**
 * Kodi's documented movie artwork order
 * (https://kodi.wiki/view/Movie_artwork), which this module applies:
 *
 * 1. The long name `<movie file>-<arttype>.<ext>` is the default and wins over
 *    the short name. Long names are compared across EVERY extension before any
 *    short name is considered, so `Movie (2020)-poster.png` beats `poster.jpg`.
 *    Checking extensions and names in one pass cannot express that: the
 *    extension loop runs outermost, which is how a stale `poster.jpg` used to
 *    outrank the file-specific poster the Artwork Dump and the *arr tools
 *    write.
 * 2. The short names (`poster.jpg`, `folder.jpg`) are folder-level conventions
 *    and stay eligible as fallbacks. Whether they should apply only when the
 *    folder holds a single movie (Kodi's "movies are in separate folders that
 *    match the movie title") is tracked in the follow-up that gates them, so it
 *    can be reviewed on its own.
 *
 * The lookup itself stays in `imageFileLookup.ts`: this module only decides
 * which candidate stems to try, in which order.
 */

export type MovieArtworkType = 'poster' | 'fanart' | 'banner' | 'landscape';

export interface MovieArtworkQuery {
  /** Path of the movie file the artwork belongs to. */
  movieFilePath: string;
  artworkType: MovieArtworkType;
}

/**
 * Candidate stems in priority order. Each group is tried across every known
 * image extension before the next group is considered, and the first image
 * found wins.
 */
export function movieArtworkCandidateGroups(
  query: MovieArtworkQuery,
): string[][] {
  const folder = path.dirname(query.movieFilePath);
  const stem = path.basename(
    query.movieFilePath,
    path.extname(query.movieFilePath),
  );

  const groups: string[][] = [
    [path.join(folder, `${stem}-${query.artworkType}`)],
    [path.join(folder, query.artworkType)],
  ];

  if (query.artworkType === 'poster') {
    groups.push([path.join(folder, 'folder')]);
  }

  return groups;
}

/**
 * Finds the artwork for one movie, in `movieArtworkCandidateGroups` order.
 * `lookup` is injectable so the order can be exercised without the filesystem.
 */
export async function findMovieArtwork(
  query: MovieArtworkQuery,
  lookup: (stemPaths: string[]) => Promise<Maybe<string>> = locateImageFile,
): Promise<Maybe<string>> {
  for (const candidates of movieArtworkCandidateGroups(query)) {
    const found = await lookup(candidates);
    if (found) {
      return found;
    }
  }

  return;
}
