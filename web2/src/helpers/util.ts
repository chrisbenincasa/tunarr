import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { ChannelProgram, Resolution } from '@tunarr/types';
import { zipWith, range } from 'lodash-es';

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
export const toStringResolution = (res: Resolution) =>
  `${res.widthPx}x${res.heightPx}` as const;

export const fromStringResolution = (
  res: `${number}x${number}`,
): Resolution => {
  const [h, w] = res.split('x', 2);
  return { widthPx: parseInt(w), heightPx: parseInt(h) };
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
