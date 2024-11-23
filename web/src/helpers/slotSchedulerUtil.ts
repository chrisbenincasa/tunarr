import { ChannelProgram } from '@tunarr/types';
import { BaseSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { some } from 'lodash-es';

export type DropdownOption<T extends string | number> = {
  value: T;
  description: string;
};

export type CustomShowProgramOption = DropdownOption<string> & {
  type: 'custom-show';
  customShowId: string;
};

export type RedirectProgramOption = DropdownOption<string> & {
  type: 'redirect';
  channelId: string;
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

export type TimeSlotId =
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
      return some(
        slots,
        (slot) =>
          slot.programming.type === 'redirect' &&
          slot.programming.channelId === option.channelId,
      );
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
