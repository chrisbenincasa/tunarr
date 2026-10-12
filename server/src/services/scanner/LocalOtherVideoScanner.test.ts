import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { LocalMediaDB } from '../../db/LocalMediaDB.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import type { MediaSourceLibrary } from '../../db/schema/MediaSourceLibrary.ts';
import { LocalFolderCanonicalizer } from '../LocalFolderCanonicalizer.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
import type { LocalScanContext } from './FileSystemScanner.ts';
import { LocalOtherVideoScanner } from './LocalOtherVideoScanner.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';

describe('LocalOtherVideoScanner', () => {
  let libraryDir: string;

  beforeEach(async () => {
    libraryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-ovscan-'));
  });

  afterEach(async () => {
    await fs.rm(libraryDir, { recursive: true, force: true });
  });

  // A tool like Tdarr can rewrite a file in place. That changes the file's
  // mtime but not the folder's, so the folder hash must use per-file stats.
  test('rescans a folder when a file is overwritten in place', async () => {
    const videoPath = path.join(libraryDir, 'video.mkv');
    await fs.writeFile(videoPath, 'original');

    // Whole seconds, so restoring the folder mtime later is exact.
    const folderMtime = 1_700_000_000;
    await fs.utimes(libraryDir, folderMtime, folderMtime);

    let storedCanonicalId: string | undefined;
    const localMediaDB = {
      findFolder: vi.fn((_library: unknown, folderPath: string) =>
        Promise.resolve(
          folderPath === libraryDir && storedCanonicalId !== undefined
            ? { uuid: 'folder-1', canonicalId: storedCanonicalId }
            : undefined,
        ),
      ),
      upsertFolder: vi.fn(
        (
          _library: unknown,
          _parentId: unknown,
          _folderPath: string,
          canonicalId: string,
        ) => {
          storedCanonicalId = canonicalId;
          return Promise.resolve({ isNew: true, folder: { uuid: 'folder-1' } });
        },
      ),
      setCanonicalId: vi.fn((_folderId: string, canonicalId: string) => {
        storedCanonicalId = canonicalId;
        return Promise.resolve();
      }),
    };

    const programDB = {
      getProgramInfoForMediaSourceLibrary: vi.fn().mockResolvedValue({}),
      updateProgramsState: vi.fn().mockResolvedValue(undefined),
    };

    // Collaborators that only the per-file scan uses. The file is not a real
    // video, so that scan fails and is logged, which this test ignores.
    const scanner = new LocalOtherVideoScanner(
      new LocalFolderCanonicalizer(),
      localMediaDB as unknown as LocalMediaDB,
      {} as never,
      {} as never,
      {} as never,
      { scanProgress: vi.fn() } as unknown as MediaSourceProgressService,
      {} as unknown as MediaSourceDB,
      {
        updatePrograms: vi.fn().mockResolvedValue(undefined),
      } as unknown as MeilisearchService,
      programDB as unknown as IProgramDB,
      {} as never,
      { findExternalSubtitles: vi.fn().mockResolvedValue([]) } as never,
      {} as never,
    );

    const context: LocalScanContext = {
      mediaSource: { uuid: 'ms-1' } as MediaSourceWithRelations,
      library: {
        uuid: 'lib-1',
        externalKey: libraryDir,
      } as MediaSourceLibrary,
      force: false,
      percentMin: 0,
      percentCompleteMultiplier: 1,
    };

    (await scanner.scanPath(context)).getOrThrow();
    expect(localMediaDB.upsertFolder).toHaveBeenCalledOnce();
    const firstCanonicalId = storedCanonicalId;

    // Overwrite the file without touching the folder's mtime.
    await fs.writeFile(videoPath, 'reordered streams');
    const later = new Date(Date.now() + 60_000);
    await fs.utimes(videoPath, later, later);
    await fs.utimes(libraryDir, folderMtime, folderMtime);

    (await scanner.scanPath(context)).getOrThrow();

    expect(localMediaDB.setCanonicalId).toHaveBeenCalledOnce();
    expect(storedCanonicalId).not.toEqual(firstCanonicalId);
  });
});
