import { faker } from '@faker-js/faker';
import type { MediaSourceId } from '@/db/schema/base.js';
import type { PlexApiClient } from '@/external/plex/PlexApiClient.js';
import { tag } from '@tunarr/types';
import type { Movie } from '@tunarr/types';
import { map, range } from 'lodash-es';
import { describe, expect, it, vi } from 'vitest';
import { PlexHierarchyTraversal } from './PlexItemEnumerator.ts';

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

function makeMovie(mediaSourceId: MediaSourceId, libraryId: string): Movie {
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
  };
}

describe('PlexHierarchyTraversal', () => {
  describe('expandAncestors', () => {
    // Regression test for #2038: movies need no ancestor lookups, so every
    // task settled without I/O and the pool handed back only every third one.
    it('returns every movie in a playlist-sized batch', async () => {
      const mediaSourceId = tag<MediaSourceId>(faker.string.uuid());
      const libraryId = faker.string.uuid();
      const movies = range(0, 40).map(() =>
        makeMovie(mediaSourceId, libraryId),
      );

      const plexClient = {
        getSeason: vi.fn(),
        getShow: vi.fn(),
      } as unknown as PlexApiClient;

      const expanded = await new PlexHierarchyTraversal(
        plexClient,
      ).expandAncestors(movies);

      expect(map(expanded, 'externalId')).toEqual(map(movies, 'externalId'));
    });
  });
});
