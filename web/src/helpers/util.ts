import { Theme } from '@mui/material';
import { MakeRequired } from '@mui/x-date-pickers/internals/models/helpers';
import type {
  GenGroupedSubtypeMapping,
  PerTypeCallback,
} from '@tunarr/shared/types';
import { applyOrValue } from '@tunarr/shared/util';
import {
  ChannelProgram,
  FlexProgram,
  Resolution,
  TvGuideProgram,
} from '@tunarr/types';
import { PlexMedia } from '@tunarr/types/plex';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import {
  flatMap,
  isNumber,
  map,
  property,
  range,
  reduce,
  zipWith,
} from 'lodash-es';
import { Path, PathValue } from 'react-hook-form';
import { SelectedMedia } from '../store/programmingSelector/store';
import { AddedMedia, UIChannelProgram } from '../types';

dayjs.extend(duration);

export async function sequentialPromises<T, U>(
  seq: ReadonlyArray<T>,
  itemFn: (item: T) => Promise<U>,
  opts?: { ms?: number },
): Promise<U[]> {
  const all = await seq.reduce(
    async (prev, item) => {
      const last = await prev;

      const result = await itemFn(item);

      if (opts?.ms) {
        await wait(opts?.ms);
      }

      return [...last, result];
    },
    Promise.resolve([] as U[]),
  );

  return Promise.all(all);
}

export const wait: (ms: number) => Promise<void> = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export function prettyItemDuration(durationMs: number): string {
  const itemDuration = dayjs.duration(durationMs);
  if (itemDuration.asHours() >= 1) {
    return dayjs.duration(itemDuration.asHours(), 'hours').format('H[h] m[m]');
  } else {
    return dayjs
      .duration(itemDuration.asMinutes(), 'minutes')
      .format('m[m] s[s]');
  }
}

// Alternate row colors utility that supports dark mode & light mode
export const alternateColors = (
  index: number,
  mode: string,
  theme: Theme,
): string => {
  return mode === 'light'
    ? index % 2 === 0
      ? theme.palette.grey[100]
      : theme.palette.grey[400]
    : index % 2 === 0
    ? theme.palette.grey[700]
    : theme.palette.grey[800];
};

export const isResolutionString = (
  str: string,
): str is `${number}x${number}` => {
  const split = str.split('x', 2);
  if (split.length !== 2) {
    return false;
  }
  return !isNaN(parseInt(split[0])) && !isNaN(parseInt(split[1]));
};

export const resolutionToString = (res: Resolution) =>
  `${res.widthPx}x${res.heightPx}` as const;

export const resolutionFromString = (
  res: `${number}x${number}`,
): Resolution => {
  const [w, h] = res.split('x', 2);
  return { widthPx: parseInt(w), heightPx: parseInt(h) };
};

export const resolutionFromAnyString = (res: string) => {
  if (!isResolutionString(res)) {
    return;
  }
  return resolutionFromString(res);
};

export const hasOnlyDigits = (value: string) => {
  return /^-?\d+$/g.test(value);
};

export const channelProgramUniqueId = (program: ChannelProgram): string => {
  switch (program.type) {
    case 'custom':
      return `custom.${program.id}`;
    case 'content':
      return `content.${program.uniqueId}`;
    case 'redirect':
      return `redirect.${program.channel}`;
    case 'flex':
      return 'flex';
  }
};

export const zipWithIndex = <T extends object>(
  seq: readonly T[],
  start: number = 0,
): (T & { originalIndex: number })[] => {
  return zipWith(seq, range(start, seq.length), (s, i) => ({
    ...s,
    originalIndex: i,
  }));
};

export const createFlexProgram = (
  duration: number,
  persisted: boolean = false,
): FlexProgram => ({
  duration,
  persisted,
  type: 'flex',
});

// Useful for toggling state
export const toggle = (b: boolean) => !b;

export const handleNumericFormValue = (
  value: string | number,
  float: boolean = false,
) => {
  if (isNumber(value)) {
    return value;
  }

  // Special-case for typing a trailing decimal on a float
  if (float && value.endsWith('.')) {
    return parseFloat(value + '0'); // This still doesn't work
  }

  return float ? parseFloat(value) : parseInt(value);
};

export const numericFormChangeHandler = (
  cb: (...event: unknown[]) => void,
  float: boolean = true,
) => {
  return (e: { target: { value: string | number } }) => {
    cb(handleNumericFormValue(e.target.value, float));
  };
};

// // Generates a mapping of discriminator to the concrete tyhpe
// type GenSubtypeMapping<T extends { type: string }> = {
//   [X in T['type']]: Extract<T, { type: X }>;
// };

// type GenGroupedSubtypeMapping<T extends { type: string }> = {
//   [X in T['type']]: Extract<T, { type: X }>[];
// };

// type PerTypeCallback<Union extends { type: string }, CallbackRet> = {
//   [X in Union['type']]?:
//     | ((m: GenSubtypeMapping<Union>[X]) => CallbackRet)
//     | CallbackRet;
// } & {
//   default?: ((m: Union) => CallbackRet) | CallbackRet;
// };

// const applyOrValue = <Super, X extends Super, T>(
//   f: ((m: X) => T) | T,
//   arg: X,
// ) => (isFunction(f) ? f(arg) : f);

export function forSelectedMediaType<T>(
  choices: MakeRequired<PerTypeCallback<SelectedMedia, T>, 'default'>,
): (m: SelectedMedia) => NonNullable<T>;
export function forSelectedMediaType<T>(
  choices: PerTypeCallback<SelectedMedia, T>,
): (m: SelectedMedia) => T | null;
export function forSelectedMediaType<T>(
  choices:
    | PerTypeCallback<SelectedMedia, T>
    | MakeRequired<PerTypeCallback<SelectedMedia, T>, 'default'>,
): (m: SelectedMedia) => T | null {
  // Unfortunately we still have to enumerate the types here
  // in order to get proper type guarding
  return (m: SelectedMedia) => {
    if (m.type === 'custom-show' && choices['custom-show']) {
      return applyOrValue(choices['custom-show'], m);
    } else if (m.type === 'plex' && choices['plex']) {
      return applyOrValue(choices['plex'], m);
    } else if (choices.default) {
      return applyOrValue(choices['default'], m);
    }

    return null;
  };
}

// Produces a Record for each 'type' of SelectedMedia where the values
// are the properly downcasted subtypes
export function groupSelectedMedia(
  media: SelectedMedia[],
): Partial<GenGroupedSubtypeMapping<SelectedMedia>> {
  return reduce(
    media,
    (acc, m) => {
      const curr = acc[m.type] ?? [];
      return {
        ...acc,
        [m.type]: [...curr, m],
      };
    },
    {} as Partial<GenGroupedSubtypeMapping<SelectedMedia>>,
  );
}

export const forUIProgramType = <T>(
  choices: PerTypeCallback<UIChannelProgram, T>,
) => {
  return (m: UIChannelProgram) => {
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
};

// Unclear if we can generalize this since we need to know we
// are dealing with a type that has subclasses, otherwise
// PerTypeCallback will have nevers
export const forTvGuideProgram = <T>(
  choices: PerTypeCallback<TvGuideProgram, T>,
) => {
  return (m: TvGuideProgram) => {
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
};

export const forPlexMedia = <T>(choices: PerTypeCallback<PlexMedia, T>) => {
  return (m: PlexMedia) => {
    switch (m.type) {
      case 'movie':
        if (choices.movie) return applyOrValue(choices.movie, m);
        break;
      case 'show':
        if (choices.show) return applyOrValue(choices.show, m);
        break;
      case 'season':
        if (choices.season) return applyOrValue(choices.season, m);
        break;
      case 'episode':
        if (choices.episode) return applyOrValue(choices.episode, m);
        break;
      case 'artist':
        if (choices.artist) return applyOrValue(choices.artist, m);
        break;
      case 'album':
        if (choices.album) return applyOrValue(choices.album, m);
        break;
      case 'track':
        if (choices.track) return applyOrValue(choices.track, m);
        break;
      case 'collection':
        if (choices.collection) return applyOrValue(choices.collection, m);
        break;
    }

    if (choices.default) {
      return applyOrValue(choices.default, m);
    }

    return null;
  };
};

export function forAddedMediaType<T>(
  choices:
    | Omit<Required<PerTypeCallback<AddedMedia, T>>, 'default'>
    | MakeRequired<PerTypeCallback<AddedMedia, T>, 'default'>,
): (m: AddedMedia) => NonNullable<T>;
export function forAddedMediaType<T>(
  choices: PerTypeCallback<AddedMedia, T>,
): (m: AddedMedia) => T | null;
export function forAddedMediaType<T>(
  choices:
    | PerTypeCallback<AddedMedia, T>
    | MakeRequired<PerTypeCallback<AddedMedia, T>, 'default'>,
): (m: AddedMedia) => T | null {
  return (m: AddedMedia) => {
    switch (m.type) {
      case 'plex':
        if (choices.plex) return applyOrValue(choices.plex, m);
        break;
      case 'custom-show':
        if (choices['custom-show'])
          return applyOrValue(choices['custom-show'], m);
        break;
    }

    if (choices.default) return applyOrValue(choices.default, m);

    return null;
  };
}

export const unwrapNil = <T>(x: T | null | undefined) => x!;

// Reuses react-hook-form Path type here lol
export function typedProperty<T, TPath extends Path<T> = Path<T>>(path: TPath) {
  return property<T, PathValue<T, TPath>>(path);
}

type ObjectPredicate<T> = {
  [Key in keyof T]?: T[Key];
};

export function typedObjectPredicate<T>(obj: ObjectPredicate<T>) {
  return obj;
}

export const uuidRegexPattern =
  '[0-9a-fA-F]{8}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{12}';

export function product<T, U, V>(
  l: readonly T[] | null | undefined,
  r: readonly U[] | null | undefined,
  f: (l0: T, r0: U) => V,
): V[] {
  return flatMap(l, (l0) => map(r, (r0) => f(l0, r0)));
}

export function scale(
  coll: readonly number[] | null | undefined,
  factor: number,
): number[] {
  return map(coll, (c) => c * factor);
}
