import {
  RandomSlotFormContext,
  RandomSlotFormContextType,
} from '@/components/slot_scheduler/RandomSlotFormProvider.tsx';
import { useContext } from 'react';

export const useRandomSlotFormContext = () =>
  useContext(RandomSlotFormContext) as NonNullable<RandomSlotFormContextType>;
