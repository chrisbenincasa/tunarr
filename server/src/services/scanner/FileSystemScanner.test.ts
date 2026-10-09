import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { FileSystemScanner } from './FileSystemScanner.ts';

abstract class ExposedScanner extends FileSystemScanner {
  static locateArtwork(baseFolder: string, artworkNames: string[]) {
    return FileSystemScanner.locateArtworkInDirectory(baseFolder, artworkNames);
  }
}

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-fs-scanner-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function showFolderWithPoster(folderName: string) {
  const showDir = path.join(root, folderName);
  await fs.mkdir(showDir);
  await fs.writeFile(path.join(showDir, 'poster.png'), '');
  return showDir;
}

// Glob syntax in the show path must not leak into the lookup. Passing the
// joined path to fast-glob treats "\" as an escape and "[...]" as a class,
// so the poster is never found.
describe('locateArtworkInDirectory', () => {
  // Windows paths use "\" as the separator. On POSIX the same characters are
  // legal inside one folder name, which reproduces the Windows failure.
  test.skipIf(process.platform === 'win32')(
    'finds a poster under a path containing backslashes',
    async () => {
      const showDir = await showFolderWithPoster(
        'J:\\Videos\\Sports\\Creator Clash',
      );

      const found = await ExposedScanner.locateArtwork(showDir, [
        'poster',
        'folder',
      ]);

      expect(found).toBe(path.join(showDir, 'poster.png'));
    },
  );

  test('finds a poster under a path containing glob characters', async () => {
    const showDir = await showFolderWithPoster('Creator Clash [2022] (US)');

    const found = await ExposedScanner.locateArtwork(showDir, [
      'poster',
      'folder',
    ]);

    expect(found).toBe(path.join(showDir, 'poster.png'));
  });
});
