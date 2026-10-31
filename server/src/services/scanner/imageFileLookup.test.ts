import glob from 'fast-glob';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  caseInsensitiveExtensionGlob,
  folderNameMatchesMovie,
  isMovieFolder,
  isMovieVideoFile,
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

describe('locateMovieArtwork with the short-name gate (#2171)', () => {
  const movie = () => path.join(dir, 'Movie (2020).mkv');

  test('skips the short name in a folder that is not a movie folder', async () => {
    await touch('poster.jpg');

    const found = await locateMovieArtwork(movie(), 'poster', {
      allowShortNames: false,
    });

    expect(found).toBeUndefined();
  });

  test('still finds the movie-specific name there', async () => {
    await touch('Movie (2020)-poster.jpg');

    const found = await locateMovieArtwork(movie(), 'poster', {
      allowShortNames: false,
    });

    expect(found).toBe(path.join(dir, 'Movie (2020)-poster.jpg'));
  });

  test('skips folder.* there, posters included', async () => {
    await touch('folder.jpg');

    const found = await locateMovieArtwork(movie(), 'poster', {
      allowShortNames: false,
    });

    expect(found).toBeUndefined();
  });

  test('keeps the short name when the folder allows it', async () => {
    await touch('poster.jpg', 'folder.jpg');

    const found = await locateMovieArtwork(movie(), 'poster', {
      allowShortNames: true,
    });

    expect(found).toBe(path.join(dir, 'poster.jpg'));
  });

  test('keeps folder.* when the folder allows it', async () => {
    await touch('folder.jpg');

    const found = await locateMovieArtwork(movie(), 'poster', {
      allowShortNames: true,
    });

    expect(found).toBe(path.join(dir, 'folder.jpg'));
  });

  test('no option keeps the #2315 behavior for existing callers', async () => {
    await touch('poster.jpg');

    const found = await locateMovieArtwork(movie(), 'poster');

    expect(found).toBe(path.join(dir, 'poster.jpg'));
  });
});

describe('isMovieVideoFile', () => {
  test('counts a known video extension', () => {
    expect(isMovieVideoFile('Movie (2020).mkv')).toBe(true);
  });

  test('ignores a macOS sidecar', () => {
    expect(isMovieVideoFile('._Movie (2020).mkv')).toBe(false);
  });

  test('ignores a poster', () => {
    expect(isMovieVideoFile('poster.jpg')).toBe(false);
  });

  test('does not count an extension the scanner would not count', () => {
    // The library filter compares the raw extension against the lowercase
    // known set, so `.MP4` is not scanned as a movie today. The gate mirrors
    // that instead of introducing a second rule; making the extension
    // case-insensitive would change what the library scans, which is a
    // separate change.
    expect(isMovieVideoFile('clip.MP4')).toBe(false);
  });

  test('counts a loose track, because the video set carries its extension', () => {
    // `.ogg` sits in KnownVideoFileExtensions, so the scanner counts it as a
    // movie file. The gate follows the scanner rather than inventing an
    // audio exception, which is the point of sharing the predicate.
    expect(isMovieVideoFile('commentary.ogg')).toBe(true);
  });
});

describe('isMovieFolder', () => {
  const folder = (name: string, videoFileNames: string[]) => ({
    moviePath: path.join(dir, name, videoFileNames[0]),
    videoFileNames,
  });

  test('holds exactly one movie', () => {
    expect(isMovieFolder(folder('Movies', ['A.mkv']))).toBe(true);
  });

  test('is named after its movie, even with extras next to it', () => {
    expect(
      isMovieFolder(
        folder('Movie (2020)', ['Movie (2020).mkv', 'Movie (2020)-featurette.mkv']),
      ),
    ).toBe(true);
  });

  test('holds two quality versions of the same movie', () => {
    expect(
      isMovieFolder(
        folder('Movie (2020)', [
          'Movie (2020) Bluray-1080p.mkv',
          'Movie (2020) Bluray-720p.mkv',
        ]),
      ),
    ).toBe(true);
  });

  test('matches the folder name regardless of case and spacing', () => {
    expect(
      isMovieFolder({
        moviePath: path.join(dir, 'movie   (2020)', 'Movie (2020).mkv'),
        videoFileNames: ['Movie (2020).mkv'],
      }),
    ).toBe(true);
  });

  test('does not when the name is a different movie', () => {
    expect(
      isMovieFolder({
        moviePath: path.join(dir, 'Movie (2020)', 'Other (1999).mkv'),
        videoFileNames: ['Movie (2020).mkv', 'Other (1999).mkv'],
      }),
    ).toBe(false);
  });

  test('is a flat library', () => {
    expect(isMovieFolder(folder('Movies', ['A.mkv', 'B.mkv']))).toBe(false);
  });

  test('is the flat library of the issue, with a shared poster', () => {
    expect(
      isMovieFolder(folder('Movies', ['A.mkv', 'B.mkv', 'poster.jpg'])),
    ).toBe(false);
  });

  test('does not count a macOS sidecar as a second movie', () => {
    expect(isMovieFolder(folder('Movies', ['A.mkv', '._A.mkv']))).toBe(true);
  });

  test('is not a movie folder for stacked cd1/cd2 files', () => {
    // Stacking needs real support, not a heuristic; the docs list it as a
    // limit. Plain cd1/cd2 names do not carry the folder's name either, so
    // the name arm does not rescue them.
    expect(
      isMovieFolder(
        folder('The Matrix (1999)', ['cd1.mkv', 'cd2.mkv']),
      ),
    ).toBe(false);
  });

  test('does not count a poster as a movie', () => {
    expect(isMovieFolder(folder('Movies', ['A.mkv', 'poster.jpg']))).toBe(
      true,
    );
  });

  test('counts a loose track, because the scanner counts it', () => {
    expect(isMovieFolder(folder('Movies', ['A.mkv', 'commentary.ogg']))).toBe(
      false,
    );
  });

  test('does not count an uppercase extension, because the scanner does not', () => {
    expect(isMovieFolder(folder('Movies', ['A.mkv', 'clip.MP4']))).toBe(true);
  });
});

describe('folderNameMatchesMovie', () => {
  test('matches the folder when the file carries a quality tag', () => {
    expect(
      folderNameMatchesMovie(
        path.join(dir, 'Movie (2020)'),
        path.join(dir, 'Movie (2020)', 'Movie (2020) Bluray-1080p.mkv'),
      ),
    ).toBe(true);
  });

  test('matches when the file is named exactly like the folder', () => {
    expect(
      folderNameMatchesMovie(
        path.join(dir, 'Movie (2020)'),
        path.join(dir, 'Movie (2020)', 'Movie (2020).mkv'),
      ),
    ).toBe(true);
  });

  test('does not match a different movie', () => {
    expect(
      folderNameMatchesMovie(
        path.join(dir, 'Movie (2020)'),
        path.join(dir, 'Movie (2020)', 'Other (1999).mkv'),
      ),
    ).toBe(false);
  });

  test('does not match when the folder name is not a prefix of the movie', () => {
    expect(
      folderNameMatchesMovie(
        path.join(dir, 'Movies'),
        path.join(dir, 'Movies', 'A.mkv'),
      ),
    ).toBe(false);
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
