import React from 'react';
import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import type { RandomSlotForm } from '../../pages/channels/RandomSlotEditorPage.tsx';

export type RandomSlotFormContextType = UseFormReturn<RandomSlotForm> & {
  slotArray: UseFieldArrayReturn<RandomSlotForm, 'slots'>;
};

export const RandomSlotFormContext =
  React.createContext<RandomSlotFormContextType | null>(null);
