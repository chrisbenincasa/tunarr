import type { PaletteMode } from '@mui/material';
import { colors } from '@mui/material';
import type { GenGroupedSubtypeMapping } from '@tunarr/shared/types';
import {
  type ChannelProgram,
  type FlexProgram,
  type Resolution,
} from '@tunarr/types';
import dayjs, { type Dayjs } from 'dayjs';
import duration from 'dayjs/plugin/duration';
import {
  attempt,
  filter,
  flatMap,
  isEmpty,
  isError,
  isNil,
  isNumber,
  isString,
  isUndefined,
  map,
  property,
  range,
  reduce,
  trim,
  zipWith,
} from 'lodash-es';
import pluralize from 'pluralize';
import { type Path, type PathValue } from 'react-hook-form';
import { type SelectedMedia } from '../store/programmingSelector/store';
import { type UIIndex } from '../types';
import type { Nilable } from '../types/util.ts';

dayjs.extend(duration);

export async function sequentialPromises<T, U>(
  seq: ReadonlyArray<T>,
  itemFn: (item: T) => Promise<U>,
  opts?: { ms?: number },
): Promise<U[]> {
  const results: U[] = [];
  if (isNil(seq)) {
    return results;
  }

  for (const item of seq) {
    results.push(await itemFn(item));
    if (opts?.ms) {
      await wait(opts.ms);
    }
  }
  return results;
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
export const alternateColors = (index: number, mode: PaletteMode): string => {
  return mode === 'light'
    ? index % 2 === 0
      ? colors.grey[100]
      : colors.grey[400]
    : index % 2 === 0
      ? colors.grey[700]
      : colors.grey[800];
};

export function grayBackground(mode: PaletteMode) {
  if (mode === 'light') {
    return colors.grey[100];
  } else {
    return colors.grey[600];
  }
}

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

export function channelProgramUniqueId(program: ChannelProgram): string {
  switch (program.type) {
    case 'custom':
      return `custom.${program.customShowId}.${program.id}`;
    case 'content':
      return `content.${program.uniqueId}`;
    case 'redirect':
      return `redirect.${program.channel}`;
    case 'filler':
      return `filler.${program.fillerListId}`;
    case 'flex':
      return 'flex';
  }
}

export const zipWithIndex = <T extends object>(
  seq: readonly T[],
  start: number = 0,
): (T & UIIndex)[] => {
  return zipWith(seq, range(0, seq.length), (s, i) => ({
    ...s,
    uiIndex: start + i,
    originalIndex: start + i,
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

export function isNonEmptyString(s: unknown): s is string {
  return isString(s) && s.length > 0;
}
export const roundCurrentTime = (multiple?: number): Dayjs => {
  return dayjs()
    .minute(multiple ? roundNearestMultiple(dayjs().minute(), multiple) : 0)
    .second(0)
    .millisecond(0);
};
export const roundNearestMultiple = (num: number, multiple: number): number => {
  if (multiple <= 0) return 0;

  return Math.floor(num / multiple) * multiple;
};

export function isValidUrlWithError(url: string, allowEmpty: boolean = false) {
  const sanitized = trim(url);
  if (isEmpty(sanitized)) {
    return !allowEmpty ? 'empty' : undefined;
  }

  const result = attempt(() => new URL(url));
  if (isError(result)) {
    return 'not_parseable';
  }

  const hasProtocol =
    result.protocol === 'http:' || result.protocol === 'https:';

  if (!hasProtocol) {
    return 'wrong_protocol';
  }

  return;
}

export function isValidUrl(url: string, allowEmpty: boolean = false) {
  return isUndefined(isValidUrlWithError(url, allowEmpty));
}

export const ifProd = <T>(f: () => T): T | null => {
  if (import.meta.env.PROD) {
    return f();
  }
  return null;
};

// Hardcoded values for our grid
// This allows us to calculate estimated columns before images load
export function estimateNumberOfColumns(containerWidth: number) {
  if (containerWidth <= 319) {
    return 1;
  } else if (containerWidth <= 479) {
    return 2;
  } else if (containerWidth <= 639) {
    return 3;
  } else if (containerWidth <= 799) {
    return 4;
  } else if (containerWidth <= 959) {
    return 5;
  } else if (containerWidth <= 1119) {
    return 6;
  } else if (containerWidth <= 1279) {
    return 7;
  } else {
    return 8;
  }
}

export function countWhere<T>(
  coll: T[] | null | undefined,
  f: (t: T) => boolean,
): number {
  if (!coll) {
    return 0;
  }

  return filter(coll, f)?.length;
}

export function pluralizeWithCount(
  word: string,
  count: Nilable<number>,
  inclusive?: boolean,
) {
  return `${count ?? 0} ${pluralize(word, count ?? undefined, inclusive)}`;
}
// Stupid shim - get rid of this once we use a newer ES setting
export function difference<T>(
  l: ReadonlySet<T> | Set<T>,
  r: ReadonlySet<T> | Set<T>,
): Set<T> {
  const out = new Set<T>();
  for (const e of l) {
    if (!r.has(e)) out.add(e);
  }
  return out;
}

export const noop = () => {};
