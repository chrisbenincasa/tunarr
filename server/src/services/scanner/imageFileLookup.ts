import fs from 'node:fs/promises';
import path from 'node:path';
import type { Maybe } from '../../types/util.ts';
import {
  KnownImageFileExtensions,
  KnownVideoFileExtensions,
} from './constants.ts';

/**
 * True for a file the movie scanner scans as a movie: a known video extension,
 * and not a macOS sidecar. The scanner uses this too, so the artwork gate below
 * and the library cannot disagree about what counts as a movie.
 */
export function isMovieVideoFile(name: string): boolean {
  return (
    KnownVideoFileExtensions.has(path.extname(name)) &&
    !path.basename(name).startsWith('._')
  );
}

/**
 * True when the folder a movie sits in is a movie folder, which is what makes
 * the short artwork names unambiguous:
 *
 * - it holds exactly one movie, or
 * - it is named after the movie, which keeps short names working where the
 *   folder holds more than one video file: two quality versions of the same
 *   film, or the feature plus its extras.
 *
 * A flat library folder satisfies neither -- its name is the library's and it
 * holds many movies -- so a single `poster.jpg` there would otherwise become
 * the poster of every movie in it (#2171).
 */
export function isMovieFolder(params: {
  moviePath: string;
  videoFileNames: readonly string[];
}): boolean {
  const { moviePath, videoFileNames } = params;
  return (
    videoFileNames.filter(isMovieVideoFile).length === 1 ||
    folderNameMatchesMovie(path.dirname(moviePath), moviePath)
  );
}

/**
 * Kodi's gate is "movies are in separate folders that match the movie title".
 * The movie-specific names carry the quality tag, so a version suffix on the
 * file (`Movie (2020) Bluray-1080p.mkv`) still belongs to the folder.
 */
export function folderNameMatchesMovie(
  folder: string,
  movieFilePath: string,
): boolean {
  const stem = normalizeFolderName(
    path.basename(movieFilePath, path.extname(movieFilePath)),
  );
  const folderName = normalizeFolderName(path.basename(folder));
  return folderName.length > 0 && stem.startsWith(folderName);
}

/** Case and spacing carry no meaning in a folder-to-movie name comparison. */
function normalizeFolderName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Finds image files by extension-less path, matching the extension
 * case-insensitively so `poster.JPG` satisfies a lookup for `poster.jpg`. The
 * rest of the name still matches exactly.
 *
 * Each directory is read once per lookup instance.
 */
export function imageFileLookup() {
  const byDir = new Map<string, Promise<Map<string, string>>>();

  return async (stemPath: string, ext: string): Promise<Maybe<string>> => {
    const dir = path.dirname(stemPath);
    let index = byDir.get(dir);
    if (!index) {
      index = indexImageFiles(dir);
      byDir.set(dir, index);
    }
    return (await index).get(`${path.basename(stemPath)}.${ext}`);
  };
}

/**
 * Tries each extension in `KnownImageFileExtensions` order against every stem,
 * and returns the first image found.
 */
export async function locateImageFile(
  stemPaths: string[],
): Promise<Maybe<string>> {
  const lookup = imageFileLookup();
  for (const ext of KnownImageFileExtensions) {
    for (const stemPath of stemPaths) {
      const found = await lookup(stemPath, ext);
      if (found) {
        return found;
      }
    }
  }
  return;
}

/**
 * Finds a movie's artwork in Kodi order. `<movie>-<name>` wins in any
 * extension, then `<name>`, then `folder` for posters only. Each name gets its
 * own lookup because `locateImageFile` tries extensions before stems.
 *
 * The short names are folder conventions, not movie ones, so a caller that
 * knows the folder is not a movie folder passes `allowShortNames: false` and
 * only the movie-specific name is looked up (#2171).
 */
export async function locateMovieArtwork(
  moviePath: string,
  name: string,
  opts?: { allowShortNames?: boolean },
): Promise<Maybe<string>> {
  const allowShortNames = opts?.allowShortNames ?? true;
  const folder = path.dirname(moviePath);
  const stem = path.basename(moviePath, path.extname(moviePath));

  const found =
    (await locateImageFile([path.join(folder, `${stem}-${name}`)])) ??
    (allowShortNames
      ? await locateImageFile([path.join(folder, name)])
      : undefined);
  if (found || !allowShortNames || name !== 'poster') {
    return found;
  }

  return locateImageFile([path.join(folder, 'folder')]);
}

/**
 * Turns `jpg` into `[jJ][pP][gG]` so a glob matches the extension in any case.
 */
export function caseInsensitiveExtensionGlob(ext: string) {
  return [...ext].map((c) => `[${c.toLowerCase()}${c.toUpperCase()}]`).join('');
}

async function indexImageFiles(dir: string): Promise<Map<string, string>> {
  const index = new Map<string, string>();

  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return index;
  }

  for (const name of names) {
    const ext = path.extname(name);
    const normalizedExt = ext.slice(1).toLowerCase();
    if (!KnownImageFileExtensions.has(normalizedExt)) {
      continue;
    }

    // An exact-case file wins over a differently cased duplicate.
    const key = `${name.slice(0, -ext.length)}.${normalizedExt}`;
    if (!index.has(key) || name === key) {
      index.set(key, path.join(dir, name));
    }
  }

  return index;
}
