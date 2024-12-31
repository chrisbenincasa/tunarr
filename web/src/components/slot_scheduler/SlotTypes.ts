import { RandomSlotForm } from '@/pages/channels/RandomSlotEditorPage.tsx';
import { TimeSlotForm } from '@/pages/channels/TimeSlotEditorPage.tsx';
import { FieldArrayWithId } from 'react-hook-form';

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
  durationMs: number;
};

export type TimeSlotTableRowType = TimeSlotTableDataType &
  SlotTableWarnings & {
    originalIndex: number;
  };

export type RandomSlotTableRowType = RandomSlotTableDataType &
  SlotTableWarnings;
