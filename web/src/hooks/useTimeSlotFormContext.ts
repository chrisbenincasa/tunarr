import type { TimeSlotFormContextType } from '@/components/slot_scheduler/TimeSlotFormContext';
import { TimeSlotFormContext } from '@/components/slot_scheduler/TimeSlotFormContext';
import { useContext } from 'react';

export const useTimeSlotFormContext = () =>
  useContext(TimeSlotFormContext) as NonNullable<TimeSlotFormContextType>;
