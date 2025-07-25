import React from 'react';
import type { TimeSlotFormContextType } from './TimeSlotFormContext.tsx';
import { TimeSlotFormContext } from './TimeSlotFormContext.tsx';

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
