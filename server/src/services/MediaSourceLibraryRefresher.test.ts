import { tag } from '@tunarr/types';
import type { EmbyItem } from '@tunarr/types/emby';
import type { JellyfinVirtualFolder } from '@tunarr/types/jellyfin';
import type { PlexLibrarySection } from '@tunarr/types/plex';
import { anything, capture, instance, mock, verify, when } from 'ts-mockito';
import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import { MediaSourceDB } from '../db/mediaSourceDB.ts';
import type { MediaSourceId, MediaSourceName } from '../db/schema/base.ts';
import type { MediaSourceWithRelations } from '../db/schema/derivedTypes.ts';
import type { MediaSourceLibrary } from '../db/schema/MediaSourceLibrary.ts';
import { QueryError } from '../external/BaseApiClient.ts';
import type { EmbyApiClient } from '../external/emby/EmbyApiClient.ts';
import type { JellyfinApiClient } from '../external/jellyfin/JellyfinApiClient.ts';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.ts';
import type { PlexApiClient } from '../external/plex/PlexApiClient.ts';
import { Result } from '../types/result.ts';
import { MediaSourceLibraryRefresher } from './MediaSourceLibraryRefresher.ts';

const mediaSourceId = tag<MediaSourceId>(v4());

function storedLibrary(
  overrides: Partial<MediaSourceLibrary> = {},
): MediaSourceLibrary {
  return {
    uuid: v4(),
    name: 'Movies',
    mediaType: 'movies',
    mediaSourceId,
    lastScannedAt: null,
    externalKey: '1',
    enabled: true,
    unavailableSince: null,
    ...overrides,
  };
}

function makeMediaSource(
  type: 'plex' | 'jellyfin' | 'emby',
  libraries: MediaSourceLibrary[],
): MediaSourceWithRelations {
  return {
    uuid: mediaSourceId,
    createdAt: null,
    updatedAt: null,
    accessToken: '',
    clientIdentifier: null,
    index: 0,
    name: tag<MediaSourceName>('Test Media Source'),
    sendChannelUpdates: false,
    sendGuideUpdates: false,
    type,
    uri: 'http://localhost',
    username: null,
    userId: null,
    mediaType: null,
    libraries,
    paths: [],
    replacePaths: [],
  };
}

function plexSection(
  overrides: Partial<PlexLibrarySection> = {},
): PlexLibrarySection {
  return {
    allowSync: false,
    filters: false,
    refreshing: false,
    key: '1',
    type: 'movie',
    title: 'Movies',
    agent: 'tv.plex.agents.movie',
    scanner: 'Plex Movie',
    language: 'en-US',
    uuid: v4(),
    createdAt: 0,
    content: true,
    directory: true,
    contentChangedAt: 0,
    hidden: false,
    ...overrides,
  };
}

function jellyfinFolder(
  overrides: Partial<JellyfinVirtualFolder> = {},
): JellyfinVirtualFolder {
  return {
    Name: 'Movies',
    CollectionType: 'movies',
    ItemId: '1',
    LibraryOptions: { PathInfos: [] },
    Locations: [],
    ...overrides,
  };
}

// Plain fakes rather than ts-mockito instances, because the factory returns
// clients through a promise and a ts-mockito proxy looks thenable.
function fakePlexClient(sections: PlexLibrarySection[]) {
  return {
    getLibrariesRaw: () =>
      Promise.resolve(
        Result.success({
          MediaContainer: { size: sections.length, Directory: sections },
        }),
      ),
  } as unknown as PlexApiClient;
}

function fakeJellyfinClient(
  result: Awaited<ReturnType<JellyfinApiClient['getUserViewsRaw']>>,
) {
  return {
    getUserViewsRaw: () => Promise.resolve(result),
  } as unknown as JellyfinApiClient;
}

function fakeEmbyClient(items: EmbyItem[]) {
  return {
    getUserViewsRaw: () =>
      Promise.resolve(
        Result.success({ Items: items, TotalRecordCount: items.length }),
      ),
  } as unknown as EmbyApiClient;
}

function setup() {
  const db = mock(MediaSourceDB);
  const factory = mock(MediaSourceApiFactory);
  when(db.getLibraryReferenceCounts(anything())).thenResolve([]);
  const refresher = new MediaSourceLibraryRefresher(
    instance(db),
    instance(factory),
  );
  return { db, factory, refresher };
}

describe('MediaSourceLibraryRefresher', () => {
  test('Plex: marks a library missing from the response unavailable', async () => {
    const { db, factory, refresher } = setup();
    const movies = storedLibrary({ externalKey: '1' });
    const shows = storedLibrary({
      externalKey: '2',
      name: 'Shows',
      mediaType: 'shows',
    });
    when(factory.getPlexApiClientForMediaSource(anything())).thenResolve(
      fakePlexClient([
        plexSection({ key: '1' }),
        plexSection({ key: '3', type: 'photo', title: 'Photos' }),
      ]),
    );

    await refresher.refreshMediaSource(
      makeMediaSource('plex', [movies, shows]),
    );

    const [update] = capture(db.updateLibraries).last();
    expect(update.unavailableLibraries).toEqual([
      { uuid: shows.uuid, unavailableSince: expect.any(Date) },
    ]);
    expect(update.addedLibraries).toEqual([]);
    expect(update.duplicateLibraries).toEqual([]);
    verify(db.getLibraryReferenceCounts(anything())).once();
  });

  test('Plex: leaves libraries untouched when only unsupported types are returned', async () => {
    const { db, factory, refresher } = setup();
    when(factory.getPlexApiClientForMediaSource(anything())).thenResolve(
      fakePlexClient([plexSection({ key: '3', type: 'photo' })]),
    );

    await refresher.refreshMediaSource(
      makeMediaSource('plex', [storedLibrary()]),
    );

    verify(db.updateLibraries(anything())).never();
  });

  test('Jellyfin: leaves libraries untouched when the request fails', async () => {
    const { db, factory, refresher } = setup();
    when(factory.getJellyfinApiClientForMediaSource(anything())).thenResolve(
      fakeJellyfinClient(
        Result.failure<JellyfinVirtualFolder[], QueryError>(
          QueryError.genericQueryError('Connection refused'),
        ),
      ),
    );

    await refresher.refreshMediaSource(
      makeMediaSource('jellyfin', [storedLibrary()]),
    );

    verify(db.updateLibraries(anything())).never();
  });

  test('Jellyfin: syncs renamed libraries', async () => {
    const { db, factory, refresher } = setup();
    const library = storedLibrary({ name: 'Old Name' });
    when(factory.getJellyfinApiClientForMediaSource(anything())).thenResolve(
      fakeJellyfinClient(
        Result.success([jellyfinFolder({ Name: 'New Name' })]),
      ),
    );

    await refresher.refreshMediaSource(makeMediaSource('jellyfin', [library]));

    const [update] = capture(db.updateLibraries).last();
    expect(update.updatedLibraries).toEqual([
      { uuid: library.uuid, name: 'New Name', mediaType: 'movies' },
    ]);
  });

  test('Emby: marks a returning library available', async () => {
    const { db, factory, refresher } = setup();
    const library = storedLibrary({
      unavailableSince: new Date('2026-09-01T00:00:00Z'),
    });
    when(factory.getEmbyApiClientForMediaSource(anything())).thenResolve(
      fakeEmbyClient([{ Id: '1', Name: 'Movies', CollectionType: 'movies' }]),
    );

    await refresher.refreshMediaSource(makeMediaSource('emby', [library]));

    const [update] = capture(db.updateLibraries).last();
    expect(update.availableLibraries).toEqual([library.uuid]);
    expect(update.unavailableLibraries).toEqual([]);
  });
});
