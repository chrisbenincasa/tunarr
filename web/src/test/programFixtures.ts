import type { ContentProgram } from '@tunarr/types';

type TerminalProgram = ContentProgram['program'];
type Movie = Extract<TerminalProgram, { type: 'movie' }>;
type Episode = Extract<TerminalProgram, { type: 'episode' }>;

/**
 * Fixtures for the program shapes the editors actually receive.
 *
 * These are built without casts on purpose. Four of the existing web test files
 * assert against hand-written program literals that no longer match
 * `ContentProgram` -- extra fields, missing `program` -- and nothing caught it,
 * because `tsconfig.build.json` excludes `*.test.ts` from the typecheck CI
 * runs. A cast-free factory is the only version of this that stays honest when
 * the schema moves.
 */
const terminalDefaults = {
  uuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  sourceType: 'local',
  identifiers: [],
  title: 'Untitled',
  sortTitle: 'Untitled',
  tags: [],
  originalTitle: null,
  year: null,
  releaseDate: null,
  releaseDateString: null,
  artwork: [],
  state: 'ok',
  summary: null,
  mediaSourceId: 'source-1',
  libraryId: 'library-1',
  canonicalId: 'canonical-1',
  externalId: 'external-1',
  duration: 0,
} as const satisfies Omit<Movie, 'type' | 'plot' | 'tagline' | 'rating'>;

export function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    ...terminalDefaults,
    type: 'movie',
    plot: null,
    tagline: null,
    rating: null,
    ...overrides,
  };
}

type ShowGrouping = NonNullable<Episode['show']>;

export function makeShowGrouping(
  uuid: string,
  overrides: Partial<ShowGrouping> = {},
): ShowGrouping {
  return {
    ...terminalDefaults,
    uuid,
    type: 'show',
    plot: null,
    tagline: null,
    rating: null,
    genres: [],
    actors: [],
    studios: [],
    ...overrides,
  };
}

type SeasonGrouping = NonNullable<Episode['season']>;

export function makeSeasonGrouping(
  index: number,
  overrides: Partial<SeasonGrouping> = {},
): SeasonGrouping {
  return {
    ...terminalDefaults,
    uuid: `season-${index}`,
    type: 'season',
    index,
    plot: null,
    tagline: null,
    studios: [],
    ...overrides,
  };
}

export function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    ...terminalDefaults,
    type: 'episode',
    episodeNumber: 1,
    ...overrides,
  };
}

/** Wraps a terminal program in the lineup envelope the editors store. */
export function makeContentProgram(
  program: TerminalProgram,
  durationMs: number,
  id = `program-${program.uuid}`,
): ContentProgram {
  return { type: 'content', id, duration: durationMs, program };
}
