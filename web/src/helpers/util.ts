import { Theme } from '@mui/material';
import {
  ChannelProgram,
  FlexProgram,
  Resolution,
  TvGuideProgram,
} from '@tunarr/types';
import { PlexMedia } from '@tunarr/types/plex';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { isFunction, isNumber, range, reduce, zipWith } from 'lodash-es';
import { SelectedMedia } from '../store/programmingSelector/store';
import { UIChannelProgram } from '../types';

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

// Generates a mapping of discriminator to the concrete tyhpe
type GenSubtypeMapping<T extends { type: string }> = {
  [X in T['type']]: Extract<T, { type: X }>;
};

type GenGroupedSubtypeMapping<T extends { type: string }> = {
  [X in T['type']]: Extract<T, { type: X }>[];
};

type PerTypeCallback<Union extends { type: string }, Value> = {
  [X in Union['type']]?: ((m: GenSubtypeMapping<Union>[X]) => Value) | Value;
} & {
  default?: ((m: Union) => Value) | Value;
};

const applyOrValue = <Super, X extends Super, T>(
  f: ((m: X) => T) | T,
  arg: X,
) => (isFunction(f) ? f(arg) : f);

export const forSelectedMediaType = <T>(
  choices: PerTypeCallback<SelectedMedia, T>,
): ((m: SelectedMedia) => T | null) => {
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
};

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

export const forProgramType = <T>(
  choices: PerTypeCallback<ChannelProgram, T>,
) => {
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
};

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

export const unwrapNil = <T>(x: T | null | undefined) => x!;
