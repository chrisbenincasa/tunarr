import type { TimeSlotForm } from '@/pages/channels/TimeSlotEditorPage.tsx';
import React from 'react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

export type TimeSlotFormContextType = UseFormReturn<TimeSlotForm> & {
  slotArray: UseFieldArrayReturn<TimeSlotForm, 'slots'>;
};

export const TimeSlotFormContext =
  React.createContext<TimeSlotFormContextType | null>(null);

export const TimeSlotFormProvider = (
  props: TimeSlotFormContextType & {
    children: React.ReactNode | React.ReactNode[];
  },
) => {
  const { children, ...rest } = props;
  return (
    <TimeSlotFormContext.Provider value={rest}>
      {children}
    </TimeSlotFormContext.Provider>
  );
};
