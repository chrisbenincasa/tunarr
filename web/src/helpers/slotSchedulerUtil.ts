import { ChannelProgram } from '@tunarr/types';
import { BaseSlot } from '@tunarr/types/api';
import { some } from 'lodash-es';

export type DropdownOption<T extends string | number> = {
  value: T;
  description: string;
};

type CustomShowProgramOption = DropdownOption<string> & {
  type: 'custom-show';
  id: string;
};

type RedirectProgramOption = DropdownOption<string> & {
  type: 'redirect';
  channelId: string;
};

type ShowProgramOption = DropdownOption<string> & {
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
          slot.programming.customShowId === option.id,
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
