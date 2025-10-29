import type { TimeSlotForm } from '@/model/TimeSlotModels.ts';
import React from 'react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

export const TimeSlotFormContext =
  React.createContext<TimeSlotFormContextType | null>(null);

export type TimeSlotFormContextType = UseFormReturn<TimeSlotForm> & {
  slotArray: UseFieldArrayReturn<TimeSlotForm, 'slots'>;
};
