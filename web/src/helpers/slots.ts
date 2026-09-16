import { prettifySnakeCaseString, seq } from '@tunarr/shared/util';
import { blue, green, orange, pink, purple } from '@mui/material/colors';
import type { BaseSlot } from '@tunarr/types/api';
import type { ContentProgram } from '@tunarr/types';
import { round, sum } from 'lodash-es';
import type {
  RandomSlotTableRowType,
  TimeSlotTableRowType,
} from '../model/CommonSlotModels.ts';
import { getEpisodeShowId } from './programUtil.ts';

const iterationGroupColors = [
  blue[700],
  purple[600],
  green[700],
  orange[700],
  pink[600],
] as const;

export function iterationGroupColor(group: string): string {
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = (hash * 31 + group.charCodeAt(i)) | 0;
  }
  return iterationGroupColors[Math.abs(hash) % iterationGroupColors.length];
}

export function formatSlotOrder(
  row: RandomSlotTableRowType | TimeSlotTableRowType,
) {
  switch (row.type) {
    case 'flex':
    case 'redirect':
      return null;
    case 'movie':
    case 'show':
    case 'custom-show':
    case 'filler':
    case 'smart-collection':
      return prettifySnakeCaseString(row.order);
  }
}

/**
 * Mean duration, in milliseconds, of the programs a slot of this type would
 * actually draw from.
 *
 * Returns undefined rather than 0 when there is nothing to average -- an empty
 * pool, or a slot type with no fixed pool at all. The two are different answers
 * and the caller has to render them differently: `dayjs.duration(0).humanize()`
 * is "a few seconds", which reads as a real measurement rather than a missing
 * one.
 */
export function averageProgramDurationMs(
  slot: BaseSlot,
  programs: ContentProgram[],
): number | undefined {
  const durations = seq.collect(programs, ({ program, duration }) => {
    switch (slot.type) {
      case 'movie':
        return program.type === 'movie' ? duration : undefined;
      case 'show':
        return program.type === 'episode' &&
          getEpisodeShowId(program) === slot.showId
          ? duration
          : undefined;
      default:
        return undefined;
    }
  });

  if (durations.length === 0) {
    return undefined;
  }

  return round(sum(durations) / durations.length);
}
