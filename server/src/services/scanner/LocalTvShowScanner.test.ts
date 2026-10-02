import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { test as baseTest, expect, vi } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { ProgramGroupingMinter } from '../../db/converters/ProgramGroupingMinter.ts';
import { ProgramDaoMinter } from '../../db/converters/ProgramMinter.ts';
import { DBAccess } from '../../db/DBAccess.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { LocalMediaDB } from '../../db/LocalMediaDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import { ProgramDB } from '../../db/ProgramDB.ts';
import { BasicProgramRepository } from '../../db/program/BasicProgramRepository.ts';
import { ProgramExternalIdRepository } from '../../db/program/ProgramExternalIdRepository.ts';
import { ProgramGroupingRepository } from '../../db/program/ProgramGroupingRepository.ts';
import { ProgramGroupingUpsertRepository } from '../../db/program/ProgramGroupingUpsertRepository.ts';
import { ProgramMetadataRepository } from '../../db/program/ProgramMetadataRepository.ts';
import { ProgramSearchRepository } from '../../db/program/ProgramSearchRepository.ts';
import { ProgramStateRepository } from '../../db/program/ProgramStateRepository.ts';
import { ProgramUpsertRepository } from '../../db/program/ProgramUpsertRepository.ts';
import { MediaSourceId, MediaSourceType } from '../../db/schema/base.ts';
import {
  MediaSource,
  type MediaSourceOrm,
} from '../../db/schema/MediaSource.ts';
import {
  MediaSourceLibrary,
  type MediaSourceLibraryOrm,
} from '../../db/schema/MediaSourceLibrary.ts';
import { setGlobalOptions } from '../../globals.ts';
import type { FfprobeStreamDetails } from '../../stream/FfprobeStreamDetails.ts';
import { copyPreMigratedDb } from '../../testing/testDbFactory.ts';
import { Result } from '../../types/result.ts';
import type { ImageCache } from '../ImageCache.ts';
import type { FallbackMetadataService } from '../local/FallbackMetadataService.ts';
import type { LocalSubtitlesService } from '../local/LocalSubtitlesService.ts';
import { LocalFolderCanonicalizer } from '../LocalFolderCanonicalizer.ts';
import { LocalMediaCanonicalizer } from '../LocalMediaCanonicalizer.ts';
import type { MeilisearchService } from '../MeilisearchService.ts';
import { LocalTvShowScanner } from './LocalTvShowScanner.ts';
import type { MediaSourceProgressService } from './MediaSourceProgressService.ts';

type Fixture = {
  drizzle: NonNullable<DBAccess['drizzle']>;
  programDb: IProgramDB;
};

const test = baseTest.extend<Fixture>({
  drizzle: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    setGlobalOptions({
      database: dbResult.path,
      log_level: 'error',
      verbose: 0,
    });
    await bootstrapTunarr();
    await use(DBAccess.instance.drizzle!);
    await dbResult.cleanup();
  },
  programDb: async ({ drizzle }, use) => {
    const dbAccess = DBAccess.instance;
    const metadataRepo = new ProgramMetadataRepository(drizzle);
    const externalIdRepo = new ProgramExternalIdRepository(
      dbAccess.db!,
      drizzle,
    );
    await use(
      new ProgramDB(
        new BasicProgramRepository(dbAccess.db!, drizzle),
        new ProgramGroupingRepository(dbAccess.db!, drizzle),
        externalIdRepo,
        new ProgramUpsertRepository(drizzle, externalIdRepo, metadataRepo),
        metadataRepo,
        new ProgramGroupingUpsertRepository(
          dbAccess.db!,
          drizzle,
          metadataRepo,
        ),
        new ProgramSearchRepository(dbAccess.db!, drizzle),
        new ProgramStateRepository(drizzle),
      ),
    );
  },
});

const artworkCacheKey = 'images/poster.jpg';

const tvShowNfo = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
    <title>Lab Show</title>
    <plot>A show for the scanner test.</plot>
    <tag>lab</tag>
</tvshow>
`;

async function createTestMediaSourceLibrary(
  drizzle: NonNullable<DBAccess['drizzle']>,
  libraryPath: string,
): Promise<{ mediaSource: MediaSourceOrm; library: MediaSourceLibraryOrm }> {
  const mediaSource = {
    uuid: v4() as MediaSourceId,
    name: faker.string.alpha(6),
    type: MediaSourceType.Local,
    createdAt: +dayjs(),
    updatedAt: +dayjs(),
    uri: libraryPath,
    accessToken: '',
    clientIdentifier: null,
    index: 0,
    sendChannelUpdates: false,
    sendGuideUpdates: false,
    sendPlayStatusUpdates: false,
    username: null,
    userId: null,
    mediaType: 'shows' as const,
    consecutiveAuthFailures: 0,
  } satisfies MediaSourceOrm;

  await drizzle.insert(MediaSource).values(mediaSource);

  const library = {
    uuid: v4(),
    name: faker.music.genre(),
    mediaSourceId: mediaSource.uuid,
    mediaType: 'shows' as const,
    lastScannedAt: null,
    externalKey: libraryPath,
    enabled: true,
  } satisfies typeof MediaSourceLibrary.$inferInsert;

  await drizzle.insert(MediaSourceLibrary).values(library);

  return { mediaSource, library };
}

/** The artwork row the scan left behind for the show at `showPath`. */
async function artworkForShow(
  drizzle: NonNullable<DBAccess['drizzle']>,
  showPath: string,
) {
  const grouping = await drizzle.query.programGrouping.findFirst({
    where: (fields, { eq }) => eq(fields.externalKey, showPath),
    with: { artwork: true },
  });
  expect(grouping).toBeDefined();
  return grouping!.artwork[0];
}

describe('LocalTvShowScanner artwork rescan', () => {
  test('an unchanged poster is not re-cached when the show folder is scanned again', async ({
    drizzle,
    programDb,
  }) => {
    const mediaDir = await tmp.dir({ unsafeCleanup: true });
    const showPath = path.join(mediaDir.path, 'Lab Show');
    await fs.mkdir(showPath);
    await fs.writeFile(path.join(showPath, 'tvshow.nfo'), tvShowNfo);
    await fs.writeFile(path.join(showPath, 'poster.jpg'), 'not really an image');

    const { mediaSource, library } = await createTestMediaSourceLibrary(
      drizzle,
      mediaDir.path,
    );

    const addArtworkToCache = vi
      .fn()
      .mockResolvedValue(Result.success({ cacheKey: artworkCacheKey }));

    const scanner = new LocalTvShowScanner(
      new LocalFolderCanonicalizer(),
      new LocalMediaDB(drizzle),
      { getStream: vi.fn() } as unknown as FfprobeStreamDetails,
      { addArtworkToCache } as unknown as ImageCache,
      new ProgramGroupingMinter(),
      new ProgramDaoMinter(),
      {
        scanStarted: vi.fn(),
        scanProgress: vi.fn(),
        scanEnded: vi.fn(),
      } as unknown as MediaSourceProgressService,
      { setLibraryLastScannedTime: vi.fn() } as unknown as MediaSourceDB,
      {
        indexShow: vi.fn(),
        updatePrograms: vi.fn(),
      } as unknown as MeilisearchService,
      programDb,
      new LocalMediaCanonicalizer(),
      {
        findExternalSubtitles: vi.fn().mockResolvedValue([]),
      } as unknown as LocalSubtitlesService,
      {
        getShowFallbackMetadata: vi.fn(),
      } as unknown as FallbackMetadataService,
    );

    const scan = () =>
      scanner.scan({
        mediaSource: {
          ...mediaSource,
          libraries: [library],
        },
      });

    await scan();

    expect(addArtworkToCache).toHaveBeenCalledTimes(1);

    const firstArtwork = await artworkForShow(drizzle, showPath);
    expect(firstArtwork.cachePath).toBe(artworkCacheKey);
    const firstUpdatedAt = +firstArtwork.updatedAt!;

    // A later scan of the same folder: an unrelated file was added, so the
    // folder's contents (and its canonical id) changed and it is walked again.
    // The poster is untouched.
    await fs.writeFile(path.join(showPath, 'notes.txt'), 'unrelated');
    addArtworkToCache.mockClear();

    await scan();

    expect(addArtworkToCache).not.toHaveBeenCalled();
    const secondArtwork = await artworkForShow(drizzle, showPath);
    expect(secondArtwork.uuid).toBe(firstArtwork.uuid);
    expect(+secondArtwork.updatedAt!).toBe(firstUpdatedAt);
  });
});
