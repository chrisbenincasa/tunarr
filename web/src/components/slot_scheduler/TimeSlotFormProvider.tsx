import { TimeSlotForm } from '@/pages/channels/TimeSlotEditorPage.tsx';
import React, { useContext } from 'react';
import { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

type ContextType = UseFormReturn<TimeSlotForm> & {
  slotArray: UseFieldArrayReturn<TimeSlotForm, 'slots'>;
};

const TimeSlotFormContext = React.createContext<ContextType | null>(null);

export const useTimeSlotFormContext = () =>
  useContext(TimeSlotFormContext) as NonNullable<ContextType>;

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
