import type {
  Episode,
  MusicAlbum,
  MusicArtist,
  MusicTrack,
  OtherVideo,
  Season,
  Show,
} from '@tunarr/types';
import { describe, expect, it } from 'vitest';
import type { Movie } from '../types/Media.js';
import { LocalMediaCanonicalizer } from './LocalMediaCanonicalizer.js';

const canonicalizer = new LocalMediaCanonicalizer();

// ============================================================
// Shared building blocks
// ============================================================

const baseItem = {
  uuid: '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`,
  sourceType: 'local' as const,
  identifiers: [] as [],
  sortTitle: 'Test',
  tags: [] as string[],
  artwork: [] as [],
};

const tunarrMeta = {
  mediaSourceId: 'source-1',
  libraryId: 'library-1',
  canonicalId: 'canonical-1',
  externalId: 'external-1',
};

const baseTerminalFields = {
  ...baseItem,
  originalTitle: null,
  year: null,
  releaseDate: null,
  releaseDateString: null,
  state: 'ok' as const,
};

const baseGroupingFields = {
  ...baseItem,
  summary: null,
  plot: null,
  tagline: null,
};

// ============================================================
// Movie
// ============================================================

const baseMovie: Movie = {
  ...baseTerminalFields,
  ...tunarrMeta,
  type: 'movie',
  title: 'Test Movie',
  summary: null,
  plot: null,
  tagline: null,
  rating: null,
  duration: 7200000,
};

describe('LocalMediaCanonicalizer - movie', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).toBe(
      canonicalizer.getCanonicalId({ ...baseMovie }),
    );
  });

  it('changes id when externalId changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, externalId: 'other-id' }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, title: 'Different Movie' }),
    );
  });

  it('changes id when mediaSourceId changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, mediaSourceId: 'source-2' }),
    );
  });

  it('changes id when libraryId changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, libraryId: 'library-2' }),
    );
  });

  it('changes id when sourceType changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        sourceType: 'jellyfin' as const,
      }),
    );
  });

  it('changes id when a tag is added', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, tags: ['hd'] }),
    );
  });

  it('does not change id when tag order changes (tags are sorted)', () => {
    const withAB = { ...baseMovie, tags: ['action', 'blockbuster'] };
    const withBA = { ...baseMovie, tags: ['blockbuster', 'action'] };
    expect(canonicalizer.getCanonicalId(withAB)).toBe(
      canonicalizer.getCanonicalId(withBA),
    );
  });

  it('changes id when an identifier is added', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        identifiers: [{ id: 'tt1234567', type: 'imdb' }],
      }),
    );
  });

  it('does not change id when identifier order changes (identifiers are sorted)', () => {
    const withImdbFirst = {
      ...baseMovie,
      identifiers: [
        { id: 'tt1234567', type: 'imdb' as const },
        { id: '12345', type: 'tmdb' as const },
      ],
    };
    const withTmdbFirst = {
      ...baseMovie,
      identifiers: [
        { id: '12345', type: 'tmdb' as const },
        { id: 'tt1234567', type: 'imdb' as const },
      ],
    };
    expect(canonicalizer.getCanonicalId(withImdbFirst)).toBe(
      canonicalizer.getCanonicalId(withTmdbFirst),
    );
  });

  it('changes id when a genre is added', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        genres: [{ name: 'Action' }],
      }),
    );
  });

  it('does not change id when genre order changes (genres are sorted)', () => {
    const withAF = {
      ...baseMovie,
      genres: [{ name: 'Action' }, { name: 'Fantasy' }],
    };
    const withFA = {
      ...baseMovie,
      genres: [{ name: 'Fantasy' }, { name: 'Action' }],
    };
    expect(canonicalizer.getCanonicalId(withAF)).toBe(
      canonicalizer.getCanonicalId(withFA),
    );
  });

  it('changes id when rating changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, rating: 'PG-13' }),
    );
  });

  it('changes id when plot changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, plot: 'A hero rises.' }),
    );
  });

  it('changes id when summary changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, summary: 'A summary.' }),
    );
  });

  it('changes id when tagline changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, tagline: 'This summer...' }),
    );
  });

  it('changes id when duration changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, duration: 3600000 }),
    );
  });

  it('changes id when originalTitle changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        originalTitle: 'Original Title',
      }),
    );
  });

  it('changes id when releaseDate changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, releaseDate: 1704067200 }),
    );
  });

  it('changes id when year changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, year: 2024 }),
    );
  });

  it('changes id when an actor is added', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        actors: [{ name: 'Actor A' }],
      }),
    );
  });

  it('does not change id when actor order changes (actors are sorted by name)', () => {
    const withAB = {
      ...baseMovie,
      actors: [{ name: 'Actor A' }, { name: 'Actor B' }],
    };
    const withBA = {
      ...baseMovie,
      actors: [{ name: 'Actor B' }, { name: 'Actor A' }],
    };
    expect(canonicalizer.getCanonicalId(withAB)).toBe(
      canonicalizer.getCanonicalId(withBA),
    );
  });

  it('changes id when a studio is added', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        studios: [{ name: 'Universal' }],
      }),
    );
  });

  it('changes id when mediaItem location changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        mediaItem: {
          streams: [],
          duration: 7200000,
          locations: [{ type: 'local', path: '/media/movie.mkv' }],
          chapters: null,
        },
      }),
    );
  });

  it('does not change id when uuid changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        uuid: '00000000-0000-0000-0000-000000000099' as `${string}-${string}-${string}-${string}-${string}`,
      }),
    );
  });

  it('does not change id when sortTitle changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, sortTitle: 'Different' }),
    );
  });

  it('does not change id when canonicalId changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).toBe(
      canonicalizer.getCanonicalId({
        ...baseMovie,
        canonicalId: 'different-canonical',
      }),
    );
  });

  it('does not change id when state changes', () => {
    expect(canonicalizer.getCanonicalId(baseMovie)).toBe(
      canonicalizer.getCanonicalId({ ...baseMovie, state: 'missing' }),
    );
  });
});

// ============================================================
// Show
// ============================================================

const baseShow: Show = {
  ...baseGroupingFields,
  ...tunarrMeta,
  type: 'show',
  title: 'Test Show',
  genres: [],
  actors: [],
  studios: [],
  rating: null,
  releaseDate: null,
  releaseDateString: null,
  year: null,
};

describe('LocalMediaCanonicalizer - show', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).toBe(
      canonicalizer.getCanonicalId({ ...baseShow }),
    );
  });

  it('changes id when externalId changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseShow, externalId: 'other-id' }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseShow, title: 'Different Show' }),
    );
  });

  it('changes id when plot changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseShow,
        plot: 'A show about things.',
      }),
    );
  });

  it('changes id when tagline changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseShow, tagline: 'A tagline.' }),
    );
  });

  it('changes id when year changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseShow, year: 2020 }),
    );
  });

  it('changes id when releaseDate changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseShow, releaseDate: 1577836800 }),
    );
  });

  it('changes id when an actor is added', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseShow,
        actors: [{ name: 'Actor A' }],
      }),
    );
  });

  it('does not change id when actor order changes (actors are sorted by name)', () => {
    const withAB = {
      ...baseShow,
      actors: [{ name: 'Actor A' }, { name: 'Actor B' }],
    };
    const withBA = {
      ...baseShow,
      actors: [{ name: 'Actor B' }, { name: 'Actor A' }],
    };
    expect(canonicalizer.getCanonicalId(withAB)).toBe(
      canonicalizer.getCanonicalId(withBA),
    );
  });

  it('changes id when a studio is added', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseShow,
        studios: [{ name: 'HBO' }],
      }),
    );
  });

  it('changes id when a genre is added', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseShow,
        genres: [{ name: 'Drama' }],
      }),
    );
  });

  it('does not change id when genre order changes (genres are sorted)', () => {
    const withDC = {
      ...baseShow,
      genres: [{ name: 'Drama' }, { name: 'Comedy' }],
    };
    const withCD = {
      ...baseShow,
      genres: [{ name: 'Comedy' }, { name: 'Drama' }],
    };
    expect(canonicalizer.getCanonicalId(withDC)).toBe(
      canonicalizer.getCanonicalId(withCD),
    );
  });

  it('does not change id when uuid changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).toBe(
      canonicalizer.getCanonicalId({
        ...baseShow,
        uuid: '00000000-0000-0000-0000-000000000099' as `${string}-${string}-${string}-${string}-${string}`,
      }),
    );
  });

  it('does not change id when childCount changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).toBe(
      canonicalizer.getCanonicalId({ ...baseShow, childCount: 42 }),
    );
  });

  it('does not change id when sortTitle changes', () => {
    expect(canonicalizer.getCanonicalId(baseShow)).toBe(
      canonicalizer.getCanonicalId({ ...baseShow, sortTitle: 'Different' }),
    );
  });
});

// ============================================================
// Season
// ============================================================

const baseSeason: Season = {
  ...baseGroupingFields,
  ...tunarrMeta,
  type: 'season',
  title: 'Season 1',
  studios: [],
  index: 1,
  year: null,
  releaseDate: null,
  releaseDateString: null,
};

describe('LocalMediaCanonicalizer - season', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).toBe(
      canonicalizer.getCanonicalId({ ...baseSeason }),
    );
  });

  it('changes id when externalId changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, externalId: 'other-id' }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, title: 'Season Two' }),
    );
  });

  it('changes id when index changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, index: 2 }),
    );
  });

  it('changes id when plot changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, plot: 'Season plot.' }),
    );
  });

  it('changes id when tagline changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, tagline: 'A tagline.' }),
    );
  });

  it('changes id when year changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, year: 2022 }),
    );
  });

  it('changes id when releaseDate changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, releaseDate: 1640995200 }),
    );
  });

  it('changes id when a studio is added', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseSeason,
        studios: [{ name: 'HBO' }],
      }),
    );
  });

  it('does not change id when uuid changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).toBe(
      canonicalizer.getCanonicalId({
        ...baseSeason,
        uuid: '00000000-0000-0000-0000-000000000099' as `${string}-${string}-${string}-${string}-${string}`,
      }),
    );
  });

  it('does not change id when childCount changes', () => {
    expect(canonicalizer.getCanonicalId(baseSeason)).toBe(
      canonicalizer.getCanonicalId({ ...baseSeason, childCount: 12 }),
    );
  });
});

// ============================================================
// Episode
// ============================================================

const baseEpisode: Episode = {
  ...baseTerminalFields,
  ...tunarrMeta,
  type: 'episode',
  title: 'Pilot',
  episodeNumber: 1,
  releaseDate: null,
  releaseDateString: null,
  summary: null,
  duration: 2400000,
};

describe('LocalMediaCanonicalizer - episode', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode }),
    );
  });

  it('changes id when externalId changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode, externalId: 'other-id' }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode, title: 'Other Episode' }),
    );
  });

  it('changes id when episodeNumber changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode, episodeNumber: 2 }),
    );
  });

  it('changes id when summary changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        summary: 'A great episode.',
      }),
    );
  });

  it('changes id when year changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode, year: 2021 }),
    );
  });

  it('changes id when duration changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode, duration: 3600000 }),
    );
  });

  it('changes id when an actor is added', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        actors: [{ name: 'Actor A' }],
      }),
    );
  });

  it('does not change id when actor order changes (actors are sorted by name)', () => {
    const withAB = {
      ...baseEpisode,
      actors: [{ name: 'Actor A' }, { name: 'Actor B' }],
    };
    const withBA = {
      ...baseEpisode,
      actors: [{ name: 'Actor B' }, { name: 'Actor A' }],
    };
    expect(canonicalizer.getCanonicalId(withAB)).toBe(
      canonicalizer.getCanonicalId(withBA),
    );
  });

  it('changes id when a director is added', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        directors: [{ name: 'Director A' }],
      }),
    );
  });

  it('changes id when mediaItem stream changes', () => {
    const withStream = {
      ...baseEpisode,
      mediaItem: {
        streams: [
          {
            index: 0,
            codec: 'h264',
            streamType: 'video' as const,
          },
        ],
        duration: 2400000,
        locations: [{ type: 'local' as const, path: '/media/ep1.mkv' }],
        chapters: null,
      },
    };
    const withDifferentCodec = {
      ...withStream,
      mediaItem: {
        ...withStream.mediaItem,
        streams: [{ index: 0, codec: 'hevc', streamType: 'video' as const }],
      },
    };
    expect(canonicalizer.getCanonicalId(withStream)).not.toBe(
      canonicalizer.getCanonicalId(withDifferentCodec),
    );
  });

  it('does not change id when uuid changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).toBe(
      canonicalizer.getCanonicalId({
        ...baseEpisode,
        uuid: '00000000-0000-0000-0000-000000000099' as `${string}-${string}-${string}-${string}-${string}`,
      }),
    );
  });

  it('does not change id when state changes', () => {
    expect(canonicalizer.getCanonicalId(baseEpisode)).toBe(
      canonicalizer.getCanonicalId({ ...baseEpisode, state: 'missing' }),
    );
  });
});

// ============================================================
// OtherVideo
// ============================================================

const baseOtherVideo: OtherVideo = {
  ...baseTerminalFields,
  ...tunarrMeta,
  type: 'other_video',
  title: 'Test Video',
  duration: 600000,
};

describe('LocalMediaCanonicalizer - other_video', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseOtherVideo)).toBe(
      canonicalizer.getCanonicalId({ ...baseOtherVideo }),
    );
  });

  it('changes id when externalId changes', () => {
    expect(canonicalizer.getCanonicalId(baseOtherVideo)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseOtherVideo,
        externalId: 'other-id',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseOtherVideo)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseOtherVideo,
        title: 'Different Video',
      }),
    );
  });

  it('changes id when duration changes', () => {
    expect(canonicalizer.getCanonicalId(baseOtherVideo)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseOtherVideo, duration: 1200000 }),
    );
  });

  it('changes id when a tag is added', () => {
    expect(canonicalizer.getCanonicalId(baseOtherVideo)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseOtherVideo, tags: ['hd'] }),
    );
  });

  it('does not change id when tag order changes (tags are sorted)', () => {
    const withAB = { ...baseOtherVideo, tags: ['action', 'bonus'] };
    const withBA = { ...baseOtherVideo, tags: ['bonus', 'action'] };
    expect(canonicalizer.getCanonicalId(withAB)).toBe(
      canonicalizer.getCanonicalId(withBA),
    );
  });

  it('does not change id when uuid changes', () => {
    expect(canonicalizer.getCanonicalId(baseOtherVideo)).toBe(
      canonicalizer.getCanonicalId({
        ...baseOtherVideo,
        uuid: '00000000-0000-0000-0000-000000000099' as `${string}-${string}-${string}-${string}-${string}`,
      }),
    );
  });
});

// ============================================================
// MusicArtist
// ============================================================

const baseMusicArtist: MusicArtist = {
  ...baseGroupingFields,
  ...tunarrMeta,
  type: 'artist',
  title: 'Test Artist',
};

describe('LocalMediaCanonicalizer - artist', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseMusicArtist)).toBe(
      canonicalizer.getCanonicalId({ ...baseMusicArtist }),
    );
  });

  it('changes id when externalId changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicArtist)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicArtist,
        externalId: 'other-id',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicArtist)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicArtist,
        title: 'Other Artist',
      }),
    );
  });

  it('changes id when plot changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicArtist)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMusicArtist, plot: 'A bio.' }),
    );
  });

  it('changes id when tagline changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicArtist)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicArtist,
        tagline: 'A tagline.',
      }),
    );
  });

  it('changes id when a genre is added', () => {
    expect(canonicalizer.getCanonicalId(baseMusicArtist)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicArtist,
        genres: [{ name: 'Rock' }],
      }),
    );
  });

  it('does not change id when genre order changes (genres are sorted)', () => {
    const withRJ = {
      ...baseMusicArtist,
      genres: [{ name: 'Rock' }, { name: 'Jazz' }],
    };
    const withJR = {
      ...baseMusicArtist,
      genres: [{ name: 'Jazz' }, { name: 'Rock' }],
    };
    expect(canonicalizer.getCanonicalId(withRJ)).toBe(
      canonicalizer.getCanonicalId(withJR),
    );
  });

  it('does not change id when uuid changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicArtist)).toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicArtist,
        uuid: '00000000-0000-0000-0000-000000000099' as `${string}-${string}-${string}-${string}-${string}`,
      }),
    );
  });

  it('does not change id when childCount changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicArtist)).toBe(
      canonicalizer.getCanonicalId({ ...baseMusicArtist, childCount: 5 }),
    );
  });
});

// ============================================================
// MusicAlbum
// ============================================================

const baseMusicAlbum: MusicAlbum = {
  ...baseGroupingFields,
  ...tunarrMeta,
  type: 'album',
  title: 'Test Album',
  year: null,
  releaseDate: null,
  releaseDateString: null,
};

describe('LocalMediaCanonicalizer - album', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseMusicAlbum)).toBe(
      canonicalizer.getCanonicalId({ ...baseMusicAlbum }),
    );
  });

  it('changes id when externalId changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicAlbum)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicAlbum,
        externalId: 'other-id',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicAlbum)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicAlbum,
        title: 'Other Album',
      }),
    );
  });

  it('changes id when index changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicAlbum)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMusicAlbum, index: 2 }),
    );
  });

  it('changes id when year changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicAlbum)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMusicAlbum, year: 2020 }),
    );
  });

  it('changes id when year is removed', () => {
    expect(
      canonicalizer.getCanonicalId({ ...baseMusicAlbum, year: 2020 }),
    ).not.toBe(canonicalizer.getCanonicalId({ ...baseMusicAlbum, year: null }));
  });

  it('changes id when releaseDate changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicAlbum)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicAlbum,
        releaseDate: 1577836800,
      }),
    );
  });

  it('changes id when plot changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicAlbum)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMusicAlbum, plot: 'An album.' }),
    );
  });

  it('changes id when a studio is added', () => {
    expect(canonicalizer.getCanonicalId(baseMusicAlbum)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicAlbum,
        studios: [{ name: 'Atlantic Records' }],
      }),
    );
  });

  it('does not change id when uuid changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicAlbum)).toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicAlbum,
        uuid: '00000000-0000-0000-0000-000000000099' as `${string}-${string}-${string}-${string}-${string}`,
      }),
    );
  });

  it('does not change id when childCount changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicAlbum)).toBe(
      canonicalizer.getCanonicalId({ ...baseMusicAlbum, childCount: 12 }),
    );
  });
});

// ============================================================
// MusicTrack
// ============================================================

const baseMusicTrack: MusicTrack = {
  ...baseTerminalFields,
  ...tunarrMeta,
  type: 'track',
  title: 'Test Track',
  trackNumber: 1,
  duration: 240000,
};

describe('LocalMediaCanonicalizer - track', () => {
  it('produces the same id for identical input', () => {
    expect(canonicalizer.getCanonicalId(baseMusicTrack)).toBe(
      canonicalizer.getCanonicalId({ ...baseMusicTrack }),
    );
  });

  it('changes id when externalId changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicTrack,
        externalId: 'other-id',
      }),
    );
  });

  it('changes id when title changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMusicTrack, title: 'Other Track' }),
    );
  });

  it('changes id when trackNumber changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMusicTrack, trackNumber: 2 }),
    );
  });

  it('changes id when year changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMusicTrack, year: 2020 }),
    );
  });

  it('changes id when duration changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMusicTrack, duration: 300000 }),
    );
  });

  it('changes id when an actor is added', () => {
    expect(canonicalizer.getCanonicalId(baseMusicTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicTrack,
        actors: [{ name: 'Artist A' }],
      }),
    );
  });

  it('changes id when mediaItem location changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicTrack)).not.toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicTrack,
        mediaItem: {
          streams: [],
          duration: 240000,
          locations: [{ type: 'local', path: '/music/track1.flac' }],
          chapters: null,
        },
      }),
    );
  });

  it('changes id when a tag is added', () => {
    expect(canonicalizer.getCanonicalId(baseMusicTrack)).not.toBe(
      canonicalizer.getCanonicalId({ ...baseMusicTrack, tags: ['lossless'] }),
    );
  });

  it('does not change id when tag order changes (tags are sorted)', () => {
    const withAB = { ...baseMusicTrack, tags: ['flac', 'lossless'] };
    const withBA = { ...baseMusicTrack, tags: ['lossless', 'flac'] };
    expect(canonicalizer.getCanonicalId(withAB)).toBe(
      canonicalizer.getCanonicalId(withBA),
    );
  });

  it('does not change id when uuid changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicTrack)).toBe(
      canonicalizer.getCanonicalId({
        ...baseMusicTrack,
        uuid: '00000000-0000-0000-0000-000000000099' as `${string}-${string}-${string}-${string}-${string}`,
      }),
    );
  });

  it('does not change id when state changes', () => {
    expect(canonicalizer.getCanonicalId(baseMusicTrack)).toBe(
      canonicalizer.getCanonicalId({ ...baseMusicTrack, state: 'missing' }),
    );
  });
});
