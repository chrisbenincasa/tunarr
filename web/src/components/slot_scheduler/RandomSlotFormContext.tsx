import type { RandomSlotForm } from '@/model/SlotModels.ts';
import React from 'react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';

export type RandomSlotFormContextType = UseFormReturn<RandomSlotForm> & {
  slotArray: UseFieldArrayReturn<RandomSlotForm, 'slots'>;
};

export const RandomSlotFormContext =
  React.createContext<RandomSlotFormContextType | null>(null);
