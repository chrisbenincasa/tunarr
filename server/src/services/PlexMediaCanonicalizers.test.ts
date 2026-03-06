import type {
  PlexEpisode,
  PlexLibraryCollection,
  PlexMediaDescription,
  PlexMovie,
  PlexMusicAlbum,
  PlexMusicArtist,
  PlexMusicTrack,
  PlexPlaylist,
  PlexTvSeason,
  PlexTvShow,
} from '@tunarr/types/plex';
import { describe, expect, it } from 'vitest';
import { PlexMediaCanonicalizer } from './PlexMediaCanonicalizers.js';

const canonicalizer = new PlexMediaCanonicalizer();

// Typed base part — all hashed fields populated. Used as a building block.
const basePart: PlexMediaDescription['Part'][0] = {
  id: 1,
  key: '/library/parts/1/file.mkv',
  file: '/media/file.mkv',
  duration: 7200000,
  size: 4000000000,
  container: 'mkv',
  videoProfile: 'high',
  audioProfile: 'dts',
};

// A video stream with a known id for stream-level hash testing.
const baseStream = {
  streamType: 1 as const,
  id: 100,
  codec: 'h264',
  index: 0,
  height: 1080,
  width: 1920,
};

// Parts that include streams (for episode / track tests).
const basePartWithStream: PlexMediaDescription['Part'][0] = {
  ...basePart,
  Stream: [baseStream],
};

// Typed media descriptions used in episode / track tests so we can spread
// them without running into noUncheckedIndexedAccess issues from arr[0].
const baseMediaNoStream: PlexMediaDescription = {
  id: 10,
  Part: [basePart],
};

const baseMediaWithStream: PlexMediaDescription = {
  id: 10,
  Part: [basePartWithStream],
};

// ============================================================
// PlexMovie
// ============================================================

const baseMovie: PlexMovie = {
  type: 'movie',
  ratingKey: '1',
  key: '/library/metadata/1',
  guid: 'plex://movie/abc123',
  title: 'Test Movie',
  addedAt: 1000000,
  updatedAt: 2000000,
  Media: [baseMediaNoStream],
};

describe('PlexMediaCanonicalizer - movie', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).toBe(
      canonicalizer.getCanonicalId({ ...baseMovie }),
    );
  });

  it('changes id when key changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        key: '/library/metadata/999',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, title: 'Different Title' }),
    );
  });

  it('changes id when addedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, addedAt: 9999999 }),
    );
  });

  it('changes id when addedAt is removed', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, addedAt: undefined }),
    );
  });

  it('changes id when updatedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, updatedAt: 9999999 }),
    );
  });

  it('changes id when media id changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        Media: [{ ...baseMediaNoStream, id: 99 }],
      }),
    );
  });

  it('changes id when part id changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        Media: [{ ...baseMediaNoStream, Part: [{ ...basePart, id: 999 }] }],
      }),
    );
  });

  it('changes id when part key changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        Media: [
          { ...baseMediaNoStream, Part: [{ ...basePart, key: '/other/key' }] },
        ],
      }),
    );
  });

  it('changes id when part file changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        Media: [
          {
            ...baseMediaNoStream,
            Part: [{ ...basePart, file: '/media/other.mkv' }],
          },
        ],
      }),
    );
  });

  it('changes id when part duration changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        Media: [
          { ...baseMediaNoStream, Part: [{ ...basePart, duration: 1234567 }] },
        ],
      }),
    );
  });

  it('changes id when part size changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        Media: [{ ...baseMediaNoStream, Part: [{ ...basePart, size: 1 }] }],
      }),
    );
  });

  it('changes id when part container changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        Media: [
          { ...baseMediaNoStream, Part: [{ ...basePart, container: 'mp4' }] },
        ],
      }),
    );
  });

  it('changes id when part videoProfile changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        Media: [
          {
            ...baseMediaNoStream,
            Part: [{ ...basePart, videoProfile: 'main' }],
          },
        ],
      }),
    );
  });

  it('changes id when part audioProfile changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        Media: [
          {
            ...baseMediaNoStream,
            Part: [{ ...basePart, audioProfile: 'lc' }],
          },
        ],
      }),
    );
  });

  it('changes id when a second media entry is added', () => {
    const secondMedia: PlexMediaDescription = {
      id: 20,
      Part: [{ ...basePart, id: 2 }],
    };
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        Media: [baseMediaNoStream, secondMedia],
      }),
    );
  });

  it('does not change id when guid changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        guid: 'plex://movie/different',
      }),
    );
  });

  it('does not change id when ratingKey changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, ratingKey: '999' }),
    );
  });

  it('does not change id when studio changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, studio: 'Warner Bros' }),
    );
  });

  it('does not change id when thumb changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, thumb: '/thumb/new.jpg' }),
    );
  });

  it('does not change id when year changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, year: 2024 }),
    );
  });
});

// ============================================================
// PlexTvShow
// ============================================================

const baseShow: PlexTvShow = {
  type: 'show',
  ratingKey: '2',
  key: '/library/metadata/2',
  guid: 'plex://show/abc123',
  title: 'Test Show',
  leafCount: 10,
  addedAt: 1000000,
  updatedAt: 2000000,
  Role: [{ tag: 'Actor A' }],
  Collection: [{ tag: 'Collection X' }],
};

describe('PlexMediaCanonicalizer - show', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).toBe(
      canonicalizer.getCanonicalId({ ...baseShow }),
    );
  });

  it('changes id when key changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseShow,
        key: '/library/metadata/99',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseShow, title: 'Different Show' }),
    );
  });

  it('changes id when addedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseShow, addedAt: 9999999 }),
    );
  });

  it('changes id when updatedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseShow, updatedAt: 9999999 }),
    );
  });

  it('changes id when a role tag changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseShow,
        Role: [{ tag: 'Different Actor' }],
      }),
    );
  });

  it('changes id when a role is added', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseShow,
        Role: [{ tag: 'Actor A' }, { tag: 'Actor B' }],
      }),
    );
  });

  it('changes id when a role is removed', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseShow, Role: [] }),
    );
  });

  it('changes id when a collection tag changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseShow,
        Collection: [{ tag: 'Different Collection' }],
      }),
    );
  });

  it('changes id when a collection is added', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseShow,
        Collection: [{ tag: 'Collection X' }, { tag: 'Collection Y' }],
      }),
    );
  });

  it('does not change id when guid changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).toBe(
      canonicalizer.getCanonicalId({
        ...baseShow,
        guid: 'plex://show/other',
      }),
    );
  });

  it('does not change id when leafCount changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).toBe(
      canonicalizer.getCanonicalId({ ...baseShow, leafCount: 99 }),
    );
  });

  it('does not change id when thumb changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).toBe(
      canonicalizer.getCanonicalId({ ...baseShow, thumb: '/thumb/new.jpg' }),
    );
  });
});

// ============================================================
// PlexLibraryCollection
// ============================================================

const baseCollection: PlexLibraryCollection = {
  type: 'collection',
  ratingKey: '3',
  key: '/library/metadata/3',
  guid: 'plex://collection/abc123',
  title: 'Test Collection',
  summary: 'A test collection',
  index: 1,
  ratingCount: 5,
  addedAt: 1000000,
  updatedAt: 2000000,
  childCount: 10,
  smart: false,
};

describe('PlexMediaCanonicalizer - collection', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseCollection)).toBe(
      canonicalizer.getCanonicalId({ ...baseCollection }),
    );
  });

  it('changes id when key changes', () => {
    expect(canonicalizer.getCanonicalId(baseCollection)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseCollection,
        key: '/library/metadata/99',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseCollection)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseCollection,
        title: 'Different Collection',
      }),
    );
  });

  it('changes id when addedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseCollection)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseCollection, addedAt: 9999999 }),
    );
  });

  it('changes id when updatedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseCollection)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseCollection, updatedAt: 9999999 }),
    );
  });

  it('changes id when childCount changes', () => {
    expect(canonicalizer.getCanonicalId(baseCollection)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseCollection, childCount: 99 }),
    );
  });

  it('changes id when smart changes from false to true', () => {
    expect(canonicalizer.getCanonicalId(baseCollection)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseCollection, smart: true }),
    );
  });

  it('does not change id when summary changes', () => {
    expect(canonicalizer.getCanonicalId(baseCollection)).toBe(
      canonicalizer.getCanonicalId({
        ...baseCollection,
        summary: 'Different Summary',
      }),
    );
  });

  it('does not change id when guid changes', () => {
    expect(canonicalizer.getCanonicalId(baseCollection)).toBe(
      canonicalizer.getCanonicalId({
        ...baseCollection,
        guid: 'plex://collection/other',
      }),
    );
  });

  it('does not change id when ratingKey changes', () => {
    expect(canonicalizer.getCanonicalId(baseCollection)).toBe(
      canonicalizer.getCanonicalId({ ...baseCollection, ratingKey: '999' }),
    );
  });
});

// ============================================================
// PlexTvSeason
// ============================================================

const baseSeason: PlexTvSeason = {
  type: 'season',
  ratingKey: '4',
  key: '/library/metadata/4',
  guid: 'plex://season/abc123',
  title: 'Season 1',
  summary: 'First season',
  leafCount: 10,
  addedAt: 1000000,
  updatedAt: 2000000,
  thumb: '/thumbs/season1.jpg',
};

describe('PlexMediaCanonicalizer - season', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).toBe(
      canonicalizer.getCanonicalId({ ...baseSeason }),
    );
  });

  it('changes id when key changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseSeason,
        key: '/library/metadata/99',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, title: 'Season Two' }),
    );
  });

  it('changes id when addedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, addedAt: 9999999 }),
    );
  });

  it('changes id when updatedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, updatedAt: 9999999 }),
    );
  });

  it('changes id when thumb changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseSeason,
        thumb: '/thumbs/different.jpg',
      }),
    );
  });

  it('changes id when thumb is removed', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, thumb: undefined }),
    );
  });

  it('does not change id when an empty string thumb is replaced by undefined', () => {
    const withEmpty = { ...baseSeason, thumb: '' };
    const withUndefined = { ...baseSeason, thumb: undefined };
    expect(canonicalizer.getCanonicalId(withEmpty)).toBe(
      canonicalizer.getCanonicalId(withUndefined),
    );
  });

  it('does not change id when summary changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).toBe(
      canonicalizer.getCanonicalId({
        ...baseSeason,
        summary: 'Different summary',
      }),
    );
  });

  it('does not change id when leafCount changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, leafCount: 99 }),
    );
  });
});

// ============================================================
// PlexEpisode
// ============================================================

const baseEpisode: PlexEpisode = {
  type: 'episode',
  ratingKey: '5',
  key: '/library/metadata/5',
  guid: 'plex://episode/abc123',
  title: 'Pilot',
  grandparentTitle: 'Test Show',
  addedAt: 1000000,
  updatedAt: 2000000,
  thumb: '/thumbs/ep1.jpg',
  Media: [baseMediaWithStream],
  Director: [{ tag: 'Director A' }],
  Writer: [{ tag: 'Writer A' }],
  Role: [{ tag: 'Actor A' }],
};

describe('PlexMediaCanonicalizer - episode', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode }),
    );
  });

  it('changes id when key changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        key: '/library/metadata/99',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode, title: 'Other Episode' }),
    );
  });

  it('changes id when addedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode, addedAt: 9999999 }),
    );
  });

  it('changes id when updatedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode, updatedAt: 9999999 }),
    );
  });

  it('changes id when thumb changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        thumb: '/thumbs/different.jpg',
      }),
    );
  });

  it('changes id when thumb is removed', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode, thumb: undefined }),
    );
  });

  it('changes id when media id changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Media: [{ ...baseMediaWithStream, id: 99 }],
      }),
    );
  });

  it('changes id when part id changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [{ ...basePartWithStream, id: 999 }],
          },
        ],
      }),
    );
  });

  it('changes id when part key changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [{ ...basePartWithStream, key: '/other/key' }],
          },
        ],
      }),
    );
  });

  it('changes id when part file changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [{ ...basePartWithStream, file: '/media/other.mkv' }],
          },
        ],
      }),
    );
  });

  it('changes id when part duration changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [{ ...basePartWithStream, duration: 1234567 }],
          },
        ],
      }),
    );
  });

  it('changes id when part size changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [{ ...basePartWithStream, size: 1 }],
          },
        ],
      }),
    );
  });

  it('changes id when part container changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [{ ...basePartWithStream, container: 'mp4' }],
          },
        ],
      }),
    );
  });

  it('changes id when part videoProfile changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [{ ...basePartWithStream, videoProfile: 'main' }],
          },
        ],
      }),
    );
  });

  it('changes id when part audioProfile changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [{ ...basePartWithStream, audioProfile: 'lc' }],
          },
        ],
      }),
    );
  });

  it('changes id when stream id changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [
              { ...basePartWithStream, Stream: [{ ...baseStream, id: 999 }] },
            ],
          },
        ],
      }),
    );
  });

  it('changes id when a stream is added', () => {
    const audioStream = {
      streamType: 2 as const,
      id: 200,
      codec: 'aac',
      index: 1,
    };
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [
              { ...basePartWithStream, Stream: [baseStream, audioStream] },
            ],
          },
        ],
      }),
    );
  });

  it('changes id when director tag changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Director: [{ tag: 'Different Director' }],
      }),
    );
  });

  it('changes id when a director is added', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Director: [{ tag: 'Director A' }, { tag: 'Director B' }],
      }),
    );
  });

  it('changes id when writer tag changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Writer: [{ tag: 'Different Writer' }],
      }),
    );
  });

  it('changes id when role tag changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Role: [{ tag: 'Different Actor' }],
      }),
    );
  });

  it('changes id when a tag moves from director to writer', () => {
    expect(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Director: [{ tag: 'X' }],
        Writer: [],
      }),
    ).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Director: [],
        Writer: [{ tag: 'X' }],
      }),
    );
  });

  it('changes id when a tag moves from director to role', () => {
    expect(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Director: [{ tag: 'X' }],
        Role: [],
      }),
    ).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        Director: [],
        Role: [{ tag: 'X' }],
      }),
    );
  });

  it('does not change id when guid changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        guid: 'plex://episode/other',
      }),
    );
  });

  it('does not change id when episode-level duration changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode, duration: 99999 }),
    );
  });

  it('does not change id when grandparentTitle changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        grandparentTitle: 'Different Show',
      }),
    );
  });
});

// ============================================================
// PlexMusicArtist
// ============================================================

const baseArtist: PlexMusicArtist = {
  type: 'artist',
  ratingKey: '6',
  key: '/library/metadata/6',
  guid: 'plex://artist/abc123',
  title: 'Test Artist',
  addedAt: 1000000,
  updatedAt: 2000000,
  thumb: '/thumbs/artist.jpg',
  Genre: [{ tag: 'Rock' }, { tag: 'Alternative' }],
};

describe('PlexMediaCanonicalizer - artist', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).toBe(
      canonicalizer.getCanonicalId({ ...baseArtist }),
    );
  });

  it('changes id when key changes', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseArtist,
        key: '/library/metadata/99',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseArtist, title: 'Other Artist' }),
    );
  });

  it('changes id when addedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseArtist, addedAt: 9999999 }),
    );
  });

  it('changes id when updatedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseArtist, updatedAt: 9999999 }),
    );
  });

  it('changes id when thumb changes', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseArtist,
        thumb: '/thumbs/other.jpg',
      }),
    );
  });

  it('changes id when thumb is removed', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseArtist, thumb: undefined }),
    );
  });

  it('changes id when a genre is added', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseArtist,
        Genre: [{ tag: 'Rock' }, { tag: 'Alternative' }, { tag: 'Indie' }],
      }),
    );
  });

  it('changes id when a genre tag changes', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseArtist,
        Genre: [{ tag: 'Jazz' }, { tag: 'Alternative' }],
      }),
    );
  });

  it('does not change id when genre order changes (genres are sorted)', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).toBe(
      canonicalizer.getCanonicalId({
        ...baseArtist,
        Genre: [{ tag: 'Alternative' }, { tag: 'Rock' }],
      }),
    );
  });

  it('does not change id when guid changes', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).toBe(
      canonicalizer.getCanonicalId({
        ...baseArtist,
        guid: 'plex://artist/other',
      }),
    );
  });

  it('does not change id when summary changes', () => {
    expect(canonicalizer.getCanonicalId(baseArtist)).toBe(
      canonicalizer.getCanonicalId({
        ...baseArtist,
        summary: 'A different summary',
      }),
    );
  });
});

// ============================================================
// PlexMusicAlbum
// ============================================================

const baseAlbum: PlexMusicAlbum = {
  type: 'album',
  ratingKey: '7',
  key: '/library/metadata/7',
  guid: 'plex://album/abc123',
  title: 'Test Album',
  addedAt: 1000000,
  updatedAt: 2000000,
  year: 2020,
  thumb: '/thumbs/album.jpg',
  studio: 'Test Records',
  Genre: [{ tag: 'Rock' }, { tag: 'Alternative' }],
};

describe('PlexMediaCanonicalizer - album', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).toBe(
      canonicalizer.getCanonicalId({ ...baseAlbum }),
    );
  });

  it('changes id when key changes', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseAlbum,
        key: '/library/metadata/99',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseAlbum, title: 'Other Album' }),
    );
  });

  it('changes id when addedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseAlbum, addedAt: 9999999 }),
    );
  });

  it('changes id when updatedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseAlbum, updatedAt: 9999999 }),
    );
  });

  it('changes id when year changes', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseAlbum, year: 2024 }),
    );
  });

  it('changes id when year is removed', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseAlbum, year: undefined }),
    );
  });

  it('changes id when thumb changes', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseAlbum,
        thumb: '/thumbs/other.jpg',
      }),
    );
  });

  it('changes id when thumb is removed', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseAlbum, thumb: undefined }),
    );
  });

  it('changes id when studio changes', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseAlbum, studio: 'Other Records' }),
    );
  });

  it('changes id when studio is removed', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseAlbum, studio: undefined }),
    );
  });

  it('changes id when a genre tag changes', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseAlbum,
        Genre: [{ tag: 'Jazz' }, { tag: 'Alternative' }],
      }),
    );
  });

  it('does not change id when genre order changes (genres are sorted)', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).toBe(
      canonicalizer.getCanonicalId({
        ...baseAlbum,
        Genre: [{ tag: 'Alternative' }, { tag: 'Rock' }],
      }),
    );
  });

  it('does not change id when parentTitle changes', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).toBe(
      canonicalizer.getCanonicalId({
        ...baseAlbum,
        parentTitle: 'Different Artist',
      }),
    );
  });

  it('does not change id when guid changes', () => {
    expect(canonicalizer.getCanonicalId(baseAlbum)).toBe(
      canonicalizer.getCanonicalId({
        ...baseAlbum,
        guid: 'plex://album/other',
      }),
    );
  });
});

// ============================================================
// PlexMusicTrack
// ============================================================

const baseTrack: PlexMusicTrack = {
  type: 'track',
  ratingKey: '8',
  key: '/library/metadata/8',
  guid: 'plex://track/abc123',
  Guid: [{ id: 'mbid://track/abc' }],
  title: 'Test Track',
  grandparentTitle: 'Test Artist',
  addedAt: 1000000,
  updatedAt: 2000000,
  duration: 240000,
  thumb: '/thumbs/track.jpg',
  Media: [baseMediaWithStream],
};

describe('PlexMediaCanonicalizer - track', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).toBe(
      canonicalizer.getCanonicalId({ ...baseTrack }),
    );
  });

  it('changes id when key changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseTrack,
        key: '/library/metadata/99',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseTrack, title: 'Other Track' }),
    );
  });

  it('changes id when addedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseTrack, addedAt: 9999999 }),
    );
  });

  it('changes id when updatedAt changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseTrack, updatedAt: 9999999 }),
    );
  });

  it('changes id when duration changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseTrack, duration: 999999 }),
    );
  });

  it('changes id when duration is removed', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseTrack, duration: undefined }),
    );
  });

  it('changes id when thumb changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseTrack,
        thumb: '/thumbs/other.jpg',
      }),
    );
  });

  it('changes id when thumb is removed', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseTrack, thumb: undefined }),
    );
  });

  it('changes id when media id changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseTrack,
        Media: [{ ...baseMediaWithStream, id: 99 }],
      }),
    );
  });

  it('changes id when part id changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseTrack,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [{ ...basePartWithStream, id: 999 }],
          },
        ],
      }),
    );
  });

  it('changes id when part file changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseTrack,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [{ ...basePartWithStream, file: '/media/other.mp3' }],
          },
        ],
      }),
    );
  });

  it('changes id when part container changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseTrack,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [{ ...basePartWithStream, container: 'flac' }],
          },
        ],
      }),
    );
  });

  it('changes id when stream id changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseTrack,
        Media: [
          {
            ...baseMediaWithStream,
            Part: [
              { ...basePartWithStream, Stream: [{ ...baseStream, id: 999 }] },
            ],
          },
        ],
      }),
    );
  });

  it('changes id when a Guid entry changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseTrack,
        Guid: [{ id: 'mbid://track/different' }],
      }),
    );
  });

  it('changes id when a Guid entry is added', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseTrack,
        Guid: [{ id: 'mbid://track/abc' }, { id: 'isrc://XYZ' }],
      }),
    );
  });

  it('changes id when Guid is removed', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseTrack, Guid: [] }),
    );
  });

  it('does not change id when guid (string) changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).toBe(
      canonicalizer.getCanonicalId({
        ...baseTrack,
        guid: 'plex://track/other',
      }),
    );
  });

  it('does not change id when grandparentTitle changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).toBe(
      canonicalizer.getCanonicalId({
        ...baseTrack,
        grandparentTitle: 'Different Artist',
      }),
    );
  });

  it('does not change id when ratingKey changes', () => {
    expect(canonicalizer.getCanonicalId(baseTrack)).toBe(
      canonicalizer.getCanonicalId({ ...baseTrack, ratingKey: '999' }),
    );
  });
});

// ============================================================
// Playlist (special case — always returns empty string)
// ============================================================

const basePlaylist: PlexPlaylist = {
  type: 'playlist',
  ratingKey: '9',
  key: '/playlists/9',
  guid: 'plex://playlist/abc123',
  title: 'Test Playlist',
  summary: '',
};

describe('PlexMediaCanonicalizer - playlist', () => {
  it('returns an empty string for any playlist', () => {
    expect(canonicalizer.getCanonicalId(basePlaylist)).toBe('');
    expect(
      canonicalizer.getCanonicalId({ ...basePlaylist, title: 'Other' }),
    ).toBe('');
  });
});
