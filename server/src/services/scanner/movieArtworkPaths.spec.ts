import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  countMovieFiles,
  findMovieArtwork,
  folderHoldsSingleMovie,
  movieArtworkCandidateGroups,
  type MovieArtworkType,
} from './movieArtworkPaths.ts';

/**
 * #2170 — the short name used to outrank the long name, including across
 * extensions (`poster.jpg` beat `Movie (2020)-poster.png`), which is the
 * reverse of Kodi's documented order.
 * #2171 — the short names are folder-level conventions: in a flat folder one
 * `poster.jpg` became the poster of every movie in it.
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

/** What the scanner does: read the folder, then resolve in priority order. */
async function artworkFor(
  movieFilePath: string,
  type: MovieArtworkType = 'poster',
) {
  return findMovieArtwork({
    movieFilePath,
    artworkType: type,
    folderHoldsSingleMovie: await folderHoldsSingleMovie(
      path.dirname(movieFilePath),
    ),
  });
}

describe('movieArtworkCandidateGroups', () => {
  test('checks the long name first, then the folder-level names', () => {
    const groups = movieArtworkCandidateGroups({
      movieFilePath: '/movies/Movie (2020).mkv',
      artworkType: 'poster',
      folderHoldsSingleMovie: true,
    });

    expect(groups).toEqual([
      [path.join('/movies', 'Movie (2020)-poster')],
      [path.join('/movies', 'poster')],
      [path.join('/movies', 'folder')],
    ]);
  });

  test('drops the folder-level names in a flat folder', () => {
    const groups = movieArtworkCandidateGroups({
      movieFilePath: '/movies/A.mkv',
      artworkType: 'poster',
      folderHoldsSingleMovie: false,
    });

    expect(groups).toEqual([[path.join('/movies', 'A-poster')]]);
  });

  test('never falls back to folder.* for anything but a poster', () => {
    const groups = movieArtworkCandidateGroups({
      movieFilePath: '/movies/Movie/movie.mkv',
      artworkType: 'fanart',
      folderHoldsSingleMovie: true,
    });

    expect(groups).toEqual([
      [path.join('/movies/Movie', 'movie-fanart')],
      [path.join('/movies/Movie', 'fanart')],
    ]);
  });
});

describe('countMovieFiles', () => {
  test('counts video files only, ignoring any case', () => {
    expect(
      countMovieFiles([
        'A.mkv',
        'B.MP4',
        'poster.jpg',
        'movie.nfo',
        'subs.srt',
        'README',
        'extras',
      ]),
    ).toBe(2);
  });
});

describe('folderHoldsSingleMovie', () => {
  test('is true for a movie folder', async () => {
    await touch('movie.mkv', 'poster.jpg', 'movie.nfo');

    await expect(folderHoldsSingleMovie(dir)).resolves.toBe(true);
  });

  test('is false for a flat folder', async () => {
    await touch('A.mkv', 'B.mkv', 'poster.jpg');

    await expect(folderHoldsSingleMovie(dir)).resolves.toBe(false);
  });

  test('is false when the folder cannot be read', async () => {
    await expect(
      folderHoldsSingleMovie(path.join(dir, 'missing')),
    ).resolves.toBe(false);
  });
});

describe('findMovieArtwork', () => {
  test('a flat folder no longer shares one poster.jpg between movies', async () => {
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

  test('the long name beats the short name in another extension', async () => {
    await touch('Movie (2020).mkv', 'Movie (2020)-poster.png', 'poster.jpg');

    await expect(artworkFor(path.join(dir, 'Movie (2020).mkv'))).resolves.toBe(
      path.join(dir, 'Movie (2020)-poster.png'),
    );
  });

  test('a movie folder still uses the short name', async () => {
    await touch('movie.mkv', 'poster.jpg');

    await expect(artworkFor(path.join(dir, 'movie.mkv'))).resolves.toBe(
      path.join(dir, 'poster.jpg'),
    );
  });

  test('folder.jpg applies to a movie folder but not to a flat folder', async () => {
    await touch('movie.mkv', 'folder.jpg');

    await expect(artworkFor(path.join(dir, 'movie.mkv'))).resolves.toBe(
      path.join(dir, 'folder.jpg'),
    );

    // Same folder.jpg, now next to a second movie: it belongs to no movie in
    // particular, so it applies to neither.
    await touch('other.mkv');

    await expect(
      artworkFor(path.join(dir, 'movie.mkv')),
    ).resolves.toBeUndefined();
    await expect(
      artworkFor(path.join(dir, 'other.mkv')),
    ).resolves.toBeUndefined();
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
        movieFilePath: '/movies/A.mkv',
        artworkType: 'poster',
        folderHoldsSingleMovie: false,
      },
      (candidates) => {
        seen.push(candidates);
        return Promise.resolve(undefined);
      },
    );

    expect(found).toBeUndefined();
    expect(seen).toEqual([[path.join('/movies', 'A-poster')]]);
  });
});
