import type { RandomSlotForm } from '@/pages/channels/RandomSlotEditorPage.tsx';
import type { FieldArrayWithId } from 'react-hook-form';

import type { Show } from '@tunarr/types';
import type {
  CustomShowProgrammingTimeSlot,
  FillerProgrammingTimeSlot,
  FlexProgrammingTimeSlot,
  MovieProgrammingTimeSlot,
  RedirectProgrammingTimeSlot,
  ShowProgrammingTimeSlot,
  TimeSlotSchedule,
} from '@tunarr/types/api';

export type UIShowProgrammingTimeSlot = ShowProgrammingTimeSlot & {
  show?: Show;
};

export type UITimeSlot =
  | MovieProgrammingTimeSlot
  | UIShowProgrammingTimeSlot
  | FlexProgrammingTimeSlot
  | RedirectProgrammingTimeSlot
  | CustomShowProgrammingTimeSlot
  | FillerProgrammingTimeSlot;

export type TimeSlotForm = {
  flexPreference: TimeSlotSchedule['flexPreference'];
  latenessMs: number;
  maxDays: number;
  padMs: number;
  period: 'day' | 'week';
  slots: UITimeSlot[];
};

export type ProgramTooLongWarning = {
  type: 'program_too_long';
  programs: { id: string; duration: number }[];
};

export type SlotWarning = ProgramTooLongWarning;

export type TimeSlotTableDataType = FieldArrayWithId<TimeSlotForm, 'slots'>;
export type RandomSlotTableDataType = FieldArrayWithId<RandomSlotForm, 'slots'>;

export type SlotTableWarnings = {
  warnings: SlotWarning[];
  programCount: number;
  durationMs?: number;
};

export type TimeSlotTableRowType = TimeSlotTableDataType &
  SlotTableWarnings & {
    originalIndex: number;
  };

export type RandomSlotTableRowType = RandomSlotTableDataType &
  SlotTableWarnings;
