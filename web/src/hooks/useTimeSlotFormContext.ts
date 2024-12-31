import { useContext } from 'react';
import {
  TimeSlotFormContext,
  TimeSlotFormContextType,
} from '../components/slot_scheduler/TimeSlotFormProvider';

export const useTimeSlotFormContext = () =>
  useContext(TimeSlotFormContext) as NonNullable<TimeSlotFormContextType>;
