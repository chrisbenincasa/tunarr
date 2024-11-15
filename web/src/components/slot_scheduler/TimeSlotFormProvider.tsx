import { TimeSlotForm } from '@/pages/channels/TimeSlotEditorPage.tsx';
import React from 'react';
import { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

export type ContextType = UseFormReturn<TimeSlotForm> & {
  slotArray: UseFieldArrayReturn<TimeSlotForm, 'slots'>;
};

export const TimeSlotFormContext = React.createContext<ContextType | null>(
  null,
);

export const TimeSlotFormProvider = (
  props: ContextType & {
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
