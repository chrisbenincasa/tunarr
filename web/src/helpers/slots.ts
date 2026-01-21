import { prettifySnakeCaseString } from '@tunarr/shared/util';
import type {
  RandomSlotTableRowType,
  TimeSlotTableRowType,
} from '../model/CommonSlotModels.ts';

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
