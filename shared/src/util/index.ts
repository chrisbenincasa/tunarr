import { ChannelProgram } from '@tunarr/types';
import isFunction from 'lodash-es/isFunction.js';
import { MarkRequired } from 'ts-essentials';
import type { PerTypeCallback } from '../types/index.js';

export const applyOrValue = <Super, X extends Super, T>(
  f: ((m: X) => T) | T,
  arg: X,
) => (isFunction(f) ? f(arg) : f);

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
          return applyOrValue(choices.content, m);
        }
        break;
      case 'custom':
        if (choices.custom) {
          return applyOrValue(choices.custom, m);
        }
        break;
      case 'redirect':
        if (choices.redirect) {
          return applyOrValue(choices.redirect, m);
        }
        break;
      case 'flex':
        if (choices.flex) {
          return applyOrValue(choices.flex, m);
        }
        break;
    }

    // If we made it this far try to do the default
    if (choices.default) {
      return applyOrValue(choices.default, m);
    }

    return null;
  };
}
