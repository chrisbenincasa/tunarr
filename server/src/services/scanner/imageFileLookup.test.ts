import glob from 'fast-glob';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  caseInsensitiveExtensionGlob,
  locateImageFile,
  locateMovieArtwork,
} from './imageFileLookup.ts';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-image-lookup-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function touch(...names: string[]) {
  for (const name of names) {
    await fs.writeFile(path.join(dir, name), '');
  }
}

describe('locateImageFile', () => {
  test('matches an uppercase extension', async () => {
    await touch('video-thumb.JPG');

    const found = await locateImageFile([path.join(dir, 'video-thumb')]);

    expect(found).toBe(path.join(dir, 'video-thumb.JPG'));
  });

  test('matches a mixed-case extension', async () => {
    await touch('poster.Png');

    const found = await locateImageFile([path.join(dir, 'poster')]);

    expect(found).toBe(path.join(dir, 'poster.Png'));
  });

  test('keeps the rest of the name case-sensitive', async () => {
    await touch('Poster.jpg');

    const found = await locateImageFile([path.join(dir, 'poster')]);

    expect(found).toBeUndefined();
  });

  test('prefers an exact-case file over a differently cased duplicate', async () => {
    await touch('poster.JPG', 'poster.jpg');

    const found = await locateImageFile([path.join(dir, 'poster')]);

    expect(found).toBe(path.join(dir, 'poster.jpg'));
  });

  test('tries extensions in order before stems', async () => {
    await touch('video.png', 'video-thumb.JPG');

    const found = await locateImageFile([
      path.join(dir, 'video'),
      path.join(dir, 'video-thumb'),
    ]);

    expect(found).toBe(path.join(dir, 'video-thumb.JPG'));
  });

  test('ignores non-image extensions', async () => {
    await touch('video.mkv', 'video.nfo');

    const found = await locateImageFile([path.join(dir, 'video')]);

    expect(found).toBeUndefined();
  });

  test('returns undefined for a missing directory', async () => {
    const found = await locateImageFile([path.join(dir, 'missing', 'poster')]);

    expect(found).toBeUndefined();
  });
});

describe('locateMovieArtwork', () => {
  const movie = () => path.join(dir, 'Movie (2020).mkv');

  test('prefers the movie-specific name over the short name', async () => {
    await touch('Movie (2020)-poster.jpg', 'poster.jpg');

    const found = await locateMovieArtwork(movie(), 'poster');

    expect(found).toBe(path.join(dir, 'Movie (2020)-poster.jpg'));
  });

  test('prefers the movie-specific name in a later extension (#2170)', async () => {
    await touch('Movie (2020)-poster.png', 'poster.jpg');

    const found = await locateMovieArtwork(movie(), 'poster');

    expect(found).toBe(path.join(dir, 'Movie (2020)-poster.png'));
  });

  test('falls back to the short name', async () => {
    await touch('fanart.jpg');

    const found = await locateMovieArtwork(movie(), 'fanart');

    expect(found).toBe(path.join(dir, 'fanart.jpg'));
  });

  test('falls back to folder for a poster', async () => {
    await touch('folder.jpg');

    const found = await locateMovieArtwork(movie(), 'poster');

    expect(found).toBe(path.join(dir, 'folder.jpg'));
  });

  test('prefers the short poster name over folder', async () => {
    await touch('folder.jpg', 'poster.png');

    const found = await locateMovieArtwork(movie(), 'poster');

    expect(found).toBe(path.join(dir, 'poster.png'));
  });

  test('never falls back to folder for other artwork', async () => {
    await touch('folder.jpg');

    const found = await locateMovieArtwork(movie(), 'fanart');

    expect(found).toBeUndefined();
  });
});

describe('caseInsensitiveExtensionGlob', () => {
  test('matches the extension in any case', async () => {
    await fs.mkdir(path.join(dir, 'disc1'));
    await fs.writeFile(path.join(dir, 'disc1', 'folder.JPEG'), '');

    const pattern = `${glob.convertPathToPattern(dir)}/**/folder.${caseInsensitiveExtensionGlob('jpeg')}`;

    expect(await glob.async(pattern)).toEqual([
      path.join(dir, 'disc1', 'folder.JPEG'),
    ]);
  });
});
