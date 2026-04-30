import { useContext } from 'react';
import type {
  RandomSlotFormContextType} from '../../components/slot_scheduler/RandomSlotFormContext.tsx';
import {
  RandomSlotFormContext
} from '../../components/slot_scheduler/RandomSlotFormContext.tsx';
import type {
  TimeSlotFormContextType} from '../../components/slot_scheduler/TimeSlotFormContext.tsx';
import {
  TimeSlotFormContext
} from '../../components/slot_scheduler/TimeSlotFormContext.tsx';

type PolymorphicFormContext =
  | {
      type: 'time';
      context: TimeSlotFormContextType;
    }
  | {
      type: 'random';
      context: RandomSlotFormContextType;
    };

export const usePolymorphicSlotFormContext = (): PolymorphicFormContext => {
  // here be dragons
  // TODO: One day we will clean this all up
  // Specifically use the nullable types here - we don't know where we are
  const timeCtx = useContext(TimeSlotFormContext);
  const randomCtx = useContext(RandomSlotFormContext);

  if (timeCtx) {
    return {
      type: 'time',
      context: timeCtx,
    };
  } else if (randomCtx) {
    return {
      type: 'random',
      context: randomCtx,
    };
  }

  throw new Error('impossible');
};
