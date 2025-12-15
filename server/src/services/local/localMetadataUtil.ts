import { seq } from '@tunarr/shared/util';
import type { Actor, NamedEntity } from '@tunarr/types';
import { isNull, last, orderBy } from 'lodash-es';
import { basename, extname } from 'node:path';
import type { NfoActor, NfoFieldWithAttrs } from '../../nfo/NfoSchemas.ts';
import type { Nilable } from '../../types/util.ts';
import { isNonEmptyArray, parseIntOrNull } from '../../util/index.ts';

// Match things like S01, season 01, Season1, S1
// but not things like S01E03 or "blah blah blah 02"
const SeasonNameRegex = /s(?:eason)?\s?(\d+)(?![e\d])/i;
const SeasonAndEpisodeNameRegex1 =
  /s(?:eason)?\s?(\d+)\s?((?:([e|x]?\d+)+(e?\d+-?))+)/i;
const SeasonAndEpisodeNameRegex2 = /(\d+)\s?x(\d+)/i;

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

export function extractSeasonAndEpisodeNumber(fileName: string) {
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

  return;
}

export function mapNfoToNamedEntity(names: Nilable<Array<string | NfoFieldWithAttrs>>) {
  return seq.collect(names?.filter(n => !!n), (name) => {
    return {
      name: typeof name === 'string' ? name : name['#text'],
    } satisfies NamedEntity;
  });
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
