import type { RandomSlotForm } from '@/pages/channels/RandomSlotEditorPage.tsx';
import React from 'react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

export type RandomSlotFormContextType = UseFormReturn<RandomSlotForm> & {
  slotArray: UseFieldArrayReturn<RandomSlotForm, 'slots'>;
};

export const RandomSlotFormContext =
  React.createContext<RandomSlotFormContextType | null>(null);

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
