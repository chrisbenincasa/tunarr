import fs from 'node:fs/promises';
import path from 'node:path';
import type { Maybe } from '../../types/util.ts';
import { KnownVideoFileExtensions } from './constants.ts';
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
 * 2. The short names (`poster.jpg`, `folder.jpg`) are folder-level conventions.
 *    Kodi gates them behind "movies are in separate folders that match the
 *    movie title", so here they are used when the folder holds exactly one
 *    movie file OR is named after the movie. In a flat folder a single
 *    `poster.jpg` would otherwise become the poster of every movie in it.
 *
 * The lookup itself stays in `imageFileLookup.ts`: this module only decides
 * which candidate stems to try, in which order.
 */

export type MovieArtworkType = 'poster' | 'fanart' | 'banner' | 'landscape';

export interface MovieArtworkQuery {
  /** Path of the movie file the artwork belongs to. */
  movieFilePath: string;
  artworkType: MovieArtworkType;
  /**
   * Whether the folder-level short names may apply. This is Kodi's gate
   * (`folderHoldsSingleMovie` OR `folderNameMatchesMovie`), computed once per
   * movie by the caller rather than per artwork type.
   */
  useFolderLevelArtwork: boolean;
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
  ];

  if (!query.useFolderLevelArtwork) {
    return groups;
  }

  groups.push([path.join(folder, query.artworkType)]);
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

/**
 * Whether `name` is a movie file for the local scanner: a known video
 * extension, case-sensitively, that is not an `._` AppleDouble sidecar. Shared
 * so the artwork gate counts exactly the files the library treats as programs
 * (`LocalMovieScanner` skips `._` files and does not match upper-case
 * extensions such as `clip.MP4`).
 */
export function isVideoFile(name: string): boolean {
  const ext = path.extname(name);
  return (
    ext.length > 1 &&
    KnownVideoFileExtensions.has(ext) &&
    !path.basename(name).startsWith('._')
  );
}

/** Number of movie files directly inside a folder list. */
export function countMovieFiles(names: readonly string[]): number {
  return names.filter((name) => isVideoFile(name)).length;
}

/**
 * Reads the folder, rather than caching a verdict on the scanner: a folder
 * that gained or lost a movie file since the last scan must get the current
 * answer, and a stale "single movie" would silently restore the shared
 * `poster.jpg` this change removes.
 */
export async function folderHoldsSingleMovie(folder: string): Promise<boolean> {
  try {
    return countMovieFiles(await fs.readdir(folder)) === 1;
  } catch {
    // An unreadable folder cannot prove it holds one movie, and the long name
    // was already tried by the caller.
    return false;
  }
}

/**
 * Kodi's gate is "movies are in separate folders that match the movie title".
 * A folder holding several video files is still one movie's own folder when it
 * is named after that movie: `Sample Movie (2020)/` with a 1080p and a 720p
 * copy of the same film shares a poster with its twin. The single-file case
 * (`Some Movie/movie.mkv`) is handled by the count; this is the multi-file
 * counterpart.
 */
export function folderNameMatchesMovie(folder: string, movieFilePath: string) {
  const stem = path
    .basename(movieFilePath, path.extname(movieFilePath))
    .toLowerCase();
  const folderName = path.basename(folder).toLowerCase();
  return folderName.length > 0 && stem.startsWith(folderName);
}
