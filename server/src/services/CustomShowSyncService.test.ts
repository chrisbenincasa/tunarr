import { faker } from '@faker-js/faker';
import type {
  CondensedContentProgram,
  Movie,
  TerminalProgram,
} from '@tunarr/types';
import { tag } from '@tunarr/types';
import { describe, expect, it, vi } from 'vitest';
import type { CustomShowDB } from '@/db/CustomShowDB.js';
import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import type { MediaSourceDB } from '@/db/mediaSourceDB.js';
import type { MediaSourceId, MediaSourceName } from '@/db/schema/base.js';
import type { MediaSourceApiFactory } from '@/external/MediaSourceApiFactory.js';
import type { MutexMap } from '@/util/mutexMap.js';
import { Result } from '@/types/result.js';
import type { GenericMediaSourceScannerFactory } from './scanner/MediaSourceScanner.js';
import { CustomShowSyncService } from './CustomShowSyncService.js';

const { fakeLogger } = vi.hoisted(() => {
  const fakeLogger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: () => fakeLogger,
  };
  return { fakeLogger };
});

// Suppress background task scheduling
vi.mock('@/services/Scheduler.js', () => ({
  GlobalScheduler: { scheduleOneOffTask: vi.fn(), removeTask: vi.fn() },
}));
vi.mock('@/tasks/TaskQueue.js', () => ({
  PlexTaskQueue: {
    pause: vi.fn(),
    resume: vi.fn(),
    add: vi.fn().mockResolvedValue(undefined),
  },
  JellyfinTaskQueue: {
    pause: vi.fn(),
    resume: vi.fn(),
    add: vi.fn().mockResolvedValue(undefined),
  },
}));
// Suppress logger
vi.mock('@/util/logging/LoggerFactory.js', () => ({
  LoggerFactory: { child: () => fakeLogger, root: fakeLogger },
}));

function makeMovie(
  mediaSourceId: MediaSourceId,
  libraryId: string,
  overrides?: Partial<Movie>,
): Movie {
  return {
    uuid: faker.string.uuid(),
    sourceType: 'plex',
    type: 'movie',
    title: faker.word.words(3),
    originalTitle: null,
    sortTitle: faker.word.words(3),
    year: faker.date.past().getFullYear(),
    releaseDate: null,
    releaseDateString: null,
    rating: null,
    summary: null,
    plot: null,
    tagline: null,
    identifiers: [],
    tags: [],
    createdAt: null,
    artwork: [],
    state: 'ok',
    canonicalId: faker.string.uuid(),
    externalId: faker.string.alphanumeric(10),
    mediaSourceId,
    libraryId,
    duration: faker.number.int({ min: 60_000, max: 7_200_000 }),
    ...overrides,
  };
}

function makeMocks() {
  const mediaSourceId = tag<MediaSourceId>(faker.string.uuid());
  const libraryId = faker.string.uuid();

  const customShowDB = {
    getShow: vi.fn(),
    upsertCustomShowContent: vi.fn().mockResolvedValue(undefined),
    updateLastSyncedAt: vi.fn().mockResolvedValue(undefined),
    getSyncedShows: vi.fn(),
  } as unknown as CustomShowDB;

  const mediaSourceApiFactory = {
    getPlexApiClientById: vi.fn(),
  } as unknown as MediaSourceApiFactory;

  const locks: MutexMap = {
    runWithLockId: vi.fn((_id: string, cb: () => Promise<unknown>) => cb()),
    isLocked: vi.fn().mockReturnValue(false),
  } as unknown as MutexMap;

  const mockScanner = {
    scanSingle: vi.fn().mockResolvedValue(Result.success(undefined)),
  };

  const scannerFactory = vi.fn().mockReturnValue(mockScanner);

  const programDB = {
    lookupByExternalIds: vi.fn().mockResolvedValue([]),
  } as unknown as IProgramDB;

  const mediaSourceDB = {
    getById: vi.fn().mockResolvedValue({
      uuid: mediaSourceId,
      type: 'plex',
      name: tag<MediaSourceName>('Test Plex'),
      libraries: [
        {
          uuid: libraryId,
          name: 'Movies',
          mediaSourceId,
          externalKey: 'library-ext-1',
          mediaType: 'movies',
          enabled: true,
          lastScannedAt: null,
        },
      ],
      paths: [],
      replacePaths: [],
    }),
  } as unknown as MediaSourceDB;

  const service = new CustomShowSyncService(
    customShowDB,
    mediaSourceApiFactory,
    locks,
    scannerFactory as unknown as GenericMediaSourceScannerFactory,
    programDB,
    mediaSourceDB,
  );
  // Inject fake logger
  Object.defineProperty(service, 'logger', { value: fakeLogger });

  return {
    service,
    customShowDB,
    mediaSourceApiFactory,
    locks,
    mockScanner,
    scannerFactory,
    programDB,
    mediaSourceDB,
    mediaSourceId,
    libraryId,
  };
}

describe('CustomShowSyncService', () => {
  describe('syncShow', () => {
    it('scans missing programs via the scanner and persists them to the DB and search index', async () => {
      const {
        service,
        customShowDB,
        mediaSourceApiFactory,
        mockScanner,
        scannerFactory,
        programDB,
        mediaSourceId,
        libraryId,
      } = makeMocks();

      const customShowId = faker.string.uuid();
      const playlistId = faker.string.alphanumeric(8);

      // Two movies that do NOT exist in Tunarr yet
      const movie1 = makeMovie(mediaSourceId, libraryId);
      const movie2 = makeMovie(mediaSourceId, libraryId);

      vi.mocked(customShowDB.getShow).mockResolvedValue({
        uuid: customShowId,
        name: 'Test Show',
        syncMediaSourceId: mediaSourceId,
        syncMediaSourceType: 'plex',
        syncExternalPlaylistId: playlistId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastSyncedAt: null,
        content: [],
      });

      const plexClient = {
        getItemChildren: vi.fn().mockResolvedValue(Result.success([])),
      };
      vi.mocked(mediaSourceApiFactory.getPlexApiClientById).mockResolvedValue(
        plexClient as never,
      );

      // Bypass the real playlist fetch by spying on the private method
      const fetchSpy = vi
        .spyOn(service as never, 'fetchPlaylistPrograms' as never)
        .mockResolvedValue([movie1, movie2] as never);

      // After scanning, the programs should be looked up in the DB
      // Simulate that they now exist (scanner persisted them)
      const dbUuid1 = faker.string.uuid();
      const dbUuid2 = faker.string.uuid();
      vi.mocked(programDB.lookupByExternalIds).mockResolvedValue([
        {
          uuid: dbUuid1,
          sourceType: 'plex',
          externalSourceId: mediaSourceId,
          externalKey: movie1.externalId,
          externalIds: [],
        },
        {
          uuid: dbUuid2,
          sourceType: 'plex',
          externalSourceId: mediaSourceId,
          externalKey: movie2.externalId,
          externalIds: [],
        },
      ] as never);

      await service.syncShow(customShowId);

      // 1. Scanner was created for the correct source/library type
      expect(scannerFactory).toHaveBeenCalledWith('plex', 'movies');

      // 2. scanSingle was called once per movie with the correct library + externalId
      expect(mockScanner.scanSingle).toHaveBeenCalledTimes(2);
      expect(mockScanner.scanSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          library: expect.objectContaining({ uuid: libraryId }),
          externalId: movie1.externalId,
        }),
      );
      expect(mockScanner.scanSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          library: expect.objectContaining({ uuid: libraryId }),
          externalId: movie2.externalId,
        }),
      );

      // 3. lookupByExternalIds was called to resolve DB UUIDs
      expect(programDB.lookupByExternalIds).toHaveBeenCalledTimes(1);

      // 4. Custom show content was upserted with the DB UUIDs (not the original ones)
      expect(customShowDB.upsertCustomShowContent).toHaveBeenCalledWith(
        customShowId,
        expect.arrayContaining([
          expect.objectContaining({
            id: dbUuid1,
            type: 'content',
          } satisfies Partial<CondensedContentProgram>),
          expect.objectContaining({
            id: dbUuid2,
            type: 'content',
          } satisfies Partial<CondensedContentProgram>),
        ]),
      );

      fetchSpy.mockRestore();
    });

    it('groups episodes by show and scans once per show', async () => {
      const {
        service,
        customShowDB,
        mediaSourceApiFactory,
        mockScanner,
        scannerFactory,
        programDB,
        mediaSourceId,
        libraryId,
      } = makeMocks();

      const customShowId = faker.string.uuid();
      const showExternalId = faker.string.alphanumeric(8);

      const makeEpisode = (
        seasonNum: number,
        epNum: number,
      ): TerminalProgram => ({
        uuid: faker.string.uuid(),
        sourceType: 'plex',
        type: 'episode',
        title: `Episode ${epNum}`,
        originalTitle: null,
        sortTitle: `Episode ${epNum}`,
        year: 2024,
        releaseDate: null,
        releaseDateString: null,
        summary: null,
        plot: null,
        tagline: null,
        identifiers: [],
        tags: [],
        createdAt: null,
        artwork: [],
        state: 'ok',
        canonicalId: faker.string.uuid(),
        externalId: faker.string.alphanumeric(10),
        mediaSourceId,
        libraryId,
        duration: faker.number.int({ min: 1_200_000, max: 3_600_000 }),
        seasonNumber: seasonNum,
        episodeNumber: epNum,
        show: {
          uuid: faker.string.uuid(),
          sourceType: 'plex',
          type: 'show',
          title: 'Test Show',
          sortTitle: 'Test Show',
          originalTitle: null,
          year: 2024,
          identifiers: [],
          tags: [],
          artwork: [],
          externalId: showExternalId,
        },
      });

      const ep1 = makeEpisode(1, 1);
      const ep2 = makeEpisode(1, 2);
      const ep3 = makeEpisode(2, 1);

      vi.mocked(customShowDB.getShow).mockResolvedValue({
        uuid: customShowId,
        name: 'Episode Show',
        syncMediaSourceId: mediaSourceId,
        syncMediaSourceType: 'plex',
        syncExternalPlaylistId: 'playlist-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastSyncedAt: null,
        content: [],
      });

      const fetchSpy = vi
        .spyOn(service as never, 'fetchPlaylistPrograms' as never)
        .mockResolvedValue([ep1, ep2, ep3] as never);

      // All episodes resolve to DB records
      vi.mocked(programDB.lookupByExternalIds).mockResolvedValue(
        [ep1, ep2, ep3].map((ep) => ({
          uuid: ep.uuid,
          sourceType: 'plex',
          externalSourceId: mediaSourceId,
          externalKey: ep.externalId,
          externalIds: [],
        })) as never,
      );

      await service.syncShow(customShowId);

      // Scanner factory should have been called for shows (not movies)
      expect(scannerFactory).toHaveBeenCalledWith('plex', 'shows');

      // All 3 episodes share the same show, so scanSingle should be called once
      expect(mockScanner.scanSingle).toHaveBeenCalledTimes(1);
      expect(mockScanner.scanSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: showExternalId,
        }),
      );

      // All 3 episodes should appear in upserted content
      expect(customShowDB.upsertCustomShowContent).toHaveBeenCalledWith(
        customShowId,
        expect.arrayContaining([
          expect.objectContaining({ id: ep1.uuid, type: 'content' }),
          expect.objectContaining({ id: ep2.uuid, type: 'content' }),
          expect.objectContaining({ id: ep3.uuid, type: 'content' }),
        ]),
      );

      fetchSpy.mockRestore();
    });

    it('skips upsert and logs a warning when playlist returns 0 items', async () => {
      const { service, customShowDB, mediaSourceApiFactory, mockScanner } =
        makeMocks();

      const customShowId = faker.string.uuid();

      vi.mocked(customShowDB.getShow).mockResolvedValue({
        uuid: customShowId,
        name: 'Empty Show',
        syncMediaSourceId: faker.string.uuid(),
        syncMediaSourceType: 'plex',
        syncExternalPlaylistId: 'playlist-empty',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastSyncedAt: null,
        content: [],
      });

      const fetchSpy = vi
        .spyOn(service as never, 'fetchPlaylistPrograms' as never)
        .mockResolvedValue([] as never);

      await service.syncShow(customShowId);

      // No scanning should occur
      expect(mockScanner.scanSingle).not.toHaveBeenCalled();

      // No content upsert
      expect(customShowDB.upsertCustomShowContent).not.toHaveBeenCalled();

      // Warning logged about 0 items
      expect(fakeLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('0 items'),
        expect.anything(),
        expect.anything(),
      );

      fetchSpy.mockRestore();
    });

    it('continues scanning remaining programs when one scanSingle fails', async () => {
      const {
        service,
        customShowDB,
        mockScanner,
        programDB,
        mediaSourceId,
        libraryId,
      } = makeMocks();

      const customShowId = faker.string.uuid();
      const movie1 = makeMovie(mediaSourceId, libraryId);
      const movie2 = makeMovie(mediaSourceId, libraryId);

      vi.mocked(customShowDB.getShow).mockResolvedValue({
        uuid: customShowId,
        name: 'Partial Fail',
        syncMediaSourceId: mediaSourceId,
        syncMediaSourceType: 'plex',
        syncExternalPlaylistId: 'playlist-x',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastSyncedAt: null,
        content: [],
      });

      vi.spyOn(
        service as never,
        'fetchPlaylistPrograms' as never,
      ).mockResolvedValue([movie1, movie2] as never);

      // First call fails, second succeeds
      mockScanner.scanSingle
        .mockResolvedValueOnce(Result.failure('scan error'))
        .mockResolvedValueOnce(Result.success(undefined));

      const dbUuid2 = faker.string.uuid();
      vi.mocked(programDB.lookupByExternalIds).mockResolvedValue([
        {
          uuid: dbUuid2,
          sourceType: 'plex',
          externalSourceId: mediaSourceId,
          externalKey: movie2.externalId,
          externalIds: [],
        },
      ] as never);

      await service.syncShow(customShowId);

      // Both programs should have been attempted
      expect(mockScanner.scanSingle).toHaveBeenCalledTimes(2);

      // Content is still upserted — movie2 got a DB UUID, movie1 keeps its original
      expect(customShowDB.upsertCustomShowContent).toHaveBeenCalledTimes(1);
    });
  });
});
