import { isNonEmptyString } from '@/helpers/util.ts';
import { Maybe } from '@/types/util.ts';
import {
  ChannelProgram,
  CondensedChannelProgram,
  ContentProgram,
} from '@tunarr/types';
import {
  BaseSlot,
  RandomSlotProgramming,
  TimeSlotProgramming,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import { some } from 'lodash-es';
import { DropdownOption } from './DropdownOption';

export type CustomShowProgramOption = DropdownOption<string> & {
  type: 'custom-show';
  customShowId: string;
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

export type ProgramOption =
  | (DropdownOption<string> & {
      type: 'movie' | 'flex';
    })
  | CustomShowProgramOption
  | RedirectProgramOption
  | ShowProgramOption;

export type SlotId =
  | 'movie'
  | `show.${string}`
  | `custom-show.${string}`
  | `redirect.${string}`
  | `flex`;

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
    switch (slot.programming.type) {
      case 'custom-show':
        return (
          item.type === 'custom' &&
          item.customShowId === slot.programming.customShowId
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
      case 'show': {
        const showTitle = slot.programming.showId;
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
      return some(slots, (slot) => slot.programming.type === 'movie');
    case 'flex':
      return true;
    case 'custom-show':
      return some(
        slots,
        (slot) =>
          slot.programming.type === 'custom-show' &&
          slot.programming.customShowId === option.customShowId,
      );
    case 'redirect':
      return true;
    case 'show':
      return some(
        slots,
        (slot) =>
          slot.programming.type === 'show' &&
          slot.programming.showId === option.showId,
      );
  }
};
export const OneDayMillis = dayjs.duration(1, 'day').asMilliseconds();
export const OneWeekMillis = dayjs.duration(1, 'week').asMilliseconds();
export const showOrderOptions = [
  {
    value: 'next',
    description: 'Next Episode',
  },
  {
    value: 'shuffle',
    description: 'Shuffle',
  },
  {
    value: 'ordered_shuffle',
    description: 'Ordered Shuffle',
  },
];

export const ProgramOptionTypes: DropdownOption<ProgramOption['type']>[] = [
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
];

export const getTimeSlotId = (programming: TimeSlotProgramming): SlotId => {
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
    default: {
      return programming.type;
    }
  }
};

export const getRandomSlotId = (programming: RandomSlotProgramming): SlotId => {
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
    default: {
      return programming.type;
    }
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
            case 'track':
              return;
          }
        }
      }
      return;
    }
    case 'custom':
      return `custom-show.${program.customShowId}`;
    case 'redirect':
      return `redirect.${program.channel}`;
    case 'flex':
      return 'flex';
  }
};
