export { mod as dayjsMod } from './dayjsExtensions.js';
export * from './plexSearchUtil.js';
export * as search from './searchUtil.js';
export * as seq from './seq.js';
import type { ChannelProgram, ProgramLike } from '@tunarr/types';
import type { SearchFilterValueNode, StringOperators } from '@tunarr/types/api';
import type { PlexMedia } from '@tunarr/types/plex';
import { capitalize, isNull, isString } from 'lodash-es';
import isFunction from 'lodash-es/isFunction.js';
import type { MarkRequired } from 'ts-essentials';
import type { PerTypeCallback } from '../types/index.js';

export function applyOrValueNoRest<Super, X extends Super, T>(
  f: ((m: X) => T) | T,
  arg: X,
) {
  return isFunction(f) ? f(arg) : f;
}
export function applyOrValue<
  Super,
  X extends Super,
  T,
  Rest extends readonly unknown[],
>(f: ((m: X, ...rest: Rest) => T) | T, arg: X, rest: Rest) {
  return isFunction(f) ? f(arg, ...rest) : f;
}

export function forProgramType<T>(
  choices:
    | Omit<Required<PerTypeCallback<ChannelProgram, T>>, 'default'>
    | MarkRequired<PerTypeCallback<ChannelProgram, T>, 'default'>,
): (m: ChannelProgram) => NonNullable<T>;
export function forProgramType<T>(
  choices: PerTypeCallback<ChannelProgram, T>,
): (m: ChannelProgram) => T | null;
export function forProgramType<T>(
  choices: PerTypeCallback<ChannelProgram, T>,
): (m: ChannelProgram) => T | null {
  return (m: ChannelProgram) => {
    switch (m.type) {
      case 'content':
        if (choices.content) {
          return applyOrValue(choices.content, m, []);
        }
        break;
      case 'custom':
        if (choices.custom) {
          return applyOrValue(choices.custom, m, []);
        }
        break;
      case 'redirect':
        if (choices.redirect) {
          return applyOrValue(choices.redirect, m, []);
        }
        break;
      case 'flex':
        if (choices.flex) {
          return applyOrValue(choices.flex, m, []);
        }
        break;
      case 'filler':
        if (choices.filler) {
          return applyOrValue(choices.filler, m, []);
        }
        break;
    }

    // If we made it this far try to do the default
    if (choices.default) {
      return applyOrValue(choices.default, m, []);
    }

    return null;
  };
}

export function forPlexMedia<T>(
  choices:
    | Omit<Required<PerTypeCallback<PlexMedia, T>>, 'default'>
    | MarkRequired<PerTypeCallback<PlexMedia, T>, 'default'>,
): (m: PlexMedia) => NonNullable<T>;
export function forPlexMedia<T>(
  choices: PerTypeCallback<PlexMedia, T>,
): (m: PlexMedia) => T | null;
export function forPlexMedia<T>(choices: PerTypeCallback<PlexMedia, T>) {
  return (m: PlexMedia) => {
    switch (m.type) {
      case 'movie':
        if (choices.movie) return applyOrValueNoRest(choices.movie, m);
        break;
      case 'show':
        if (choices.show) return applyOrValueNoRest(choices.show, m);
        break;
      case 'season':
        if (choices.season) return applyOrValueNoRest(choices.season, m);
        break;
      case 'episode':
        if (choices.episode) return applyOrValueNoRest(choices.episode, m);
        break;
      case 'artist':
        if (choices.artist) return applyOrValueNoRest(choices.artist, m);
        break;
      case 'album':
        if (choices.album) return applyOrValueNoRest(choices.album, m);
        break;
      case 'track':
        if (choices.track) return applyOrValueNoRest(choices.track, m);
        break;
      case 'collection':
        if (choices.collection)
          return applyOrValueNoRest(choices.collection, m);
        break;
      case 'playlist':
        if (choices.playlist) return applyOrValueNoRest(choices.playlist, m);
        break;
    }

    if (choices.default) {
      return applyOrValueNoRest(choices.default, m);
    }

    return null;
  };
}

export function nullToUndefined<T>(x: T | null | undefined): T | undefined {
  if (isNull(x)) {
    return undefined;
  }
  return x;
}

export const flushEventLoop = async () => {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

const RomanNumeralMap = new Map([
  ['i', 1],
  ['v', 5],
  ['x', 10],
  ['l', 50],
  ['c', 100],
  ['d', 500],
  ['m', 1000],
]);
const RomanNumerRegex = /([MDCLXVI]+)/i;
export function isValidRomanNumeral(input: string) {
  return RomanNumerRegex.test(input);
}

export function romanNumeralToNumber(input: string): number {
  if (input.length === 0) {
    return 0;
  }

  const lowercased = input.toLowerCase();
  let total = 0;
  let previousValue = Number.POSITIVE_INFINITY;
  for (let i = 0; i < lowercased.length; i++) {
    const current = RomanNumeralMap.get(input[i]);
    if (!current) {
      continue;
    }
    total += current > previousValue ? -previousValue : previousValue;
    previousValue = current;
  }
  return total + previousValue;
}

export function isNonEmptyString(s: unknown): s is string {
  return isString(s) && s.length > 0;
}

export function createTypeSearchField(
  type: ProgramLike['type'],
  op?: StringOperators,
): SearchFilterValueNode {
  return {
    type: 'value',
    fieldSpec: {
      key: 'type',
      name: 'Type',
      op: op ?? '=',
      type: 'string',
      value: [type],
    },
  };
}

export function createParentFilterSearchField(
  parentId: string,
  op?: StringOperators,
): SearchFilterValueNode {
  return {
    type: 'value',
    fieldSpec: {
      key: 'parent.id',
      name: '',
      op: op ?? '=',
      type: 'string',
      value: [parentId],
    },
  };
}

export function prettifySnakeCaseString(str: string) {
  return str
    .split('_')
    .map((x) => capitalize(x))
    .join(' ');
}
