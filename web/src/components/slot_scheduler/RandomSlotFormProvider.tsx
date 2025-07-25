import React from 'react';
import type { RandomSlotFormContextType } from './RandomSlotFormContext.tsx';
import { RandomSlotFormContext } from './RandomSlotFormContext.tsx';

export const RandomSlotFormProvider = (
  props: RandomSlotFormContextType & {
    children: React.ReactNode | React.ReactNode[];
  },
) => {
  const { children, ...rest } = props;
  return (
    <RandomSlotFormContext.Provider value={rest}>
      {children}
    </RandomSlotFormContext.Provider>
  );
};
