import type { MediaSourceId } from '@tunarr/shared';
import type { Collection, ProgramOrFolder } from '@tunarr/types';
import { v4 } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExternalCollectionRepo } from '../../db/ExternalCollectionRepo.ts';
import type { TagRepo } from '../../db/TagRepo.ts';
import type { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import type { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type { ExternalCollection } from '../../db/schema/ExternalCollection.ts';
import { MediaSourceOrm } from '../../db/schema/MediaSource.ts';
import { MediaSourceLibrary } from '../../db/schema/MediaSourceLibrary.ts';
import type { Tag } from '../../db/schema/Tag.ts';
import type { RemoteSourceType } from '../../db/schema/base.ts';
import type { MediaSourceWithRelations } from '../../db/schema/derivedTypes.ts';
import type { MediaSourceApiFactory } from '../../external/MediaSourceApiFactory.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type {
  MeilisearchService,
  ProgramSearchDocument,
  TerminalProgramSearchDocument,
} from '../MeilisearchService.ts';
import { ExternalCollectionScanner } from './ExternalCollectionScanner.ts';

// --- Test double: concrete subclass of the abstract scanner ---

type MockApiClient = Record<string, never>;

class TestCollectionScanner extends ExternalCollectionScanner<MockApiClient> {
  readonly sourceType: RemoteSourceType = 'jellyfin';
  @InjectLogger() declare readonly logger: Logger;

  getApiClient = vi.fn<
    (ms: MediaSourceWithRelations) => Promise<MockApiClient>
  >(() => Promise.resolve({}));
  getAllLibraryCollections =
    vi.fn<
      (client: MockApiClient, libraryId: string) => AsyncIterable<Collection>
    >();
  getCollectionItems =
    vi.fn<
      (
        client: MockApiClient,
        libraryId: string,
        collectionId: string,
      ) => AsyncIterable<ProgramOrFolder>
    >();
}

// --- Factory helpers for test data ---

function makeMediaSourceId(): MediaSourceId {
  return v4() as MediaSourceId;
}

function makeMediaSource(
  libraries: MediaSourceLibrary[] = [],
  overrides: Partial<MediaSourceOrm> = {},
): MediaSourceWithRelations {
  return {
    uuid: makeMediaSourceId(),
    type: 'jellyfin',
    name: 'Test Jellyfin' as never,
    uri: 'http://localhost:8096',
    accessToken: 'token',
    index: 0,
    createdAt: null,
    updatedAt: null,
    clientIdentifier: null,
    sendChannelUpdates: false,
    sendGuideUpdates: false,
    username: null,
    userId: null,
    mediaType: null,
    libraries,
    paths: [],
    replacePaths: [],
    ...overrides,
  };
}

function makeLibrary(
  mediaSourceId: MediaSourceId,
  overrides: Partial<MediaSourceLibrary> = {},
): MediaSourceLibrary {
  return {
    uuid: v4(),
    name: 'Movies',
    mediaType: 'movies',
    mediaSourceId,
    externalKey: 'lib-ext-1',
    enabled: true,
    lastScannedAt: null,
    ...overrides,
  };
}

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    type: 'collection',
    externalId: v4(),
    title: 'Test Collection',
    sourceType: 'jellyfin',
    uuid: v4(),
    mediaSourceId: v4(),
    libraryId: v4(),
    childType: undefined,
    ...overrides,
  };
}

function makeExternalCollection(
  overrides: Partial<ExternalCollection> = {},
): ExternalCollection {
  return {
    uuid: v4(),
    externalKey: v4(),
    libraryId: v4(),
    mediaSourceId: v4() as MediaSourceId,
    sourceType: 'jellyfin',
    title: 'Test Collection',
    ...overrides,
  };
}

function makeTag(tagName: string): Tag {
  return { uuid: v4(), tag: tagName };
}

function makeMovieItem(externalId = v4()): ProgramOrFolder {
  return { type: 'movie', externalId } as ProgramOrFolder;
}

function makeShowItem(externalId = v4()): ProgramOrFolder {
  return { type: 'show', externalId } as ProgramOrFolder;
}

/** Yields all items from an array as an async iterable */
async function* asyncOf<T>(...items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

// --- Mock factory helpers ---

function makeMocks() {
  const logger: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as Logger;

  const mediaSourceDB: MediaSourceDB = {
    getById: vi.fn(),
    getLibrary: vi.fn(),
  } as unknown as MediaSourceDB;

  const mediaSourceApiFactory: MediaSourceApiFactory =
    {} as unknown as MediaSourceApiFactory;

  const externalCollectionsRepo: ExternalCollectionRepo = {
    getByLibraryId: vi.fn().mockResolvedValue([]),
    insertCollection: vi.fn().mockResolvedValue(undefined),
    deleteCollection: vi.fn().mockResolvedValue(undefined),
    getById: vi.fn().mockResolvedValue(undefined),
    getCollectionProgramGroupings: vi.fn().mockResolvedValue([]),
    getCollectionPrograms: vi.fn().mockResolvedValue([]),
  } as unknown as ExternalCollectionRepo;

  const searchService: MeilisearchService = {
    waitForPendingIndexTasks: vi.fn().mockResolvedValue(undefined),
    getPrograms: vi.fn().mockResolvedValue([]),
    updatePrograms: vi.fn().mockResolvedValue(undefined),
  } as unknown as MeilisearchService;

  const programDB: IProgramDB = {
    lookupByExternalIds: vi.fn().mockResolvedValue([]),
    getProgramGroupingsByExternalIds: vi.fn().mockResolvedValue([]),
    getChildren: vi.fn().mockResolvedValue({ results: [], total: 0 }),
    getProgramGroupingDescendants: vi.fn().mockResolvedValue([]),
  } as unknown as IProgramDB;

  const tagRepo: TagRepo = {
    upsertTag: vi.fn(),
    tagPrograms: vi.fn().mockResolvedValue(undefined),
    tagProgramGroupings: vi.fn().mockResolvedValue(undefined),
    untagPrograms: vi.fn().mockResolvedValue(undefined),
    untagProgramGroupings: vi.fn().mockResolvedValue(undefined),
  } as unknown as TagRepo;

  return {
    logger,
    mediaSourceDB,
    mediaSourceApiFactory,
    externalCollectionsRepo,
    searchService,
    programDB,
    tagRepo,
  };
}

// --- Tests ---

describe('ExternalCollectionScanner', () => {
  let mocks: ReturnType<typeof makeMocks>;
  let scanner: TestCollectionScanner;

  beforeEach(() => {
    mocks = makeMocks();
    scanner = new TestCollectionScanner(
      mocks.mediaSourceDB,
      mocks.mediaSourceApiFactory,
      mocks.externalCollectionsRepo,
      mocks.searchService,
      mocks.programDB,
      mocks.tagRepo,
    );
    // Logger is normally injected via @InjectLogger() decorator;
    // assign it manually in tests.
    (scanner as unknown as { logger: Logger }).logger = mocks.logger;
  });

  describe('scan()', () => {
    it('throws when the media source is not found', async () => {
      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(undefined);
      const mediaSourceId = makeMediaSourceId();

      await expect(scanner.scan({ mediaSourceId })).rejects.toThrow(
        `Could not find media source with ID ${mediaSourceId}`,
      );
    });

    it('returns early when there are no enabled libraries', async () => {
      const mediaSource = makeMediaSource([
        makeLibrary(makeMediaSourceId(), { enabled: false }),
      ]);
      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);

      await scanner.scan({ mediaSourceId: mediaSource.uuid });

      expect(scanner.getAllLibraryCollections).not.toHaveBeenCalled();
      expect(
        mocks.externalCollectionsRepo.getByLibraryId,
      ).not.toHaveBeenCalled();
    });

    it('scans only enabled libraries when some are disabled', async () => {
      const msId = makeMediaSourceId();
      const enabledLib = makeLibrary(msId, {
        uuid: 'enabled-lib',
        enabled: true,
      });
      const disabledLib = makeLibrary(msId, {
        uuid: 'disabled-lib',
        enabled: false,
      });
      const mediaSource = makeMediaSource([enabledLib, disabledLib], {
        uuid: msId,
      });
      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);
      scanner.getAllLibraryCollections.mockReturnValue(asyncOf());

      await scanner.scan({ mediaSourceId: mediaSource.uuid });

      expect(
        mocks.externalCollectionsRepo.getByLibraryId,
      ).toHaveBeenCalledOnce();
      expect(mocks.externalCollectionsRepo.getByLibraryId).toHaveBeenCalledWith(
        'enabled-lib',
      );
    });

    it('inserts a new ExternalCollection and upserts a tag for each discovered collection', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId);
      const mediaSource = makeMediaSource([library], { uuid: msId });
      const collection = makeCollection({
        libraryId: library.uuid,
        mediaSourceId: msId,
      });
      const tag = makeTag(collection.title);

      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);
      scanner.getAllLibraryCollections.mockReturnValue(asyncOf(collection));
      scanner.getCollectionItems.mockReturnValue(asyncOf());
      vi.mocked(mocks.tagRepo.upsertTag).mockResolvedValue(tag);

      await scanner.scan({ mediaSourceId: msId });

      expect(mocks.tagRepo.upsertTag).toHaveBeenCalledWith(collection.title);
      expect(
        mocks.externalCollectionsRepo.insertCollection,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          externalKey: collection.externalId,
          libraryId: library.uuid,
          mediaSourceId: msId,
          sourceType: 'jellyfin',
          title: collection.title,
        }),
      );
    });

    it('does not re-insert an ExternalCollection that already exists', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId);
      const mediaSource = makeMediaSource([library], { uuid: msId });
      const collection = makeCollection({
        libraryId: library.uuid,
        mediaSourceId: msId,
      });
      const existingColl = makeExternalCollection({
        externalKey: collection.externalId,
        libraryId: library.uuid,
        mediaSourceId: msId,
      });
      const tag = makeTag(collection.title);

      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);
      vi.mocked(mocks.externalCollectionsRepo.getByLibraryId).mockResolvedValue(
        [existingColl],
      );
      scanner.getAllLibraryCollections.mockReturnValue(asyncOf(collection));
      scanner.getCollectionItems.mockReturnValue(asyncOf());
      vi.mocked(mocks.tagRepo.upsertTag).mockResolvedValue(tag);

      await scanner.scan({ mediaSourceId: msId });

      expect(
        mocks.externalCollectionsRepo.insertCollection,
      ).not.toHaveBeenCalled();
    });

    it('tags new program items (movies, episodes) added to a collection', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId);
      const mediaSource = makeMediaSource([library], { uuid: msId });
      const collection = makeCollection({
        libraryId: library.uuid,
        mediaSourceId: msId,
      });
      const tag = makeTag(collection.title);

      const movieExtId = 'movie-ext-1';
      const programUuid = v4();
      const movieItem = makeMovieItem(movieExtId);

      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);
      scanner.getAllLibraryCollections.mockReturnValue(asyncOf(collection));
      scanner.getCollectionItems.mockReturnValue(asyncOf(movieItem));
      vi.mocked(mocks.tagRepo.upsertTag).mockResolvedValue(tag);
      vi.mocked(mocks.programDB.lookupByExternalIds).mockResolvedValue([
        {
          uuid: programUuid,
          type: 'movie',
          externalIds: [
            {
              sourceType: 'jellyfin',
              externalKey: movieExtId,
              externalSourceId: msId,
            },
          ],
        } as never,
      ]);

      await scanner.scan({ mediaSourceId: msId });

      expect(mocks.tagRepo.tagPrograms).toHaveBeenCalledWith(tag.uuid, [
        programUuid,
      ]);
    });

    it('tags new grouping items (shows, artists) added to a collection', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId);
      const mediaSource = makeMediaSource([library], { uuid: msId });
      const collection = makeCollection({
        libraryId: library.uuid,
        mediaSourceId: msId,
      });
      const tag = makeTag(collection.title);

      const showExtId = 'show-ext-1';
      const groupingUuid = v4();
      const showItem = makeShowItem(showExtId);

      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);
      scanner.getAllLibraryCollections.mockReturnValue(asyncOf(collection));
      scanner.getCollectionItems.mockReturnValue(asyncOf(showItem));
      vi.mocked(mocks.tagRepo.upsertTag).mockResolvedValue(tag);
      vi.mocked(
        mocks.programDB.getProgramGroupingsByExternalIds,
      ).mockResolvedValue([
        {
          uuid: groupingUuid,
          type: 'show',
          externalIds: [
            {
              sourceType: 'jellyfin',
              externalKey: showExtId,
              externalSourceId: msId,
            },
          ],
        } as never,
      ]);

      await scanner.scan({ mediaSourceId: msId });

      expect(mocks.tagRepo.tagProgramGroupings).toHaveBeenCalledWith(tag.uuid, [
        groupingUuid,
      ]);
    });

    it('handles mixed-type collections (programs + groupings) from Jellyfin/Emby', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId);
      const mediaSource = makeMediaSource([library], { uuid: msId });
      const collection = makeCollection({
        libraryId: library.uuid,
        mediaSourceId: msId,
      });
      const tag = makeTag(collection.title);

      const movieExtId = 'movie-ext-1';
      const showExtId = 'show-ext-1';
      const programUuid = v4();
      const groupingUuid = v4();

      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);
      scanner.getAllLibraryCollections.mockReturnValue(asyncOf(collection));
      // Collection contains both a movie (program) and a show (grouping)
      scanner.getCollectionItems.mockReturnValue(
        asyncOf(makeMovieItem(movieExtId), makeShowItem(showExtId)),
      );
      vi.mocked(mocks.tagRepo.upsertTag).mockResolvedValue(tag);
      vi.mocked(mocks.programDB.lookupByExternalIds).mockResolvedValue([
        {
          uuid: programUuid,
          type: 'movie',
          externalIds: [
            {
              sourceType: 'jellyfin',
              externalKey: movieExtId,
              externalSourceId: msId,
            },
          ],
        } as never,
      ]);
      vi.mocked(
        mocks.programDB.getProgramGroupingsByExternalIds,
      ).mockResolvedValue([
        {
          uuid: groupingUuid,
          type: 'show',
          externalIds: [
            {
              sourceType: 'jellyfin',
              externalKey: showExtId,
              externalSourceId: msId,
            },
          ],
        } as never,
      ]);

      await scanner.scan({ mediaSourceId: msId });

      expect(mocks.tagRepo.tagPrograms).toHaveBeenCalledWith(tag.uuid, [
        programUuid,
      ]);
      expect(mocks.tagRepo.tagProgramGroupings).toHaveBeenCalledWith(tag.uuid, [
        groupingUuid,
      ]);
    });

    it('untags programs removed from an existing collection', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId);
      const mediaSource = makeMediaSource([library], { uuid: msId });
      const collection = makeCollection({
        libraryId: library.uuid,
        mediaSourceId: msId,
      });
      const tag = makeTag(collection.title);
      const existingColl = makeExternalCollection({
        externalKey: collection.externalId,
        libraryId: library.uuid,
        mediaSourceId: msId,
      });

      const removedProgramUuid = v4();
      const removedProgramExtKey = 'removed-movie-ext';

      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);
      vi.mocked(mocks.externalCollectionsRepo.getByLibraryId).mockResolvedValue(
        [existingColl],
      );
      // Previously this program was in the collection
      vi.mocked(
        mocks.externalCollectionsRepo.getCollectionPrograms,
      ).mockResolvedValue([
        {
          uuid: removedProgramUuid,
          type: 'movie',
          externalKey: removedProgramExtKey,
          externalIds: [
            { sourceType: 'jellyfin', externalKey: removedProgramExtKey },
          ],
        } as never,
      ]);
      scanner.getAllLibraryCollections.mockReturnValue(asyncOf(collection));
      // Collection is now empty — program was removed
      scanner.getCollectionItems.mockReturnValue(asyncOf());
      vi.mocked(mocks.tagRepo.upsertTag).mockResolvedValue(tag);

      await scanner.scan({ mediaSourceId: msId });

      expect(mocks.tagRepo.untagPrograms).toHaveBeenCalledWith(tag.uuid, [
        removedProgramUuid,
      ]);
    });

    it('untags groupings removed from an existing collection', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId);
      const mediaSource = makeMediaSource([library], { uuid: msId });
      const collection = makeCollection({
        libraryId: library.uuid,
        mediaSourceId: msId,
      });
      const tag = makeTag(collection.title);
      const existingColl = makeExternalCollection({
        externalKey: collection.externalId,
        libraryId: library.uuid,
        mediaSourceId: msId,
      });

      const removedGroupingUuid = v4();
      const removedGroupingExtKey = 'removed-show-ext';

      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);
      vi.mocked(mocks.externalCollectionsRepo.getByLibraryId).mockResolvedValue(
        [existingColl],
      );
      vi.mocked(
        mocks.externalCollectionsRepo.getCollectionProgramGroupings,
      ).mockResolvedValue([
        {
          uuid: removedGroupingUuid,
          type: 'show',
          externalKey: removedGroupingExtKey,
          externalIds: [
            { sourceType: 'jellyfin', externalKey: removedGroupingExtKey },
          ],
        } as never,
      ]);
      scanner.getAllLibraryCollections.mockReturnValue(asyncOf(collection));
      scanner.getCollectionItems.mockReturnValue(asyncOf());
      vi.mocked(mocks.tagRepo.upsertTag).mockResolvedValue(tag);

      await scanner.scan({ mediaSourceId: msId });

      expect(mocks.tagRepo.untagProgramGroupings).toHaveBeenCalledWith(
        tag.uuid,
        [removedGroupingUuid],
      );
    });

    it('deletes and untags items from collections that no longer exist in the source', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId);
      const mediaSource = makeMediaSource([library], { uuid: msId });

      const missingCollectionExtId = 'missing-coll-ext';
      const missingCollUuid = v4();
      const missingColl = makeExternalCollection({
        uuid: missingCollUuid,
        externalKey: missingCollectionExtId,
        libraryId: library.uuid,
        mediaSourceId: msId,
        title: 'Gone Collection',
      });
      const taggedProgramUuid = v4();

      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);
      vi.mocked(mocks.externalCollectionsRepo.getByLibraryId).mockResolvedValue(
        [missingColl],
      );
      // API returns no collections now
      scanner.getAllLibraryCollections.mockReturnValue(asyncOf());
      // getById for the missing collection returns it with its programs
      vi.mocked(mocks.externalCollectionsRepo.getById).mockResolvedValue({
        ...missingColl,
        programs: [{ program: { uuid: taggedProgramUuid, type: 'movie' } }],
        groupings: [],
      } as never);

      await scanner.scan({ mediaSourceId: msId });

      expect(
        mocks.externalCollectionsRepo.deleteCollection,
      ).toHaveBeenCalledWith(missingCollUuid);
    });

    it('catches errors from individual library scans and continues to the next library', async () => {
      const msId = makeMediaSourceId();
      const failingLib = makeLibrary(msId, {
        uuid: 'failing-lib',
        externalKey: 'fail',
      });
      const successLib = makeLibrary(msId, {
        uuid: 'success-lib',
        externalKey: 'success',
      });
      const mediaSource = makeMediaSource([failingLib, successLib], {
        uuid: msId,
      });

      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);

      // First library throws; second returns nothing
      scanner.getAllLibraryCollections.mockImplementation((_, libraryKey) => {
        if (libraryKey === 'fail') {
          return (async function* () {
            throw new Error('Scan failed');
            // eslint-disable-next-line no-unreachable
            yield makeCollection();
          })();
        }
        return asyncOf();
      });

      // Should not throw — error is caught per-library
      await expect(
        scanner.scan({ mediaSourceId: msId }),
      ).resolves.not.toThrow();
      expect(mocks.logger.warn).toHaveBeenCalled();
    });

    it('sends search index updates for newly tagged programs', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId);
      const mediaSource = makeMediaSource([library], { uuid: msId });
      const collection = makeCollection({
        libraryId: library.uuid,
        mediaSourceId: msId,
      });
      const tag = makeTag(collection.title);

      const movieExtId = 'movie-ext-1';
      const programUuid = v4();

      vi.mocked(mocks.mediaSourceDB.getById).mockResolvedValue(mediaSource);
      scanner.getAllLibraryCollections.mockReturnValue(asyncOf(collection));
      scanner.getCollectionItems.mockReturnValue(
        asyncOf(makeMovieItem(movieExtId)),
      );
      vi.mocked(mocks.tagRepo.upsertTag).mockResolvedValue(tag);
      vi.mocked(mocks.programDB.lookupByExternalIds).mockResolvedValue([
        {
          uuid: programUuid,
          type: 'movie',
          externalIds: [
            {
              sourceType: 'jellyfin',
              externalKey: movieExtId,
              externalSourceId: msId,
            },
          ],
        } as never,
      ]);
      // Return a search doc for the program
      const existingDoc: ProgramSearchDocument = {
        id: programUuid,
        tags: ['ExistingTag'],
        type: 'movie',
        duration: 5400000,
        title: 'A Movie',
      } as TerminalProgramSearchDocument;
      vi.mocked(mocks.searchService.getPrograms).mockResolvedValue([
        existingDoc,
      ]);

      await scanner.scan({ mediaSourceId: msId });

      expect(mocks.searchService.updatePrograms).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: programUuid,
            // New tag is added alongside existing tags
            tags: expect.arrayContaining([collection.title, 'ExistingTag']),
          }),
        ]),
      );
    });
  });

  describe('scanLibrary()', () => {
    it('throws when the library is not found', async () => {
      vi.mocked(mocks.mediaSourceDB.getLibrary).mockResolvedValue(undefined);

      await expect(
        scanner.scanLibrary({ libraryId: 'nonexistent-lib' }),
      ).rejects.toThrow(
        'Could not find media source library with ID nonexistent-lib',
      );
    });

    it('returns early when the library is disabled', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId, { enabled: false });
      vi.mocked(mocks.mediaSourceDB.getLibrary).mockResolvedValue({
        ...library,
        mediaSource: makeMediaSource([], { uuid: msId }),
      } as never);

      await scanner.scanLibrary({ libraryId: library.uuid });

      expect(scanner.getAllLibraryCollections).not.toHaveBeenCalled();
    });

    it('throws when the library belongs to a different source type', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId, { enabled: true });
      vi.mocked(mocks.mediaSourceDB.getLibrary).mockResolvedValue({
        ...library,
        mediaSource: makeMediaSource([], { uuid: msId, type: 'plex' }),
      } as never);

      await expect(
        scanner.scanLibrary({ libraryId: library.uuid }),
      ).rejects.toThrow(/non-jellyfin media source/);
    });

    it('scans successfully when library is enabled and type matches', async () => {
      const msId = makeMediaSourceId();
      const library = makeLibrary(msId, { enabled: true });
      vi.mocked(mocks.mediaSourceDB.getLibrary).mockResolvedValue({
        ...library,
        mediaSource: makeMediaSource([], { uuid: msId, type: 'jellyfin' }),
      } as never);
      scanner.getAllLibraryCollections.mockReturnValue(asyncOf());

      await expect(
        scanner.scanLibrary({ libraryId: library.uuid }),
      ).resolves.not.toThrow();

      expect(scanner.getAllLibraryCollections).toHaveBeenCalledOnce();
    });
  });
});
