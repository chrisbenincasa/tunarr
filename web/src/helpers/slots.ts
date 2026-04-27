import { prettifySnakeCaseString } from '@tunarr/shared/util';
import { blue, green, orange, pink, purple } from '@mui/material/colors';
import type {
  RandomSlotTableRowType,
  TimeSlotTableRowType,
} from '../model/CommonSlotModels.ts';

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
