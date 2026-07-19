import { faker } from '@faker-js/faker';
import { describe, expect, it, vi } from 'vitest';
import { Result } from '@/types/result.js';
import { PlexApiClient } from './PlexApiClient.js';

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

vi.mock('@/util/logging/LoggerFactory.js', () => ({
  LoggerFactory: { child: () => fakeLogger, root: fakeLogger },
}));

vi.mock('@/util/version.js', () => ({
  getTunarrVersion: () => '1.0.0-test',
}));

function makeMinimalPlexClient() {
  const mediaSourceId = faker.string.uuid();
  const libraryId = faker.string.uuid();
  const externalLibraryKey = '1';

  const canonicalizer = {
    getCanonicalId: (item: { ratingKey: string }) =>
      `plex://movie/${item.ratingKey}`,
  };

  const client = new PlexApiClient(canonicalizer as never, {
    mediaSource: {
      uuid: mediaSourceId,
      name: 'Test Plex' as never,
      type: 'plex',
      uri: 'http://localhost:32400',
      accessToken: 'test-token',
      libraries: [
        {
          uuid: libraryId,
          externalKey: externalLibraryKey,
          name: 'Movies',
          type: 'movies',
          mediaSourceId,
        } as never,
      ],
    },
  });

  return { client, mediaSourceId, libraryId, externalLibraryKey };
}

function makePlexMovieMetadata(ratingKey: string, librarySectionID: number) {
  return {
    ratingKey,
    key: `/library/metadata/${ratingKey}`,
    guid: `plex://movie/${ratingKey}`,
    Guid: [{ id: `imdb://tt${ratingKey}` }],
    librarySectionID,
    type: 'movie' as const,
    title: `Movie ${ratingKey}`,
    duration: faker.number.int({ min: 3_600_000, max: 7_200_000 }),
    year: 2024,
    addedAt: Date.now(),
    studio: 'Test Studio',
    Media: [
      {
        id: Number(ratingKey),
        duration: 7_200_000,
        bitrate: 8000,
        width: 1920,
        height: 1080,
        videoResolution: '1080',
        container: 'mkv',
        videoCodec: 'h264',
        audioCodec: 'aac',
        Part: [
          {
            id: Number(ratingKey),
            key: `/library/parts/${ratingKey}/file.mkv`,
            duration: 7_200_000,
            file: `/media/movies/movie_${ratingKey}.mkv`,
            size: 1_000_000_000,
            container: 'mkv',
          },
        ],
      },
    ],
  };
}

describe('PlexApiClient', () => {
  describe('getItemChildren', () => {
    it('paginates through all items when totalSize exceeds page size', async () => {
      const { client, externalLibraryKey } = makeMinimalPlexClient();

      const librarySectionID = Number(externalLibraryKey);

      // Create 120 items (should require 3 pages of 50)
      const allMetadata = Array.from({ length: 120 }, (_, i) =>
        makePlexMovieMetadata(String(i + 1), librarySectionID),
      );

      const doGetSpy = vi
        .spyOn(client, 'doTypeCheckedGet' as never)
        .mockImplementation(
          (
            _path: string,
            _schema: unknown,
            config: { params: Record<string, unknown> },
          ) => {
            const offset =
              (config.params['X-Plex-Container-Start'] as number) ?? 0;
            const size =
              (config.params['X-Plex-Container-Size'] as number) ?? 50;
            const page = allMetadata.slice(offset, offset + size);
            return Promise.resolve(
              Result.success({
                MediaContainer: {
                  size: page.length,
                  totalSize: allMetadata.length,
                  Metadata: page,
                },
              }),
            );
          },
        );

      const result = await client.getItemChildren('playlist-1', 'playlist');

      expect(result.isSuccess()).toBe(true);
      const items = result.get();
      expect(items).toHaveLength(120);

      // Verify pagination was called 3 times (0-49, 50-99, 100-119)
      expect(doGetSpy).toHaveBeenCalledTimes(3);
      expect(doGetSpy).toHaveBeenCalledWith(
        '/playlists/playlist-1/items',
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            'X-Plex-Container-Start': 0,
            'X-Plex-Container-Size': 50,
          }),
        }),
      );
      expect(doGetSpy).toHaveBeenCalledWith(
        '/playlists/playlist-1/items',
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            'X-Plex-Container-Start': 50,
            'X-Plex-Container-Size': 50,
          }),
        }),
      );
      expect(doGetSpy).toHaveBeenCalledWith(
        '/playlists/playlist-1/items',
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            'X-Plex-Container-Start': 100,
            'X-Plex-Container-Size': 50,
          }),
        }),
      );
    });

    it('returns all items in a single request when totalSize <= page size', async () => {
      const { client, externalLibraryKey } = makeMinimalPlexClient();

      const librarySectionID = Number(externalLibraryKey);
      const allMetadata = Array.from({ length: 10 }, (_, i) =>
        makePlexMovieMetadata(String(i + 1), librarySectionID),
      );

      const doGetSpy = vi
        .spyOn(client, 'doTypeCheckedGet' as never)
        .mockImplementation(() => {
          return Promise.resolve(
            Result.success({
              MediaContainer: {
                size: allMetadata.length,
                totalSize: allMetadata.length,
                Metadata: allMetadata,
              },
            }),
          );
        });

      const result = await client.getItemChildren('playlist-2', 'playlist');

      expect(result.isSuccess()).toBe(true);
      expect(result.get()).toHaveLength(10);
      expect(doGetSpy).toHaveBeenCalledTimes(1);
    });

    it('returns partial results with a warning when a mid-pagination request fails', async () => {
      const { client, externalLibraryKey } = makeMinimalPlexClient();

      const librarySectionID = Number(externalLibraryKey);
      const firstPage = Array.from({ length: 50 }, (_, i) =>
        makePlexMovieMetadata(String(i + 1), librarySectionID),
      );

      vi.spyOn(client, 'doTypeCheckedGet' as never)
        .mockImplementationOnce(() =>
          Promise.resolve(
            Result.success({
              MediaContainer: {
                size: 50,
                totalSize: 150,
                Metadata: firstPage,
              },
            }),
          ),
        )
        .mockImplementationOnce(() =>
          Promise.resolve(Result.forError(new Error('network timeout'))),
        );

      const result = await client.getItemChildren('playlist-3', 'playlist');

      // Should return the first page of items we collected
      expect(result.isSuccess()).toBe(true);
      expect(result.get()).toHaveLength(50);
      expect(fakeLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch page at offset'),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('returns an error when the first request fails', async () => {
      const { client } = makeMinimalPlexClient();

      vi.spyOn(client, 'doTypeCheckedGet' as never).mockImplementation(() =>
        Promise.resolve(Result.forError(new Error('connection refused'))),
      );

      const result = await client.getItemChildren('playlist-4', 'playlist');

      expect(result.isFailure()).toBe(true);
    });

    it('drops items with unmatched librarySectionID and logs debug message', async () => {
      const { client, externalLibraryKey } = makeMinimalPlexClient();

      const matchedLibrary = Number(externalLibraryKey); // library "1" exists
      const unmatchedLibrary = 99; // library "99" does NOT exist

      const metadata = [
        makePlexMovieMetadata('1', matchedLibrary),
        makePlexMovieMetadata('2', unmatchedLibrary),
        makePlexMovieMetadata('3', matchedLibrary),
      ];

      vi.spyOn(client, 'doTypeCheckedGet' as never).mockImplementation(() =>
        Promise.resolve(
          Result.success({
            MediaContainer: {
              size: metadata.length,
              totalSize: metadata.length,
              Metadata: metadata,
            },
          }),
        ),
      );

      const result = await client.getItemChildren('playlist-5', 'playlist');

      expect(result.isSuccess()).toBe(true);
      // Only 2 of 3 items match the synced library
      expect(result.get()).toHaveLength(2);
      // Debug log for the dropped item
      expect(fakeLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('no matching library'),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
