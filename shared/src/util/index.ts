export { mod as dayjsMod } from './dayjsExtensions.js';
export * from './plexSearchUtil.js';
export * as seq from './seq.js';
import { ChannelProgram } from '@tunarr/types';
import { PlexMedia } from '@tunarr/types/plex';
import { isNull } from 'lodash-es';
import isFunction from 'lodash-es/isFunction.js';
import { MarkRequired } from 'ts-essentials';
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

export function forProgramType<T, Args extends unknown[] = []>(
  choices:
    | Omit<Required<PerTypeCallback<ChannelProgram, T, Args>>, 'default'>
    | MarkRequired<PerTypeCallback<ChannelProgram, T, Args>, 'default'>,
): (m: ChannelProgram, ...rest: Args) => NonNullable<T>;
export function forProgramType<T, Args extends unknown[] = []>(
  choices: PerTypeCallback<ChannelProgram, T, Args>,
): (m: ChannelProgram, ...rest: Args) => T | null;
export function forProgramType<T, Args extends unknown[] = []>(
  choices: PerTypeCallback<ChannelProgram, T, Args>,
): (m: ChannelProgram, ...rest: Args) => T | null {
  return (m: ChannelProgram, ...rest: Args) => {
    switch (m.type) {
      case 'content':
        if (choices.content) {
          return applyOrValue(choices.content, m, rest);
        }
        break;
      case 'custom':
        if (choices.custom) {
          return applyOrValue(choices.custom, m, rest);
        }
        break;
      case 'redirect':
        if (choices.redirect) {
          return applyOrValue(choices.redirect, m, rest);
        }
        break;
      case 'flex':
        if (choices.flex) {
          return applyOrValue(choices.flex, m, rest);
        }
        break;
    }

    // If we made it this far try to do the default
    if (choices.default) {
      return applyOrValue(choices.default, m, rest);
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
