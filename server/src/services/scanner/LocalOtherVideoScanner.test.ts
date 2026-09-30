import { faker } from '@faker-js/faker';
import dayjs from 'dayjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { test as baseTest, expect, vi } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
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
import {
  MediaSourceId,
  MediaSourceType,
} from '../../db/schema/base.ts';
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
import { LocalOtherVideoScanner } from './LocalOtherVideoScanner.ts';
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

const artworkCacheKey = 'images/video-thumb.jpg';

const otherVideoNfo = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
    <title>Lab Other Video</title>
    <plot>An item for the scanner test.</plot>
    <tag>lab</tag>
</movie>
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
    mediaType: 'other_videos' as const,
    consecutiveAuthFailures: 0,
  } satisfies MediaSourceOrm;

  await drizzle.insert(MediaSource).values(mediaSource);

  const library = {
    uuid: v4(),
    name: faker.music.genre(),
    mediaSourceId: mediaSource.uuid,
    mediaType: 'other_videos' as const,
    lastScannedAt: null,
    externalKey: libraryPath,
    enabled: true,
  } satisfies typeof MediaSourceLibrary.$inferInsert;

  await drizzle.insert(MediaSourceLibrary).values(library);

  return { mediaSource, library };
}

/** The artwork row the scan left behind for the item at `videoPath`. */
async function artworkForVideo(
  drizzle: NonNullable<DBAccess['drizzle']>,
  videoPath: string,
) {
  const program = await drizzle.query.program.findFirst({
    where: (fields, { eq }) => eq(fields.externalKey, videoPath),
    with: { artwork: true },
  });
  expect(program).toBeDefined();
  return program!.artwork[0];
}

describe('LocalOtherVideoScanner artwork rescan', () => {
  test('an unchanged image is not re-cached when the folder is scanned again', async ({
    drizzle,
    programDb,
  }) => {
    const mediaDir = await tmp.dir({ unsafeCleanup: true });
    const videoPath = path.join(mediaDir.path, 'video.mp4');
    const artworkPath = path.join(mediaDir.path, 'video-thumb.jpg');
    await fs.writeFile(videoPath, 'not really a video');
    await fs.writeFile(path.join(mediaDir.path, 'video.nfo'), otherVideoNfo);
    await fs.writeFile(artworkPath, 'not really an image');

    const { mediaSource, library } = await createTestMediaSourceLibrary(
      drizzle,
      mediaDir.path,
    );

    const getStream = vi.fn().mockResolvedValue(
      Result.success({
        streamDetails: {
          videoDetails: [
            {
              streamIndex: 0,
              codec: 'h264',
              width: 1920,
              height: 1080,
              framerate: 24,
              scanType: 'progressive',
            },
          ],
          audioDetails: [
            {
              index: 1,
              codec: 'aac',
              channels: 2,
              language: 'eng',
              languageCodeISO6392: 'eng',
            },
          ],
          duration: dayjs.duration({ seconds: 120 }),
          formatTags: {},
          chapters: [],
        },
      }),
    );
    const addArtworkToCache = vi
      .fn()
      .mockResolvedValue(Result.success({ cacheKey: artworkCacheKey }));

    const scanner = new LocalOtherVideoScanner(
      new LocalFolderCanonicalizer(),
      new LocalMediaDB(drizzle),
      { getStream } as unknown as FfprobeStreamDetails,
      { addArtworkToCache } as unknown as ImageCache,
      new ProgramDaoMinter(),
      {
        scanStarted: vi.fn(),
        scanProgress: vi.fn(),
        scanEnded: vi.fn(),
      } as unknown as MediaSourceProgressService,
      { setLibraryLastScannedTime: vi.fn() } as unknown as MediaSourceDB,
      {
        indexOtherVideo: vi.fn(),
        updatePrograms: vi.fn(),
      } as unknown as MeilisearchService,
      programDb,
      new LocalMediaCanonicalizer(),
      {
        findExternalSubtitles: vi.fn().mockResolvedValue([]),
      } as unknown as LocalSubtitlesService,
      {
        getOtherVideoFallbackMetadata: vi.fn(),
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

    expect(getStream).toHaveBeenCalledTimes(1);
    expect(addArtworkToCache).toHaveBeenCalledTimes(1);

    const firstArtwork = await artworkForVideo(drizzle, videoPath);
    expect(firstArtwork.cachePath).toBe(artworkCacheKey);
    const firstUpdatedAt = +firstArtwork.updatedAt!;

    // A later scan of the same folder: an unrelated file was added, so the
    // folder's contents (and its canonical id) changed and it is walked again.
    // The video and its thumbnail are untouched.
    await fs.writeFile(path.join(mediaDir.path, 'notes.txt'), 'unrelated');
    getStream.mockClear();
    addArtworkToCache.mockClear();

    await scan();

    // The item was scanned again...
    expect(getStream).toHaveBeenCalledTimes(1);
    // ...but its unchanged thumbnail was not copied into the cache again, and
    // it kept the row it already had.
    expect(addArtworkToCache).not.toHaveBeenCalled();
    const secondArtwork = await artworkForVideo(drizzle, videoPath);
    expect(secondArtwork.uuid).toBe(firstArtwork.uuid);
    expect(+secondArtwork.updatedAt!).toBe(firstUpdatedAt);
  });
});
