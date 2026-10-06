import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  countMovieFiles,
  findMovieArtwork,
  folderHoldsSingleMovie,
  folderNameMatchesMovie,
  isVideoFile,
  movieArtworkCandidateGroups,
  type MovieArtworkType,
} from './movieArtworkPaths.ts';

/**
 * #2170 — the short name used to outrank the long name, including across
 * extensions (`poster.jpg` beat `Movie (2020)-poster.png`), which is the
 * reverse of Kodi's documented order.
 * #2171 — the short names are folder-level conventions; gating them behind
 * "the folder is a single movie's folder or is named after the movie" stops a
 * flat folder's one `poster.jpg` from becoming every movie's poster, without
 * stripping a real per-movie folder's artwork because a `sample.mkv`,
 * featurette or second quality version shares the folder.
 */

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-movie-artwork-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function touch(...names: string[]) {
  for (const name of names) {
    await fs.writeFile(path.join(dir, name), '');
  }
}

async function touchIn(sub: string, ...names: string[]) {
  const base = path.join(dir, sub);
  await fs.mkdir(base, { recursive: true });
  for (const name of names) {
    await fs.writeFile(path.join(base, name), '');
  }
  return base;
}

/** What the scanner does: compute Kodi's gate once for the movie, then resolve. */
async function artworkFor(
  movieFilePath: string,
  type: MovieArtworkType = 'poster',
) {
  const folder = path.dirname(movieFilePath);
  const useFolderLevelArtwork =
    (await folderHoldsSingleMovie(folder)) ||
    folderNameMatchesMovie(folder, movieFilePath);
  return findMovieArtwork({
    movieFilePath,
    artworkType: type,
    useFolderLevelArtwork,
  });
}

describe('movieArtworkCandidateGroups', () => {
  test('checks the long name first, then the folder-level names when the gate is open', () => {
    const groups = movieArtworkCandidateGroups({
      movieFilePath: '/movies/Movie (2020).mkv',
      artworkType: 'poster',
      useFolderLevelArtwork: true,
    });

    expect(groups).toEqual([
      [path.join('/movies', 'Movie (2020)-poster')],
      [path.join('/movies', 'poster')],
      [path.join('/movies', 'folder')],
    ]);
  });

  test('skips the folder-level names when the gate is closed', () => {
    const groups = movieArtworkCandidateGroups({
      movieFilePath: '/movies/A.mkv',
      artworkType: 'poster',
      useFolderLevelArtwork: false,
    });

    expect(groups).toEqual([[path.join('/movies', 'A-poster')]]);
  });

  test('never falls back to folder.* for anything but a poster', () => {
    const groups = movieArtworkCandidateGroups({
      movieFilePath: '/movies/Movie/movie.mkv',
      artworkType: 'fanart',
      useFolderLevelArtwork: true,
    });

    expect(groups).toEqual([
      [path.join('/movies/Movie', 'movie-fanart')],
      [path.join('/movies/Movie', 'fanart')],
    ]);
  });
});

describe('isVideoFile', () => {
  test('recognises a known lower-case video extension', () => {
    expect(isVideoFile('Movie.mkv')).toBe(true);
  });

  test('does not match an upper-case extension, exactly as the scanner does not', () => {
    expect(isVideoFile('clip.MP4')).toBe(false);
  });

  test('treats an AppleDouble sidecar as not a video file', () => {
    expect(isVideoFile('._Movie (2020).mkv')).toBe(false);
  });
});

describe('countMovieFiles', () => {
  test('counts only the files the scanner treats as movies', () => {
    expect(
      countMovieFiles([
        'A.mkv',
        'B.MP4',
        '._C.mkv',
        'poster.jpg',
        'movie.nfo',
        'sample.mkv',
      ]),
    ).toBe(2);
  });
});

describe('folderNameMatchesMovie', () => {
  test('is true for a folder named after the movie', () => {
    expect(
      folderNameMatchesMovie(
        '/movies/Matrix (1999)',
        '/movies/Matrix (1999)/Matrix (1999).mkv',
      ),
    ).toBe(true);
  });

  test('is true for two quality versions of the same film in one folder', () => {
    expect(
      folderNameMatchesMovie(
        '/movies/Matrix (1999)',
        '/movies/Matrix (1999)/Matrix (1999)-1080p.mkv',
      ),
    ).toBe(true);
  });

  test('is false for a flat folder', () => {
    expect(folderNameMatchesMovie('/movies', '/movies/A.mkv')).toBe(false);
  });

  test('is false when the file name does not start with the folder name', () => {
    expect(
      folderNameMatchesMovie(
        '/movies/Some Movie',
        '/movies/Some Movie/movie.mkv',
      ),
    ).toBe(false);
  });
});

describe('findMovieArtwork — gate', () => {
  test('a single-movie folder still uses the short name', async () => {
    await touch('movie.mkv', 'poster.jpg');

    await expect(artworkFor(path.join(dir, 'movie.mkv'))).resolves.toBe(
      path.join(dir, 'poster.jpg'),
    );
  });

  test('a flat folder does not share one poster.jpg between movies', async () => {
    await touch('A.mkv', 'B.mkv', 'poster.jpg');

    await expect(artworkFor(path.join(dir, 'A.mkv'))).resolves.toBeUndefined();
    await expect(artworkFor(path.join(dir, 'B.mkv'))).resolves.toBeUndefined();
  });

  test('a flat folder still resolves each movie its own long-name artwork', async () => {
    await touch('A.mkv', 'B.mkv', 'poster.jpg', 'A-poster.jpg');

    await expect(artworkFor(path.join(dir, 'A.mkv'))).resolves.toBe(
      path.join(dir, 'A-poster.jpg'),
    );
    await expect(artworkFor(path.join(dir, 'B.mkv'))).resolves.toBeUndefined();
  });

  test('a per-movie folder with a sample file keeps its poster (name match)', async () => {
    const base = await touchIn(
      'Movie (2020)',
      'Movie (2020).mkv',
      'sample.mkv',
      'poster.jpg',
    );

    await expect(artworkFor(path.join(base, 'Movie (2020).mkv'))).resolves.toBe(
      path.join(base, 'poster.jpg'),
    );
  });

  test('two quality versions of the same film keep their poster', async () => {
    const base = await touchIn(
      'Movie (2020)',
      'Movie (2020)-1080p.mkv',
      'Movie (2020)-720p.mkv',
      'poster.jpg',
    );

    await expect(
      artworkFor(path.join(base, 'Movie (2020)-1080p.mkv')),
    ).resolves.toBe(path.join(base, 'poster.jpg'));
  });

  test('a featurette beside the feature keeps the folder poster', async () => {
    const base = await touchIn(
      'Movie (2020)',
      'Movie (2020).mkv',
      'featurette.mkv',
      'poster.jpg',
    );

    await expect(artworkFor(path.join(base, 'Movie (2020).mkv'))).resolves.toBe(
      path.join(base, 'poster.jpg'),
    );
  });

  test('an AppleDouble sidecar or an upper-case clip does not disable the gate', async () => {
    // Neither `._Movie (2020).mkv` nor `clip.MP4` is a movie file for the
    // scanner, so the folder still holds exactly one movie and the poster
    // applies (#2171).
    const base = await touchIn(
      'Movie (2020)',
      'Movie (2020).mkv',
      '._Movie (2020).mkv',
      'clip.MP4',
      'poster.jpg',
    );

    await expect(artworkFor(path.join(base, 'Movie (2020).mkv'))).resolves.toBe(
      path.join(base, 'poster.jpg'),
    );
  });
});

describe('findMovieArtwork — order', () => {
  test('the long name beats the short name in another extension (#2170)', async () => {
    const base = await touchIn(
      'Movie (2020)',
      'Movie (2020).mkv',
      'Movie (2020)-poster.png',
      'poster.jpg',
    );

    await expect(artworkFor(path.join(base, 'Movie (2020).mkv'))).resolves.toBe(
      path.join(base, 'Movie (2020)-poster.png'),
    );
  });

  test('fanart uses its long name and never folder.*', async () => {
    await touch('movie.mkv', 'folder.jpg', 'movie-fanart.jpg');

    await expect(
      artworkFor(path.join(dir, 'movie.mkv'), 'fanart'),
    ).resolves.toBe(path.join(dir, 'movie-fanart.jpg'));

    await fs.rm(path.join(dir, 'movie-fanart.jpg'));

    await expect(
      artworkFor(path.join(dir, 'movie.mkv'), 'fanart'),
    ).resolves.toBeUndefined();
  });

  test('reports nothing when there is no artwork at all', async () => {
    await touch('movie.mkv');

    await expect(
      artworkFor(path.join(dir, 'movie.mkv')),
    ).resolves.toBeUndefined();
  });

  test('takes the lookup as a parameter, so the order is testable alone', async () => {
    const seen: string[][] = [];
    const found = await findMovieArtwork(
      {
        movieFilePath: '/movies/Movie (2020).mkv',
        artworkType: 'poster',
        useFolderLevelArtwork: true,
      },
      (candidates) => {
        seen.push(candidates);
        return Promise.resolve(undefined);
      },
    );

    expect(found).toBeUndefined();
    expect(seen).toEqual([
      [path.join('/movies', 'Movie (2020)-poster')],
      [path.join('/movies', 'poster')],
      [path.join('/movies', 'folder')],
    ]);
  });
});
