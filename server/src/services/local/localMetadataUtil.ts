import { isNonEmptyString, seq } from '@tunarr/shared/util';
import type {
  Actor,
  Identifier,
  NamedEntity,
  ShowMetadata,
} from '@tunarr/types';
import { isNull, last, orderBy } from 'lodash-es';
import { basename, extname } from 'node:path';
import type { NonEmptyArray } from 'ts-essentials';
import { v4 } from 'uuid';
import type {
  NfoActor,
  NfoFieldWithAttrs,
  NfoUniqueId,
  TvShowNfo,
} from '../../nfo/NfoSchemas.ts';
import type { Nilable } from '../../types/util.ts';
import { isNonEmptyArray, parseIntOrNull } from '../../util/index.ts';
import { parseReleaseDate, titleToSortTitle } from '../../util/programs.ts';

// Match things like S01, season 01, Season1, S1
// but not things like S01E03 or "blah blah blah 02"
const SeasonNameRegex = /s(?:eason)?\s?(\d+)(?![e\d])/i;

// Match S01E02, S01 E02, S01.E02, s2016.e100761, S01E02E03, S01E02-03, S01x02.
// The season takes its whole digit run. Only "e" may follow a dot, underscore,
// or dash, so release tags like "S01.x264" stay unmatched.
const SeasonAndEpisodeNameRegex1 =
  /s(?:eason)?\s?(\d+)(?!\d)((?:\s?x|[\s._-]?e)\d+(?:-?e?\d+)*)/i;
const SeasonAndEpisodeNameRegex2 = /(\d+)\s?x(\d+)/i;

// Match a bare episode with no season, like ".E259."
const EpisodeOnlyNameRegex = /(?:^|[\s._-])e(\d+)(?=[\s._-]|$)/i;

type FileNameEpisodeInfo = {
  season: number | null;
  episodes: NonEmptyArray<number>;
};

export function extractSeasonNumberFromFolder(folderName: string) {
  folderName = basename(folderName);
  const folderNameNum = parseIntOrNull(folderName);
  if (!isNull(folderNameNum)) {
    return folderNameNum;
  }

  const matches = folderName.match(SeasonNameRegex);
  if (matches && matches.length > 1) {
    const seasonNumber = parseIntOrNull(matches[1]!);
    if (!isNull(seasonNumber)) {
      return seasonNumber;
    }
  }

  const lastPart = last(folderName.split(' '));
  const parsed = lastPart ? parseIntOrNull(lastPart) : null;
  if (!isNull(parsed)) {
    return parsed;
  }

  if (folderName.toLocaleLowerCase().endsWith('specials')) {
    return 0;
  }

  return null;
}

/**
 * Season and episode numbers from a video filename. `season` is null when the
 * name only carries an episode, so the caller must supply the season.
 */
export function extractSeasonAndEpisodeNumber(
  fileName: string,
): FileNameEpisodeInfo | undefined {
  fileName = basename(fileName, extname(fileName));
  const matches = fileName.match(SeasonAndEpisodeNameRegex1);
  if (matches && matches.length > 2) {
    const season = parseIntOrNull(matches[1]!);
    if (isNull(season)) {
      return;
    }

    const epMatches = seq.collect(
      Array.from(matches[2]!.matchAll(/(\d+)/g)),
      ([n]) => parseIntOrNull(n),
    );
    if (!isNonEmptyArray(epMatches)) {
      return;
    }

    return {
      season,
      episodes: epMatches,
    };
  }

  const matches2 = fileName.match(SeasonAndEpisodeNameRegex2);
  if (matches2 && matches2.length > 2) {
    const season = parseIntOrNull(matches2[1]!);
    const episode = parseIntOrNull(matches2[2]!);
    if (!isNull(season) && !isNull(episode)) {
      return {
        season,
        episodes: [episode],
      };
    }
  }

  const episodeOnly = fileName.match(EpisodeOnlyNameRegex)?.[1];
  const episode = isNonEmptyString(episodeOnly)
    ? parseIntOrNull(episodeOnly)
    : null;
  if (!isNull(episode)) {
    return {
      season: null,
      episodes: [episode],
    };
  }

  return;
}

/**
 * Groups the episode files of a flat show folder by the season in each
 * filename. Files whose names carry no season are skipped.
 */
export function groupEpisodeFilesBySeason<T extends { name: string }>(
  files: T[],
) {
  const bySeason = new Map<
    number,
    Array<readonly [T, FileNameEpisodeInfo & { season: number }]>
  >();

  for (const file of files) {
    const info = extractSeasonAndEpisodeNumber(file.name);
    if (!info || info.season === null) {
      continue;
    }

    const season = info.season;
    const seasonFiles = bySeason.get(season) ?? [];
    seasonFiles.push([file, { ...info, season }]);
    bySeason.set(season, seasonFiles);
  }

  return bySeason;
}

export function mapNfoToNamedEntity(
  names: Nilable<Array<string | NfoFieldWithAttrs>>,
) {
  return seq.collect(
    names?.filter((n) => !!n),
    (name) => {
      return {
        name: typeof name === 'string' ? name : name['#text'],
      } satisfies NamedEntity;
    },
  );
}

export function mapNfoActors(actors: Nilable<NfoActor[]>) {
  return orderBy(
    seq.collect(actors, (actor, index) => {
      return {
        name: actor.name,
        role: actor.role ?? undefined,
        order: actor.order ?? index,
      } satisfies Actor;
    }),
    (a) => a.order,
    'asc',
  );
}

export function mapNfoUniqueIds(uniqueIds: Nilable<NfoUniqueId[]>) {
  return seq.collect(uniqueIds, (uniqueId) => {
    const type = uniqueId['@_type'].toLowerCase().trim();
    const id = uniqueId['#text'].trim();
    if (!isNonEmptyString(id)) {
      return;
    }

    switch (type) {
      case 'imdb':
      case 'tmdb':
      case 'tvdb':
        return { id, type } satisfies Identifier;
      default:
        return;
    }
  });
}

export function tvShowNfoToShowMetadata(tvShowNfo: TvShowNfo): ShowMetadata {
  const releaseDate = parseReleaseDate(tvShowNfo.premiered);
  return {
    uuid: v4(),
    summary: null,
    plot: tvShowNfo.plot ?? null,
    tagline: tvShowNfo.tagline ?? null,
    sourceType: 'local',
    identifiers: mapNfoUniqueIds(tvShowNfo.uniqueid),
    title: tvShowNfo.title ?? '',
    sortTitle: titleToSortTitle(tvShowNfo.title),
    tags: [],
    type: 'show',
    genres: tvShowNfo.genre ? tvShowNfo.genre.map((name) => ({ name })) : [],
    actors: mapNfoActors(tvShowNfo.actor),
    studios: tvShowNfo.studio ? tvShowNfo.studio.map((name) => ({ name })) : [],
    rating: tvShowNfo.mpaa ?? null,
    releaseDate: releaseDate ? +releaseDate : null,
    releaseDateString: releaseDate?.format() ?? null,
    year: releaseDate?.year() ?? null,
    childCount: undefined,
    grandchildCount: undefined,
    artwork: [], // Added later
  };
}
