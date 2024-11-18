import { useContext } from 'react';
import {
  ContextType,
  TimeSlotFormContext,
} from '../components/slot_scheduler/TimeSlotFormProvider';

export const useTimeSlotFormContext = () =>
  useContext(TimeSlotFormContext) as NonNullable<ContextType>;
