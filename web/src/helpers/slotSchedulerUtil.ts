import { isNonEmptyString } from '@/helpers/util.ts';
import type { TimeSlotViewModel } from '@/model/TimeSlotModels.ts';
import type { Maybe } from '@/types/util.ts';
import type {
  ChannelProgram,
  CondensedChannelProgram,
  ContentProgram,
} from '@tunarr/types';
import type { BaseSlot, RandomSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { some } from 'lodash-es';
import type { StrictExclude, StrictExtract } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import type { DropdownOption } from './DropdownOption';

export type CustomShowProgramOption = DropdownOption<string> & {
  type: 'custom-show';
  customShowId: string;
  programCount: number;
};

export type RedirectProgramOption = DropdownOption<string> & {
  type: 'redirect';
  channelId: string;
  channelName: string;
};

export type ShowProgramOption = DropdownOption<string> & {
  type: 'show';
  showId: string;
};

export type FillerProgramOption = DropdownOption<string> & {
  type: 'filler';
  fillerListId: string;
  programCount: number;
};

export type SmartCollectionOption = DropdownOption<string> & {
  type: 'smart-collection';
  collectionId: string;
};

export type ProgramOption =
  | (DropdownOption<string> & {
      type: 'movie' | 'flex';
    })
  | CustomShowProgramOption
  | RedirectProgramOption
  | ShowProgramOption
  | FillerProgramOption
  | SmartCollectionOption;

export type ProgramOptionType = ProgramOption['type'];

// TODO: This is duped with the shared package, put it somewhere better
export type SlotId =
  | 'movie'
  | `show.${string}`
  | `custom-show.${string}`
  | `filler.${string}`
  | `redirect.${string}`
  | `flex`
  | `smart-collection.${string}`;

export const padOptions: DropdownOption<number>[] = [
  { value: 1, description: 'Do not pad' },
  { value: 5 * 60 * 1000, description: '0:00, 0:05, 0:10, ..., 0:55' },
  { value: 10 * 60 * 1000, description: '0:00, 0:10, 0:20, ..., 0:50' },
  { value: 15 * 60 * 1000, description: '0:00, 0:15, 0:30, ..., 0:45' },
  { value: 30 * 60 * 1000, description: '0:00, 0:30' },
  { value: 1 * 60 * 60 * 1000, description: '0:00' },
];

export const flexOptions: DropdownOption<'end' | 'distribute'>[] = [
  { value: 'distribute', description: 'Between videos' },
  { value: 'end', description: 'End of the slot' },
];

export const lineupItemAppearsInSchedule = (
  slots: BaseSlot[],
  item: ChannelProgram,
) => {
  return some(slots, (slot) => {
    switch (slot.type) {
      case 'custom-show':
        return (
          item.type === 'custom' && item.customShowId === slot.customShowId
        );
      case 'filler':
        return (
          item.type === 'filler' && item.fillerListId === slot.fillerListId
        );
      case 'redirect':
        return item.type === 'redirect';
      case 'flex':
        return item.type === 'flex';
      case 'movie':
        return (
          (item.type === 'content' && item.subtype === 'movie') ||
          (item.type === 'custom' && item.program?.subtype === 'movie')
        );
      case 'smart-collection':
        return true;
      case 'show': {
        const showTitle = slot.showId;
        return (
          item.type === 'content' &&
          item.subtype === 'episode' &&
          showTitle === (item.showId ?? item.title)
        );
      }
    }
  });
};

export const slotOptionIsScheduled = (
  slots: BaseSlot[],
  option: ProgramOption,
) => {
  switch (option.type) {
    case 'movie':
      return some(slots, (slot) => slot.type === 'movie');
    case 'flex':
      return true;
    case 'custom-show':
      return some(
        slots,
        (slot) =>
          slot.type === 'custom-show' &&
          slot.customShowId === option.customShowId,
      );
    case 'redirect':
      return true;
    case 'show':
      return some(
        slots,
        (slot) => slot.type === 'show' && slot.showId === option.showId,
      );
    case 'filler':
      return true;
    case 'smart-collection':
      return slots.some(
        (slot) =>
          slot.type === 'smart-collection' &&
          slot.smartCollectionId === option.collectionId,
      );
  }
};
export const OneDayMillis = dayjs.duration(1, 'day').asMilliseconds();
export const OneWeekMillis = dayjs.duration(1, 'week').asMilliseconds();

type SlotTypeWithOrdering = StrictExclude<
  BaseSlot['type'],
  'redirect' | 'flex'
>;
type SlotWithOrdering = StrictExtract<BaseSlot, { type: SlotTypeWithOrdering }>;

const AlphanumericSortOpt = {
  value: 'alphanumeric',
  description: 'Alphanumeric',
} as const;

const ChronologicalSortOpt = {
  value: 'chronological',
  description: 'Chronological',
} as const;
const ShuffleSortOpt = {
  value: 'shuffle',
  description: 'Shuffle',
} as const;
const NextEpSortOpt = {
  value: 'next',
  description: 'Next Episode',
} as const;
const OrderedShuffleSortOpt = {
  value: 'ordered_shuffle',
  description: 'Ordered Shuffle',
} as const;
const ShufflePreferLongSortOpt = {
  value: 'shuffle_prefer_long',
  description: 'Shuffle (prefer long)',
  helperText: 'Shuffles filler items, prefering those with longer duration',
} as const;
const ShufflePreferShortSortOpt = {
  value: 'shuffle_prefer_short',
  description: 'Shuffle (prefer short)',
  helperText: 'Shuffles filler items, prefering those with shorter duration',
} as const;
const UniformShuffleSortOpt = {
  value: 'uniform',
  description: 'Shuffle (uniform)',
  helperText: 'Randomizes filler items with no weighting',
} as const;

export function slotOrderOptions(
  slotProgrammingType: SlotTypeWithOrdering,
): DropdownOption<SlotWithOrdering['order']>[] {
  return match(slotProgrammingType)
    .with('movie', () => [
      AlphanumericSortOpt,
      ChronologicalSortOpt,
      ShuffleSortOpt,
    ])
    .with(P.union('show', 'custom-show'), () => [
      NextEpSortOpt,
      OrderedShuffleSortOpt,
      ShuffleSortOpt,
    ])
    .with('filler', () => [
      ShufflePreferLongSortOpt,
      ShufflePreferShortSortOpt,
      UniformShuffleSortOpt,
    ])
    .with('smart-collection', () => [
      AlphanumericSortOpt,
      ChronologicalSortOpt,
      ShuffleSortOpt,
      NextEpSortOpt,
      OrderedShuffleSortOpt,
    ])
    .exhaustive();
}

export const ProgramOptionTypes: DropdownOption<ProgramOptionType>[] = [
  {
    value: 'flex',
    description: 'Flex',
  },
  {
    value: 'custom-show',
    description: 'Custom Show',
  },
  {
    value: 'movie',
    description: 'Movies',
  },
  {
    value: 'redirect',
    description: 'Channel Redirect',
  },
  {
    value: 'show',
    description: 'Show',
  },
  {
    value: 'filler',
    description: 'Filler List',
  },
  {
    value: 'smart-collection',
    description: 'Smart Collection',
  },
];

export const getTimeSlotId = (programming: TimeSlotViewModel): SlotId => {
  switch (programming.type) {
    case 'show': {
      return `show.${programming.showId}`;
    }
    case 'redirect': {
      return `redirect.${programming.channelId}`;
    }
    case 'custom-show': {
      return `${programming.type}.${programming.customShowId}`;
    }
    case 'filler':
      return `${programming.type}.${programming.fillerListId}`;
    case 'flex':
    case 'movie': {
      return programming.type;
    }
    case 'smart-collection': {
      return `${programming.type}.${programming.smartCollectionId}`;
    }
  }
};

export const getRandomSlotId = (programming: RandomSlot): SlotId => {
  switch (programming.type) {
    case 'show': {
      return `${programming.type}.${programming.showId}`;
    }
    case 'redirect': {
      return `${programming.type}.${programming.channelId}`;
    }
    case 'custom-show': {
      return `${programming.type}.${programming.customShowId}`;
    }
    case 'filler':
      return `${programming.type}.${programming.fillerListId}`;
    case 'flex':
    case 'movie': {
      return programming.type;
    }
    case 'smart-collection':
      return `${programming.type}.${programming.smartCollectionId}`;
  }
};

export const getSlotIdForProgram = (
  program: CondensedChannelProgram,
  lookup: Record<string, ContentProgram>,
): Maybe<SlotId> => {
  switch (program.type) {
    case 'content': {
      if (isNonEmptyString(program.id)) {
        const materialized = lookup[program.id];
        if (materialized) {
          switch (materialized.subtype) {
            case 'movie':
              return 'movie';
            case 'episode':
              return isNonEmptyString(materialized.showId)
                ? `show.${materialized.showId}`
                : undefined;
            case 'music_video':
            case 'other_video':
            case 'track':
              return;
          }
        }
      }
      return;
    }
    case 'custom':
      return `custom-show.${program.customShowId}`;
    case 'filler':
      return `filler.${program.fillerListId}`;
    case 'redirect':
      return `redirect.${program.channel}`;
    case 'flex':
      return 'flex';
  }
};
