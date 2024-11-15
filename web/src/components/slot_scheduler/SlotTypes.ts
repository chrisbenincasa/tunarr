import { TimeSlotForm } from '@/pages/channels/TimeSlotEditorPage.tsx';
import { Duration } from 'dayjs/plugin/duration';
import { FieldArrayWithId } from 'react-hook-form';

export type ProgramTooLongWarning = {
  type: 'program_too_long';
  programs: { id: string; duration: number }[];
};

export type SlotWarning = ProgramTooLongWarning;

export type TimeSlotTableDataType = FieldArrayWithId<TimeSlotForm, 'slots'>;

export type SlotTableRowType = TimeSlotTableDataType & {
  duration: Duration;
  warnings: SlotWarning[];
  programCount: number;
};
