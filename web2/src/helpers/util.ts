import { ChannelProgram, FlexProgram, Resolution } from '@tunarr/types';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { isNumber, range, zipWith } from 'lodash-es';

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
    return dayjs.duration(itemDuration.asHours(), 'hours').format('H[h]mm[m]');
  } else {
    return dayjs
      .duration(itemDuration.asMinutes(), 'minutes')
      .format('m[m]s[s]');
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

// Convert ms to human readable program length.
// 6454864 => '1h 27m'
export const formatProgramDuration = (duration: number) => {
  const hours = Math.floor(dayjs.duration(duration).asHours());
  const minutes = Math.floor(dayjs.duration(duration).asMinutes() - 60 * hours);

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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
