import React from 'react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import type { TimeSlotForm } from '../../pages/channels/TimeSlotEditorPage.tsx';

export const TimeSlotFormContext =
  React.createContext<TimeSlotFormContextType | null>(null);

export type TimeSlotFormContextType = UseFormReturn<TimeSlotForm> & {
  slotArray: UseFieldArrayReturn<TimeSlotForm, 'slots'>;
};
