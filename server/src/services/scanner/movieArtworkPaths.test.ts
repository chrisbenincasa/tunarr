import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  findMovieArtwork,
  movieArtworkCandidateGroups,
  type MovieArtworkType,
} from './movieArtworkPaths.ts';

/**
 * #2170 — the short name used to outrank the long name, including across
 * extensions (`poster.jpg` beat `Movie (2020)-poster.png`), which is the
 * reverse of Kodi's documented order. This PR only re-prioritises the
 * candidates: the candidate set is unchanged, so nothing on disk can stop
 * being picked up. Gating the folder-level short names behind "a single movie
 * folder" is a separate follow-up.
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

describe('movieArtworkCandidateGroups', () => {
  test('checks the long name first, then the folder-level names', () => {
    const groups = movieArtworkCandidateGroups({
      movieFilePath: '/movies/Movie (2020).mkv',
      artworkType: 'poster',
    });

    expect(groups).toEqual([
      [path.join('/movies', 'Movie (2020)-poster')],
      [path.join('/movies', 'poster')],
      [path.join('/movies', 'folder')],
    ]);
  });

  test('never falls back to folder.* for anything but a poster', () => {
    const groups = movieArtworkCandidateGroups({
      movieFilePath: '/movies/Movie/movie.mkv',
      artworkType: 'fanart',
    });

    expect(groups).toEqual([
      [path.join('/movies/Movie', 'movie-fanart')],
      [path.join('/movies/Movie', 'fanart')],
    ]);
  });
});

describe('findMovieArtwork', () => {
  test('the long name beats the short name in another extension (#2170)', async () => {
    await touch('Movie (2020).mkv', 'Movie (2020)-poster.png', 'poster.jpg');

    await expect(
      findMovieArtwork({
        movieFilePath: path.join(dir, 'Movie (2020).mkv'),
        artworkType: 'poster',
      }),
    ).resolves.toBe(path.join(dir, 'Movie (2020)-poster.png'));
  });

  test('falls back to the short name when there is no long-name artwork', async () => {
    await touch('movie.mkv', 'poster.jpg');

    await expect(
      findMovieArtwork({
        movieFilePath: path.join(dir, 'movie.mkv'),
        artworkType: 'poster',
      }),
    ).resolves.toBe(path.join(dir, 'poster.jpg'));
  });

  test('falls back to folder.jpg for a poster', async () => {
    await touch('movie.mkv', 'folder.jpg');

    await expect(
      findMovieArtwork({
        movieFilePath: path.join(dir, 'movie.mkv'),
        artworkType: 'poster',
      }),
    ).resolves.toBe(path.join(dir, 'folder.jpg'));
  });

  test('a flat folder resolves the shared poster.jpg for every movie, as before', async () => {
    // Without the gate this is main's behaviour: one folder-level poster.jpg
    // applies to every movie in the folder. The gate that restricts this to
    // single-movie folders is the follow-up.
    await touch('A.mkv', 'B.mkv', 'poster.jpg');

    await expect(
      findMovieArtwork({
        movieFilePath: path.join(dir, 'A.mkv'),
        artworkType: 'poster',
      }),
    ).resolves.toBe(path.join(dir, 'poster.jpg'));
    await expect(
      findMovieArtwork({
        movieFilePath: path.join(dir, 'B.mkv'),
        artworkType: 'poster',
      }),
    ).resolves.toBe(path.join(dir, 'poster.jpg'));
  });

  test('fanart uses its long name and never folder.*', async () => {
    await touch('movie.mkv', 'folder.jpg', 'movie-fanart.jpg');

    await expect(
      findMovieArtwork({
        movieFilePath: path.join(dir, 'movie.mkv'),
        artworkType: 'fanart',
      }),
    ).resolves.toBe(path.join(dir, 'movie-fanart.jpg'));

    await fs.rm(path.join(dir, 'movie-fanart.jpg'));

    await expect(
      findMovieArtwork({
        movieFilePath: path.join(dir, 'movie.mkv'),
        artworkType: 'fanart',
      }),
    ).resolves.toBeUndefined();
  });

  test('reports nothing when there is no artwork at all', async () => {
    await touch('movie.mkv');

    await expect(
      findMovieArtwork({
        movieFilePath: path.join(dir, 'movie.mkv'),
        artworkType: 'poster',
      }),
    ).resolves.toBeUndefined();
  });

  test('takes the lookup as a parameter, so the order is testable alone', async () => {
    const seen: string[][] = [];
    const found = await findMovieArtwork(
      {
        movieFilePath: '/movies/A.mkv',
        artworkType: 'poster',
      },
      (candidates) => {
        seen.push(candidates);
        return Promise.resolve(undefined);
      },
    );

    expect(found).toBeUndefined();
    expect(seen).toEqual([
      [path.join('/movies', 'A-poster')],
      [path.join('/movies', 'poster')],
      [path.join('/movies', 'folder')],
    ]);
  });
});
