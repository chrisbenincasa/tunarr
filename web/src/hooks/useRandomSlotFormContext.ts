import type { RandomSlotFormContextType } from '@/components/slot_scheduler/RandomSlotFormContext';
import { RandomSlotFormContext } from '@/components/slot_scheduler/RandomSlotFormContext';
import { useContext } from 'react';

export const useRandomSlotFormContext = () =>
  useContext(RandomSlotFormContext) as NonNullable<RandomSlotFormContextType>;
